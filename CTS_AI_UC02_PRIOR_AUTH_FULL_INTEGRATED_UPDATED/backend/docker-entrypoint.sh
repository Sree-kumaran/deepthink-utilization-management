#!/bin/sh
set -e

echo "========================================"
echo "UC02 BACKEND STARTUP"
echo "========================================"

echo "PostgreSQL dependency is healthy."

echo "Running database migrations..."
alembic upgrade head

echo ""
echo "========================================"
echo "SEEDING 10 PAYER POLICIES"
echo "========================================"

python -m app.scripts.seed_top_10_policies

echo ""
echo "========================================"
echo "INDEXING POLICIES INTO QDRANT"
echo "========================================"

python -m app.scripts.index_policies

echo ""
echo "========================================"
echo "STARTING FASTAPI"
echo "========================================"

exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000