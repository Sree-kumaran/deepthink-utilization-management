#!/bin/sh

set -e

echo "========================================"
echo "UC02 BACKEND STARTUP"
echo "========================================"

echo "Waiting for PostgreSQL..."

until pg_isready -h postgres -U uc02 -d uc02 >/dev/null 2>&1
do
    sleep 2
done

echo "PostgreSQL is ready."

echo "Running database migrations..."

alembic upgrade head

echo "Seeding permanent top-10 policies..."

python -m app.scripts.seed_top_10_policies

echo "Starting FastAPI..."

exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000