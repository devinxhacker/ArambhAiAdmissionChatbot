# API reference

OpenAPI/Swagger UI is auto-generated:

- Backend: http://localhost:8000/docs
- AI service: http://localhost:8100/docs

For a high-level summary of cross-service contracts see [`shared/contracts.md`](../shared/contracts.md).

## Quick examples

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@arambh.local","password":"ChangeMe!2025"}'
```

### Create a conversation + ask
```bash
TOKEN=...   # from /login
CONV=$(curl -s -X POST http://localhost:8000/api/conversations -H "Authorization: Bearer $TOKEN" | jq -r .id)

curl -N -X POST "http://localhost:8000/api/conversations/$CONV/ask" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the BTech CSE fee at COEP Pune?","stream":true}'
```

### Trigger ad-hoc URL crawl
```bash
curl -X POST http://localhost:8000/api/admin/crawl/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.coep.org.in/admissions"}'
```

### Recommend
```bash
curl -X POST http://localhost:8000/api/recommend \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rank":15000,"state":"Maharashtra","branch":"CSE","needs_hostel":true}'
```
