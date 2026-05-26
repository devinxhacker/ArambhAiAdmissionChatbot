# Cross-service contracts

## Backend → AI service

### `POST /agent/ask`

Body:
```json
{
  "message": "string",
  "history": [{"role": "user|assistant|system", "content": "string"}],
  "language": "en|hi|mr|null",
  "stream": true
}
```

Streaming response (NDJSON, one JSON object per line):
- `{"type":"citations", "citations":[{...}]}` — emitted before tokens
- `{"type":"token", "text":"..."}` — repeated; concatenate to form the answer
- `{"type":"translation", "text":"..."}` — full localized answer (non-English only)
- `{"type":"meta", "confidence":0.74, "supported":true, "language":"en", "follow_ups":[...]}`
- `{"type":"done"}` — terminal

### `POST /ingest/document`

Body:
```json
{ "content": "raw text or empty string", "metadata": { "title": "...", "source_url": "...", "file_path": "/data/uploads/..." } }
```
Returns `{"ok": true, "doc_id": "...", "chunks": N}`.

### `POST /agent/recommend`

Body matches `RecommendBody` in backend; returns `{recommendations:[...], candidate_sources:[...]}`.

## Backend → Frontend

### Auth
- `POST /api/auth/register` — `{email,password,name}` → `UserOut`
- `POST /api/auth/login` — `{email,password}` → `{access_token, refresh_token}`
- `POST /api/auth/refresh` — `{refresh_token}` → `{access_token, refresh_token}`
- `GET  /api/auth/me` — `UserOut`

### Conversations
- `GET    /api/conversations`
- `POST   /api/conversations`
- `GET    /api/conversations/{id}`
- `DELETE /api/conversations/{id}`
- `POST   /api/conversations/{id}/ask` — SSE streaming events: `token`, `citations`, `meta`, `done`.

### Admin
- `POST  /api/admin/documents/upload` (multipart)
- `GET   /api/admin/documents?q=...`
- `DELETE /api/admin/documents/{doc_id}`
- `GET/POST/PATCH/DELETE /api/admin/sources[/{id}]`
- `POST  /api/admin/crawl/trigger` — `{source_id?, url?}`
- `GET   /api/admin/crawl/jobs`
- `POST  /api/admin/reindex`
- `GET   /api/admin/analytics/summary`
- `GET   /api/admin/users`

### Recommend
- `POST /api/recommend`
