# Prior Authorization — Integrated Frontend + Backend

This package is the **combined project**: the supplied backend plus the updated frontend.

## Backend — unchanged

The entire `backend/` directory comes from the backend ZIP you supplied. It was copied without backend code changes.

It contains:
- FastAPI API
- PostgreSQL integration
- Qdrant integration
- Rule engine
- RAG
- Extraction API
- Nurse Review API
- Audit API
- Policy API
- Dashboard API

## Frontend — updated

The `frontend/` directory is the original frontend project with the requested UI/workflow changes:
- Insurer/Provider role selector
- Insurer-only navigation
- Provider-only navigation
- Appearance settings
- Notification settings
- Authorization preferences
- Security & Audit settings
- Clinical Decision Safety section
- Backend-connected dashboard/policies/audit
- Backend-connected New Authorization
- Fixed Nurse Review workflow
- Existing authorization/evaluation/trace pages retained

## How the integration works

```text
Provider
  -> Frontend: New Authorization
  -> POST /api/v1/authorizations
  -> POST /api/v1/authorizations/{id}/evaluate
  -> existing backend Rule Engine + RAG
  -> if decision = PEND_FOR_NURSE_REVIEW
  -> POST /api/v1/reviews/requests/{id}
  -> Provider: Nurse Review
  -> GET /api/v1/reviews/queue
  -> GET /api/v1/authorizations/{id}
  -> GET /api/v1/authorizations/{id}/trace
  -> POST /api/v1/reviews/{review_id}/complete
```

No rule-engine or review logic was moved into the frontend.

## Run the backend

Open Terminal 1:

```powershell
cd backend
docker compose up -d
docker compose ps
```

The backend API is expected at:

```text
http://localhost:8000
```

## Run the frontend

Open Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

The frontend `.env` is configured with:

```text
VITE_API_BASE_URL=http://localhost:8000
```

The supplied backend already allows `http://localhost:5173` in CORS.

## Important

Do not modify the backend to make the UI work. If a frontend API call fails, check the browser console/network request and the backend API response first.
