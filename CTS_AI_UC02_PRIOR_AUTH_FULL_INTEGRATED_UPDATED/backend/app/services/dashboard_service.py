from sqlalchemy import func,select
from app.db.models import AuthorizationRequest,NurseReview
async def summary(db):
    total=await db.scalar(select(func.count(AuthorizationRequest.id))) or 0; approved=await db.scalar(select(func.count(AuthorizationRequest.id)).where(AuthorizationRequest.decision=="APPROVE")) or 0; pended=await db.scalar(select(func.count(NurseReview.id)).where(NurseReview.status=="OPEN")) or 0; more=await db.scalar(select(func.count(AuthorizationRequest.id)).where(AuthorizationRequest.decision=="REQUEST_MORE_INFORMATION")) or 0; return {"total":total,"approved":approved,"pended":pended,"request_more_information":more}
