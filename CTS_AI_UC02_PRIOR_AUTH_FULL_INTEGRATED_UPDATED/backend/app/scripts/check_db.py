"""UC02 PostgreSQL verification script."""

import asyncio

from sqlalchemy import select, text

from app.db.models import AuthorizationRequest, Policy, RuleEvaluation, AuditEvent
from app.db.session import SessionLocal


async def main() -> None:
    print("=" * 70)
    print("UC02 DATABASE VERIFICATION")
    print("=" * 70)

    async with SessionLocal() as db:
        await db.execute(text("SELECT 1"))
        print("[OK] PostgreSQL connection")

        authorizations = list(
            (await db.execute(select(AuthorizationRequest))).scalars().all()
        )
        print(f"[OK] authorization_requests: {len(authorizations)}")

        policies = list(
            (await db.execute(select(Policy))).scalars().all()
        )
        print(f"[OK] policies table: {len(policies)} rows")

        evaluations = list(
            (await db.execute(select(RuleEvaluation))).scalars().all()
        )
        print(f"[OK] rule_evaluations: {len(evaluations)}")

        audits = list(
            (await db.execute(select(AuditEvent))).scalars().all()
        )
        print(f"[OK] audit_events: {len(audits)}")

        print("-" * 70)
        print("DATABASE VERIFICATION PASSED")


if __name__ == "__main__":
    asyncio.run(main())
