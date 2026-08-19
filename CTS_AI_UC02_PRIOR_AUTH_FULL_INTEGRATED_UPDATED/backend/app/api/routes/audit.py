from fastapi import APIRouter,Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import AuditEvent
from app.db.session import get_db
router=APIRouter(prefix="/audit",tags=["audit"])
@router.get("/{request_id}")
async def audit(request_id,db:AsyncSession=Depends(get_db)):return list((await db.execute(select(AuditEvent).where(AuditEvent.request_id==request_id).order_by(AuditEvent.created_at.asc()))).scalars().all())
