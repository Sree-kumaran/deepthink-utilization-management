from fastapi import APIRouter,Depends,Header,HTTPException,Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.authorization import AuthorizationCreate,AuthorizationResponse,DecisionTrace
from app.services.authorization_service import authorization_service
from app.services.extraction_service import extraction_service
from app.services.inference_client import inference_client
router=APIRouter(prefix="/authorizations",tags=["authorizations"])

def require_role(role: str | None = Header(default=None, alias="X-Role")):
    if role not in {"insurer", "provider"}:
        raise HTTPException(status_code=403, detail="A valid application role is required")
    return role

def require_provider(role: str = Depends(require_role)):
    if role != "provider":
        raise HTTPException(status_code=403, detail="Provider role is required")
    return role
@router.post("",response_model=AuthorizationResponse,status_code=201)
async def create(payload:AuthorizationCreate,idempotency_key:str|None=Header(default=None,alias="Idempotency-Key"),db:AsyncSession=Depends(get_db),_:str=Depends(require_provider)):
    try:return (await authorization_service.create(db,payload,idempotency_key))[0]
    except Exception as e: raise HTTPException(500,str(e))
@router.get("",response_model=list[AuthorizationResponse])
async def listing(status:str|None=Query(None),decision:str|None=Query(None),db:AsyncSession=Depends(get_db),_:str=Depends(require_role)):return await authorization_service.list(db,status,decision)
@router.get("/{request_id}",response_model=AuthorizationResponse)
async def get(request_id,db:AsyncSession=Depends(get_db),_:str=Depends(require_role)):
    r=await authorization_service.get(db,request_id)
    if not r:raise HTTPException(404,"Authorization request not found")
    return r
@router.post("/{request_id}/evaluate",response_model=DecisionTrace)
async def evaluate(request_id,policy_id,version:str|None=None,db:AsyncSession=Depends(get_db),_:str=Depends(require_role)):
    try:return await authorization_service.evaluate(db,request_id,policy_id,version)
    except ValueError as e:raise HTTPException(400,str(e))
@router.get("/{request_id}/trace",response_model=DecisionTrace)
async def trace(request_id,db:AsyncSession=Depends(get_db),_:str=Depends(require_role)):
    try:return await authorization_service.trace(db,request_id)
    except ValueError as e:raise HTTPException(404,str(e))

@router.api_route("/{request_id}/explain", methods=["GET", "POST"])
async def explain_authorization(request_id: str, db: AsyncSession = Depends(get_db), _: str = Depends(require_role)):
    try:
        try:
            tr = await authorization_service.trace(db, request_id)
            if tr.get("llm_explanation"):
                return {
                    "success": True,
                    "request_id": request_id,
                    "explanation": tr["llm_explanation"],
                    "ai_assessment": tr.get("ai_assessment", {}),
                    "note": "This is an assistive explanation, not a final clinical or authorization decision.",
                }
        except Exception:
            pass

        r = await authorization_service.get(db, request_id)
        if not r:
            raise HTTPException(404, "Authorization request not found")

        features, clinical_summary = extraction_service.build_features_for_authorization(
            patient=r.patient,
            clinical=r.clinical,
            service=r.service,
            plan=r.plan,
            documents=r.documents,
        )

        result = await inference_client.explain(
            features=features,
            clinical_summary=clinical_summary,
        )
        return {
            "success": True,
            "request_id": request_id,
            "result": result,
            "explanation": result.get("llm_explanation") if isinstance(result, dict) else str(result),
            "note": "This is an assistive explanation, not a final clinical or authorization decision.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Explanation generation failed: {str(e)}")
