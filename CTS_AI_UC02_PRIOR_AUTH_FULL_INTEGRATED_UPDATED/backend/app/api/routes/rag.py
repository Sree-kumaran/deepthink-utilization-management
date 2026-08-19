from fastapi import APIRouter, HTTPException

from app.services.gemini_service import gemini_service
from app.services.qdrant_service import qdrant_service
from app.services.rag_service import rag_service
from app.schemas.rag import RAGQueryRequest, RAGResponse


router = APIRouter(
    prefix="/rag",
    tags=["rag"],
)


@router.get("/health")
async def health():
    """
    RAG subsystem health.

    Reports the state of Gemini and Qdrant independently so that
    infrastructure problems are distinguishable from RAG problems.
    """

    qdrant_ok = await qdrant_service.health()
    gemini_ok = gemini_service.client is not None

    return {
        "status": (
            "healthy"
            if qdrant_ok and gemini_ok
            else "degraded"
        ),
        "qdrant": qdrant_ok,
        "gemini": gemini_ok,
        "purpose": "Policy retrieval and grounded RAG decision engine",
    }


@router.post("/retrieve")
async def retrieve_policy_evidence(
    request: RAGQueryRequest,
):
    """
    Retrieve policy evidence only.

    This endpoint does NOT make an authorization decision.

    Patient/request information is used to improve retrieval relevance,
    but only policy evidence is stored in Qdrant.
    """

    try:
        evidence = await rag_service.retrieve_policy_evidence(
            question=request.question,
            patient_data=request.patient_context,
            requested_service=request.requested_service,
            limit=request.top_k,
        )

        return {
            "question": request.question,
            "requested_service": request.requested_service,
            "evidence_count": len(evidence),
            "evidence": evidence,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Policy retrieval failed: {str(exc)}",
        )


@router.post(
    "/evaluate",
    response_model=RAGResponse,
)
async def evaluate(
    request: RAGQueryRequest,
):
    """
    Full grounded policy RAG evaluation.

    Flow:

        Authorization request
              ↓
        Query normalization
              ↓
        Gemini query embedding
              ↓
        Qdrant policy retrieval
              ↓
        Evidence filtering
              ↓
        Grounded Gemini evaluation
              ↓
        Citation verification
              ↓
        Deterministic safety guardrails
              ↓
        Structured RAGResponse
    """

    try:
        response = await rag_service.generate_response(
            question=request.question,
            patient_data=request.patient_context,
            requested_service=request.requested_service,
            limit=request.top_k,
        )

        return response

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"RAG evaluation failed: {str(exc)}",
        )