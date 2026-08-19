import asyncio

from app.services.gemini_service import gemini_service


SYSTEM_PROMPT = """
You are the policy evidence reasoning component of a prior authorization system.

Your job is to answer ONLY from the policy evidence supplied by the user.

Rules:
1. Do not invent policy requirements.
2. If the evidence is insufficient, say that additional information is required.
3. Return only the requested structured JSON.
4. Keep the answer concise and evidence-based.
"""


USER_PROMPT = """
Policy evidence:

Policy ID: MM-0343
Policy Version: 1.0
Section: Eligibility

Evidence:
Physical therapy may be considered when there is documented
functional impairment and the requested treatment is clinically
appropriate.

Patient context:
- Requested service: Physical Therapy
- Diagnosis: Chronic knee pain
- Functional impairment: Documented

Question:
Does the supplied evidence support the requested physical therapy
service?
"""


async def main():
    gemini_service.startup()
    response = await gemini_service.generate_rag_response(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=USER_PROMPT,
    )

    print("=" * 70)
    print("GEMINI STRUCTURED JSON TEST")
    print("=" * 70)

    print(response.model_dump_json(indent=2))

    print("=" * 70)
    print("JSON_GENERATION_OK")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())