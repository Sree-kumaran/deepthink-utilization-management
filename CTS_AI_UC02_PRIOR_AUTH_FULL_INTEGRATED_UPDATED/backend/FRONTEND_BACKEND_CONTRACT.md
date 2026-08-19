# Frontend ↔ Backend Contract

The supplied frontend plan follows: Request → Extraction → Policy Evaluation → Decision → Why/Trace → Audit, with Nurse Review, Request More Information and Policy Configuration. The backend owns all decision logic.

| Frontend screen | Backend endpoint |
|---|---|
| Dashboard | GET /api/v1/dashboard/summary + GET /api/v1/authorizations |
| New Authorization | POST /api/v1/authorizations |
| Extraction Results | POST /api/v1/extraction/preview (later model-backed) |
| Policy Evaluation | POST /api/v1/authorizations/{id}/evaluate?policy_id=... |
| Decision | decision field in evaluation/authorization |
| Why / Trace | GET /api/v1/authorizations/{id}/trace |
| Nurse Review queue | GET /api/v1/reviews/queue |
| Create review | POST /api/v1/reviews/requests/{id} |
| Complete review | POST /api/v1/reviews/{review_id}/complete |
| Policy Configuration | /api/v1/policies... |
| Audit Trail | GET /api/v1/audit/{id} |

The frontend must not calculate policy outcomes, thresholds, PASS/FAIL status or alter audit history. The backend is the source of truth.

Three decision outcomes are supported: APPROVE, PEND_FOR_NURSE_REVIEW, REQUEST_MORE_INFORMATION.


## Policy lifecycle / RAG update

Policy administration is persistent and versioned. `POST /api/v1/policies` creates an active policy with its authoritative `raw_content`; `POST /api/v1/policies/{policy_id}/versions` stores a new draft version; and `POST /api/v1/policies/{policy_id}/versions/{version}/activate` activates the selected version. Active policy content is embedded with the existing Gemini embedding service and upserted into the existing Qdrant policy collection before activation is committed. Older versions are marked retired and their Qdrant lifecycle metadata is refreshed.

The extraction API also enforces patient safety gating: the patient must exist in the supplied patient records and must be alive before feature extraction proceeds.
