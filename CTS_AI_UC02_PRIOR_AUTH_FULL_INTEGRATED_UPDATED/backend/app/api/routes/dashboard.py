from fastapi import APIRouter,Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.dashboard_service import summary
router=APIRouter(prefix="/dashboard",tags=["dashboard"])
@router.get("/summary")
async def dashboard(db:AsyncSession=Depends(get_db)):return await summary(db)
