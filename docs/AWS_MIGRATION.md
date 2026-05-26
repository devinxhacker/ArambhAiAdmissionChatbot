# Future AWS migration plan

The local-first architecture has clean seams for a cloud lift. Here's the playbook.

## Mapping local → AWS

| Local | AWS |
|---|---|
| `frontend` (Vite dev) | Static build → **S3 + CloudFront** |
| `backend` FastAPI | **ECS Fargate** task behind ALB (or App Runner) |
| `ai-services` FastAPI | **ECS Fargate** with GPU (g5.xlarge) when LLM moves to vLLM, or CPU + Bedrock |
| `crawler` Celery | **ECS** workers + **EventBridge** scheduler (replaces beat) |
| `mongo` | **MongoDB Atlas** (preferred) or **DocumentDB** |
| `qdrant` | **Qdrant Cloud** or self-hosted on EC2 + EBS, or replace with **OpenSearch** kNN |
| `redis` | **ElastiCache Redis** |
| `ollama` (llama3) | **Bedrock** (Claude / Llama 3 hosted) **or** vLLM on EC2 GPU |
| Local volumes (`data/`) | **S3** (raw HTML, PDFs) + **EFS** for HF cache |
| Prometheus / Grafana | **Amazon Managed Prometheus + Grafana** or keep self-hosted |
| Ingress | **CloudFront** + **ALB** + **Route 53** |

## Step-by-step

1. **Wrap each Dockerfile build** in a CI job that pushes to **ECR**.
2. **Terraform / CDK** stacks per service. Each service mounts secrets via **Secrets Manager** (rotated `JWT_SECRET`, DB URIs, model API keys).
3. **Switch storage**:
   - Replace `data_dir`-based file IO in `ingestion.py` and `crawler/fetcher.py` with `boto3` calls. Repository pattern already isolates this — only one module to edit per concern.
4. **Switch LLM**:
   - `rag/llm.py` already abstracts the chat interface. Replace `ChatOllama` with `langchain_aws.ChatBedrock` or an OpenAI-compatible client pointing at vLLM.
5. **Switch translation**:
   - Local translation already runs through the same Ollama LLM — when you swap `rag/llm.py` to Bedrock/vLLM, translation moves with it for free. For higher scale or quality, swap `rag/translation.py` to **Amazon Translate** (`boto3 client('translate')`).
6. **Auth**:
   - Either keep the JWT layer or front the gateway with **Cognito** + JWT authorizer on **API Gateway**.
7. **Crawl scheduling**:
   - Move beat to **EventBridge** rules pushing to an SQS queue consumed by Celery (or Lambda for short tasks).
8. **Observability**:
   - Add **X-Ray** instrumentation; keep `/metrics` scraped by AMP. Logs route to CloudWatch via Fluent Bit.
9. **CDN + frontend**:
   - `npm run build` → upload `dist/` to S3 → invalidate CloudFront.

## Cost-control levers

- Ollama → Bedrock on-demand (no idle GPU cost).
- Embeddings on **SageMaker Serverless** or in-process (CPU is fine for BGE-small).
- Spot Fargate for crawler workers.
- Qdrant Cloud free tier for development; self-host once corpus > a few million vectors.

## Order of migration

1. Frontend → S3/CloudFront
2. Mongo → Atlas
3. Redis → ElastiCache
4. Backend + AI services → Fargate
5. Storage paths → S3
6. LLM → Bedrock (lowest risk to swap last)
7. Crawler scheduling → EventBridge

Each stage independently deployable; no big-bang cutover required.
