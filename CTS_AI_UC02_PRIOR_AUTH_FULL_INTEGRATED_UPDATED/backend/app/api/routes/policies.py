from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.policy import *
from app.services.policy_service import policy_service

router = APIRouter(prefix="/policies", tags=["policies"])


@router.post("", response_model=PolicyResponse, status_code=201)
async def create(
    p: PolicyCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await policy_service.create(db, p)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("", response_model=list[PolicyResponse])
async def listing(
    db: AsyncSession = Depends(get_db),
):
    return await policy_service.list(db)


@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(
    policy_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await policy_service.get(db, policy_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{policy_id}/versions", response_model=list[PolicyVersionResponse])
async def versions(
    policy_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await policy_service.list_versions(db, policy_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get(
    "/{policy_id}/versions/{version}",
    response_model=PolicyVersionResponse,
)
async def get_version(
    policy_id: str,
    version: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await policy_service.get_version(db, policy_id, version)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get(
    "/{policy_id}/active",
    response_model=PolicyVersionResponse,
)
async def active_version(
    policy_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await policy_service.get_active_version(db, policy_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/{policy_id}/versions",
    response_model=PolicyVersionResponse,
    status_code=201,
)
async def version(
    policy_id: str,
    p: PolicyVersionCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await policy_service.create_version(db, policy_id, p)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post(
    "/{policy_id}/versions/{version}/activate",
    response_model=PolicyVersionResponse,
)
async def activate(
    policy_id: str,
    version: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await policy_service.activate_version(db, policy_id, version)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))