# Local setup

> Designed to work the same on macOS, Ubuntu, and Windows + WSL2.

## Prerequisites

| Tool | Min version | Notes |
|---|---|---|
| Docker Desktop / Engine | 24+ | Compose v2 included |
| MongoDB Atlas account | free M0 tier works | https://cloud.mongodb.com |
| RAM | 8 GB (16 GB recommended) | llama3 + embeddings + Playwright |
| Disk | 12 GB free | models + volumes |
| OS | macOS 13 / Ubuntu 22 / Windows 11 + WSL2 | |

> No GPU required. llama3 (8B, 4-bit quantized) runs on CPU but is slow on 8GB. If responses are too slow, switch to the smaller `llama3.2` (3B) by setting `OLLAMA_MODEL=llama3.2` in `.env`.

## 1. Set up MongoDB Atlas

1. Sign in at https://cloud.mongodb.com and create a free **M0** cluster.
2. **Database Access**: create a user with read/write permissions — note the password.
3. **Network Access**: add your current IP, or `0.0.0.0/0` for development.
4. **Connect → Drivers → Python**: copy the SRV URI. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=arambh
   ```
5. URL-encode special characters in the password before pasting (e.g. `@` → `%40`).

## 2. Clone & configure

```bash
git clone https://your-repo/arambh.git
cd arambh
cp .env.example .env
# edit .env -> paste your Atlas SRV URI into MONGO_URI
```

## 3. Run Ollama on the host (not in Docker)

We deliberately run Ollama on your laptop directly — it's faster, avoids a 700 MB container image pull, and makes the model survive `make clean`.

```bash
# Install once (mac):  brew install ollama
# Pull the model once (~4.7 GB):
ollama pull llama3

# Start Ollama bound to all interfaces so containers can reach it:
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

Persist the bind setting on macOS so you don't have to set it each boot:

```bash
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
# then quit and restart the Ollama app
```

> Security note: `0.0.0.0` exposes Ollama to your local network. Fine on a trusted home Wi-Fi; for shared networks bind to your Docker bridge IP only.

The compose file's AI service points at `host.docker.internal:11434`, which resolves to the host from inside containers.

This same model also handles English ↔ Hindi / Marathi translation — there is no separate translation model to download.

## 4. Boot the stack

```bash
docker compose up -d
docker compose ps
```

First boot: AI service downloads the embedding + reranker models on first request (~700 MB total) into `./data/hf`. Subsequent starts are instant.

## 5. Open

- Frontend: http://localhost:5173 (admin login: `.env` → `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Backend OpenAPI docs: http://localhost:8000/docs
- AI service docs: http://localhost:8100/docs
- Qdrant dashboard: http://localhost:6333/dashboard
- Grafana: http://localhost:3001 (admin / admin)
- Prometheus: http://localhost:9090

## 6. Seed sample data

```bash
make seed
```

Then drop a PDF or trigger a crawl from the **Admin** page.

## Windows + WSL2 notes

- Run the project inside WSL filesystem (e.g. `~/projects/arambh`) for fast volume mounts.
- Ensure Docker Desktop has WSL integration enabled for your Ubuntu distro.
- `localhost:5173` works directly in your Windows browser.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ai-services` first request takes >60s | Embedding model is downloading. Check `docker compose logs ai-services`. |
| Ollama 'connection refused' from ai-services | Ollama on the host is probably bound to 127.0.0.1. Restart with `OLLAMA_HOST=0.0.0.0:11434 ollama serve`. Verify from inside the container: `docker compose exec ai-services curl -sS http://host.docker.internal:11434/api/tags`. |
| `host.docker.internal` not resolving on Linux | Already mapped via `extra_hosts: ["host.docker.internal:host-gateway"]` in compose. If you're on an older Docker version, upgrade to 20.10+. |
| Slow LLM | Switch to the smaller `llama3.2` (3B, ~2GB) by setting `OLLAMA_MODEL=llama3.2` in `.env` and `ollama pull llama3.2` on the host. |
| `qdrant` won't start | `rm -rf ./data/qdrant` and restart (only if you don't have important data). |
| Frontend can't reach backend | Confirm `VITE_API_BASE_URL` matches your host (default `http://localhost:8000`). |
| `crawler` cannot fetch JS-heavy sites | Ensure the Playwright base image is intact: `docker compose pull crawler`. |
| Tesseract missing | Already baked into `crawler/Dockerfile`. Rebuild: `docker compose build --no-cache crawler`. |
| Port conflicts | Edit the `ports:` block in `docker-compose.yml`. |
| `bcrypt` error on login | Make sure your machine clock is correct (JWT sensitive). |
| Atlas: `ServerSelectionTimeoutError` | IP not whitelisted in Atlas Network Access, or wrong password. URL-encode special chars in the password. |
| Atlas: `dns query name does not exist` | The SRV URI cluster host is mistyped, or your machine can't reach DNS. Re-copy the URI from Atlas → Connect. |
| Translation looks weird | The same llama3 handles translation; on the very first call it can be slow while the model warms up. Subsequent calls are cached. |

## Wipe everything

```bash
make clean
```

Destructive: removes local volumes for Qdrant, Redis, Ollama, raw data, processed data. **Atlas data is not touched** — drop collections from the Atlas UI or via `mongosh` if you want a clean slate.
