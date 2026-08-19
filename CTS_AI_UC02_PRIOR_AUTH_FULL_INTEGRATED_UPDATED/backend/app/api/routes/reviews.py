from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.authorization import ReviewComplete, ReviewCreate, ReviewResponse
from app.services.review_service import ReviewService


router = APIRouter(prefix="/reviews", tags=["Nurse Reviews"])

service = ReviewService()


def require_insurer_role(role: str | None = Header(default=None, alias="X-Role")):
    if role != "insurer":
        raise HTTPException(status_code=403, detail="Insurer role is required for nurse review operations")
    return role


@router.get("/queue", response_model=list[ReviewResponse])
async def get_review_queue(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_insurer_role),
):
    return await service.get_queue(db)


@router.get("/requests/{request_id}", response_model=ReviewResponse)
async def get_review_for_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_insurer_role),
):
    return await service.get_review_for_request(db=db, request_id=request_id)


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(
    review_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_insurer_role),
):
    return await service.get_review(
        db=db,
        review_id=review_id,
    )


@router.post(
    "/requests/{request_id}",
    response_model=ReviewResponse,
)
async def create_review(
    request_id: str,
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_insurer_role),
):
    return await service.create_review(
        db=db,
        request_id=request_id,
        payload=payload,
    )


@router.post(
    "/{review_id}/complete",
    response_model=ReviewResponse,
)
async def complete_review(
    review_id: str,
    payload: ReviewComplete,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_insurer_role),
):
    return await service.complete_review(
        db=db,
        review_id=review_id,
        payload=payload,
    )