from fastapi import APIRouter
from sqlalchemy import text
from app.db.session import SessionLocal
from app.services.qdrant_service import qdrant_service
router=APIRouter(prefix="/health",tags=["health"])
@router.get("/live")
async def live():return {"status":"ok","service":"uc02-api"}
@router.get("/ready")
async def ready():
    db=False
    try:
        async with SessionLocal() as s: await s.execute(text("SELECT 1")); db=True
    except Exception: pass
    q=await qdrant_service.health(); return {"status":"ready" if db and q else "not_ready","postgres":db,"qdrant":q}
