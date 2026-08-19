# Prior Authorization Frontend — Integration Notes

This package contains **frontend-only changes**. The supplied FastAPI backend files were not modified or included in this package.

## Role navigation

- **Insurer**: Dashboard, Policy Rules, Audit Trail, Settings
- **Provider**: New Authorization, Requests, Nurse Review, Settings
- The role selector is in the top-right user menu and persists in browser local storage.
- Switching roles sends the user to that role's landing page.

## Settings

- Appearance: Light / Dark
- Notifications: Email notifications, confidence score, supporting evidence, human review
- Authorization Preferences: Default priority, requests per page
- Security & Audit: Audit logging, session timeout, login activity
- Clinical Decision Safety is displayed as a protected workflow rule.

## Nurse Review

The nurse-review screen was rebuilt to use the supplied backend contract:

- `GET /api/v1/reviews/queue`
- `GET /api/v1/authorizations/{request_id}`
- `GET /api/v1/authorizations/{request_id}/trace`
- `POST /api/v1/reviews/requests/{request_id}`
- `POST /api/v1/reviews/{review_id}/complete`

It now supports both the review queue (`/nurse-review`) and a selected request (`/nurse-review/:id`).

## Authorization creation

The New Authorization screen now sends the backend's actual schema (`patient`, `provider`, `plan`, `service`, `clinical`, `documents`, `conflicting_information`) instead of the older frontend field names.

After creating a request, the frontend looks up an active policy and calls the existing backend evaluation endpoint. No backend logic is duplicated in the frontend.

## Run

1. Keep the backend running at the URL in `.env` (`VITE_API_BASE_URL`, default `http://localhost:8000`).
2. In this frontend folder run:

```bash
npm install
npm run dev
```

3. Open the Vite URL shown in the terminal.

Do **not** copy any backend source files into this frontend package.
