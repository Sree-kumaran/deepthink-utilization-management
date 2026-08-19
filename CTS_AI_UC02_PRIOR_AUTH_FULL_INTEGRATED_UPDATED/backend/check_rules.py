import asyncio

from sqlalchemy import select

from app.db.session import SessionLocal
from app.db.models import PolicyVersion


async def main():
    async with SessionLocal() as db:
        pv = await db.scalar(
            select(PolicyVersion).where(
                PolicyVersion.policy_id == "UHC-MRI-KNEE-001",
                PolicyVersion.version == "v1.0",
            )
        )

        if not pv:
            print("UHC POLICY VERSION NOT FOUND")
            return

        print("UHC-MRI-KNEE-001 RULES")
        print("=" * 60)

        for rule in pv.rules or []:
            print(rule)


asyncio.run(main())