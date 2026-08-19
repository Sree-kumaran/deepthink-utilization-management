# UC02 Backend — Integrated Policy RAG Backend

This package combines the two uploaded backend snapshots into one runnable backend.

## Included

- FastAPI API
- PostgreSQL + async SQLAlchemy
- Alembic migrations
- deterministic authorization/rule engine
- policy CRUD, versioning, activation
- authorization workflow, trace, audit and nurse review
- Qdrant policy-evidence storage
- Gemini embeddings and grounded RAG service
- policy chunking/indexing script with deterministic Qdrant IDs
- RAG `/retrieve` and `/evaluate` endpoints
- inference normalization service
- database verification script

## RAG indexing

The indexer is resumable: it generates deterministic point IDs and checks existing Qdrant points before embedding missing chunks. Existing Qdrant vectors are not intentionally deleted by the indexer.

Run inside the API container:

```powershell
docker compose exec api python -m app.scripts.index_policies
```

The current project uses:

- Qdrant collection: `uc02_policy_evidence`
- Gemini embedding model: `gemini-embedding-001`
- embedding dimensionality: 3072

## Docker

1. Copy `.env.example` to `.env`.
2. Put the Gemini API key in `.env`.
3. Start PostgreSQL and Qdrant.
4. Start the API.
5. Open `http://localhost:8000/docs`.

Do not commit `.env`. It is excluded from the Docker build context and should remain local.

## RAG endpoints

- `POST /api/v1/rag/retrieve` — retrieve policy evidence.
- `POST /api/v1/rag/evaluate` — grounded RAG evaluation.
- `GET /api/v1/rag/health` — Gemini/Qdrant RAG health.

## Verification performed on this integrated source

- Python compilation of the application succeeded.
- Python compilation of the tests succeeded.
- Local `app.*` import targets were checked and no missing local modules were found.

Runtime Docker/Gemini/Qdrant execution was not performed while building this package, so the final indexing run and RAG endpoint test should still be performed in your environment.
