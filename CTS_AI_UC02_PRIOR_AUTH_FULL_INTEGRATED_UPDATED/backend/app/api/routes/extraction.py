from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.extraction_service import extraction_service

router = APIRouter(prefix="/extraction", tags=["extraction"])


@router.post("/extract")
async def extract(payload: dict, db: AsyncSession = Depends(get_db)):
    return await extraction_service.extract(payload, db=db)


@router.post("/preview")
async def preview(payload: dict, db: AsyncSession = Depends(get_db)):
    return await extraction_service.preview(payload, db=db)
