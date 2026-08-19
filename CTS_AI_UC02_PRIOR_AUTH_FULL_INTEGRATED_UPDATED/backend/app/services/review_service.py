from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuthorizationRequest, NurseReview
from app.schemas.authorization import ReviewComplete, ReviewCreate
from app.services.audit_service import record_audit


class ReviewService:
    async def get_queue(self, db: AsyncSession):
        result = await db.execute(
            select(NurseReview)
            .join(AuthorizationRequest, NurseReview.request_id == AuthorizationRequest.id)
            .where(
                NurseReview.status == "OPEN",
                AuthorizationRequest.status == "PENDING_NURSE_REVIEW",
            )
            .order_by(NurseReview.created_at.asc())
        )
        return result.scalars().all()

    async def get_review_for_request(
        self,
        db: AsyncSession,
        request_id: str,
    ):
        result = await db.execute(
            select(NurseReview)
            .join(AuthorizationRequest, NurseReview.request_id == AuthorizationRequest.id)
            .where(
                NurseReview.request_id == request_id,
                NurseReview.status == "OPEN",
                AuthorizationRequest.status == "PENDING_NURSE_REVIEW",
            )
        )
        review = result.scalar_one_or_none()

        if not review:
            raise HTTPException(
                status_code=404,
                detail="Open nurse review not found for this authorization request",
            )

        return review

    async def get_review(
        self,
        db: AsyncSession,
        review_id: str,
    ):
        result = await db.execute(
            select(NurseReview)
            .where(NurseReview.id == review_id)
        )
        review = result.scalar_one_or_none()

        if not review:
            raise HTTPException(
                status_code=404,
                detail="Nurse review not found",
            )

        return review

    async def create_review(
        self,
        db: AsyncSession,
        request_id: str,
        payload: ReviewCreate,
    ):
        result = await db.execute(
            select(AuthorizationRequest)
            .where(AuthorizationRequest.id == request_id)
        )
        request = result.scalar_one_or_none()

        if not request:
            raise HTTPException(
                status_code=404,
                detail="Authorization request not found",
            )

        # Prevent duplicate active nurse reviews.
        result = await db.execute(
            select(NurseReview)
            .where(
                NurseReview.request_id == request_id,
                NurseReview.status == "OPEN",
            )
        )
        existing_review = result.scalar_one_or_none()

        if existing_review:
            return existing_review

        # Only requests waiting for human review should enter this queue.
        if request.status != "PENDING_NURSE_REVIEW":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Authorization request is not currently "
                    "pending nurse review"
                ),
            )

        review = NurseReview(
            request_id=request_id,
            status="OPEN",
            assigned_to=payload.assigned_to,
            notes=payload.notes,
        )

        db.add(review)
        await db.flush()

        await record_audit(
            db=db,
            request_id=request_id,
            event_type="NURSE_REVIEW_CREATED",
            actor=payload.assigned_to or "system",
            payload={
                "review_id": review.id,
                "status": review.status,
            },
        )

        await db.commit()
        await db.refresh(review)

        return review

    async def complete_review(
        self,
        db: AsyncSession,
        review_id: str,
        payload: ReviewComplete,
    ):
        result = await db.execute(
            select(NurseReview)
            .where(NurseReview.id == review_id)
        )
        review = result.scalar_one_or_none()

        if not review:
            raise HTTPException(
                status_code=404,
                detail="Nurse review not found",
            )

        if review.status != "OPEN":
            raise HTTPException(
                status_code=400,
                detail="Nurse review is already completed",
            )

        result = await db.execute(
            select(AuthorizationRequest)
            .where(AuthorizationRequest.id == review.request_id)
        )
        request = result.scalar_one_or_none()

        if not request:
            raise HTTPException(
                status_code=404,
                detail="Authorization request not found",
            )

        if request.status != "PENDING_NURSE_REVIEW":
            raise HTTPException(
                status_code=409,
                detail="Authorization request is no longer pending nurse review",
            )

        decision = payload.reviewer_decision

        review.status = "COMPLETED"
        review.reviewer_decision = decision
        review.notes = payload.notes
        review.completed_at = datetime.now(timezone.utc)

        # Update authorization according to the nurse's decision.
        if decision == "APPROVE":
            request.status = "DECIDED"
            request.decision = "APPROVE"

        elif decision == "DECLINE":
            request.status = "DECIDED"
            request.decision = "DECLINE"

        elif decision == "REQUEST_MORE_INFORMATION":
            request.status = "AWAITING_MORE_INFORMATION"
            request.decision = "REQUEST_MORE_INFORMATION"

        elif decision == "PEND_FOR_NURSE_REVIEW":
            request.status = "PENDING_NURSE_REVIEW"
            request.decision = "PEND_FOR_NURSE_REVIEW"
            next_review = NurseReview(
                request_id=review.request_id,
                status="OPEN",
                assigned_to=review.assigned_to,
            )
            db.add(next_review)

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported nurse decision: {decision}",
            )

        await record_audit(
            db=db,
            request_id=review.request_id,
            event_type="NURSE_REVIEW_COMPLETED",
            actor=review.assigned_to or "nurse",
            payload={
                "review_id": review.id,
                "decision": str(decision),
                "notes": payload.notes,
            },
        )

        await db.commit()
        await db.refresh(review)

        return review