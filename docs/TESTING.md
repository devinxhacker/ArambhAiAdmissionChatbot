# Testing strategy

Every service has its own `tests/` directory using **pytest**. Frontend uses **vitest**.

## Run everything

```bash
make test
```

## Layered approach

| Layer | What | Where |
|---|---|---|
| Unit | Pure helpers (chunker, JSON utils, safety, parser, security) | `*/tests/test_*.py` |
| Contract | Pydantic schemas, OpenAPI parity | `backend/tests/test_security.py`, `shared/contracts.md` |
| Integration | API + Mongo + Qdrant + Ollama (skipped if services unreachable) | run inside `docker compose exec` |
| Eval | Retrieval Recall@K + RAGAS faithfulness | `python -m app.eval.run_eval` (in `ai-services`) |
| Frontend | Component + hook tests | `npm run test` |

## Key guarantees verified

- `chunker.chunk_text` produces non-empty bounded chunks for long inputs and handles empty input.
- `safety.looks_like_injection` flags known jailbreaks; benign questions pass.
- `json_utils.extract_json` handles plain JSON, fenced JSON, and inline JSON-in-prose.
- `parser.extract_links` honors allowed-domains and ignores `javascript:` / `mailto:`.
- `security.create_access_token` round-trips with `decode_token`.

## CI suggestions

- GitHub Actions: matrix over services, run `pytest -q` per package.
- Add a smoke step that hits `/health` once the stack is up.
- Cache `~/.cache/pip`, `~/.cache/huggingface`, and `~/.npm`.
