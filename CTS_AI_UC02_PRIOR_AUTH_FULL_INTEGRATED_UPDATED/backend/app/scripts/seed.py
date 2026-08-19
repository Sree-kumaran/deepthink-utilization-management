import asyncio
from app.db.session import SessionLocal
from app.db.models import Policy
from app.schemas.policy import PolicyCreate
from app.services.policy_service import policy_service
async def main():
    async with SessionLocal() as db:
        if await db.get(Policy,"KNEE_MRI"): print("KNEE_MRI already exists"); return
        p=PolicyCreate(id="KNEE_MRI",name="Knee MRI Prior Authorization Policy",description="Demo configurable policy",version="v2.1",effective_from="2026-08-01",rules=[
            {"id":"R1","name":"Diagnosis documented","field":"clinical.diagnosis","operator":"exists","required":True,"reason":"A diagnosis must be documented.","failure_outcome":"REQUEST_MORE_INFORMATION"},
            {"id":"R2","name":"Symptoms at least 6 weeks","field":"clinical.symptom_duration_weeks","operator":"gte","value":6,"required":True,"reason":"Symptoms must be documented for at least 6 weeks.","failure_outcome":"PEND_FOR_NURSE_REVIEW"},
            {"id":"R3","name":"Conservative treatment documented","field":"clinical.prior_treatment","operator":"exists","required":True,"reason":"Prior conservative treatment must be documented.","failure_outcome":"REQUEST_MORE_INFORMATION"},
            {"id":"R4","name":"Clinical indication documented","field":"clinical.indication","operator":"exists","required":True,"reason":"A clinical indication must be documented.","failure_outcome":"REQUEST_MORE_INFORMATION"},
            {"id":"R5","name":"Plan coverage present","field":"plan.plan_id","operator":"exists","required":True,"reason":"An insurance plan must be identified.","failure_outcome":"REQUEST_MORE_INFORMATION"}],source_references=[{"source":"demo_policy","reference":"Knee MRI v2.1"}],raw_content="Knee MRI Prior Authorization Policy\nDiagnosis documented.\nSymptoms must be present for at least 6 weeks.\nConservative treatment must be documented.\nClinical indication must be documented.\nPlan coverage must be present.")
        await policy_service.create(db,p); print("Seeded KNEE_MRI v2.1")
if __name__=="__main__": asyncio.run(main())
