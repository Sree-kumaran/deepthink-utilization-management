from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Policy, PolicyVersion
from app.services.audit_service import record_audit
from app.services.policy_index_service import policy_index_service


class PolicyService:

    async def create(self, db: AsyncSession, payload):
        if await db.get(Policy, payload.id):
            raise ValueError("Policy already exists")

        policy = Policy(
            id=payload.id,
            name=payload.name,
            description=payload.description,
            active_version=payload.version,
            active=True,
        )

        version = PolicyVersion(
            id=f"{payload.id}:{payload.version}",
            policy_id=payload.id,
            version=payload.version,
            effective_from=payload.effective_from,
            status="ACTIVE",
            rules=[r.model_dump() for r in payload.rules],
            source_references=payload.source_references,
            raw_content=payload.raw_content,
            policy_metadata={"rag_index_status": "PENDING"},
        )

        db.add_all([policy, version])
        await db.flush()

        # Index before the policy becomes durable/active. If RAG indexing fails,
        # the DB transaction is rolled back and the old active policy remains intact.
        try:
            index_result = await policy_index_service.index_version(policy, version)
        except Exception as exc:
            await db.rollback()
            raise ValueError(f"Policy was not activated because RAG indexing failed: {type(exc).__name__}: {exc}") from exc

        version.policy_metadata = {
            "rag_index_status": "INDEXED",
            "rag_index": index_result,
        }

        await record_audit(
            db,
            "POLICY_CREATED",
            None,
            {
                "policy_id": payload.id,
                "version": payload.version,
                "rag_index": index_result,
            },
            "admin",
        )

        await db.commit()
        await db.refresh(policy)
        return policy

    async def list(self, db: AsyncSession):
        result = await db.execute(select(Policy).order_by(Policy.created_at.desc()))
        return list(result.scalars().all())

    async def get(self, db: AsyncSession, policy_id: str):
        policy = await db.get(Policy, policy_id)
        if not policy:
            raise ValueError("Policy not found")
        return policy

    async def list_versions(self, db: AsyncSession, policy_id: str):
        policy = await db.get(Policy, policy_id)
        if not policy:
            raise ValueError("Policy not found")
        result = await db.execute(
            select(PolicyVersion)
            .where(PolicyVersion.policy_id == policy_id)
            .order_by(PolicyVersion.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_version(self, db: AsyncSession, policy_id: str, version: str):
        policy = await db.get(Policy, policy_id)
        if not policy:
            raise ValueError("Policy not found")
        target = await db.scalar(
            select(PolicyVersion).where(
                PolicyVersion.policy_id == policy_id,
                PolicyVersion.version == version,
            )
        )
        if not target:
            raise ValueError("Policy version not found")
        return target

    async def get_active_version(self, db: AsyncSession, policy_id: str):
        policy = await db.get(Policy, policy_id)
        if not policy:
            raise ValueError("Policy not found")
        target = await db.scalar(
            select(PolicyVersion).where(
                PolicyVersion.policy_id == policy_id,
                PolicyVersion.version == policy.active_version,
                PolicyVersion.status == "ACTIVE",
            )
        )
        if not target:
            raise ValueError("Active policy version not found")
        return target

    async def create_version(self, db: AsyncSession, policy_id: str, payload):
        policy = await db.get(Policy, policy_id)
        if not policy:
            raise ValueError("Policy not found")

        vid = f"{policy_id}:{payload.version}"
        if await db.get(PolicyVersion, vid):
            raise ValueError("Policy version already exists")

        version = PolicyVersion(
            id=vid,
            policy_id=policy_id,
            version=payload.version,
            effective_from=payload.effective_from,
            effective_to=payload.effective_to,
            status=payload.status,
            rules=[r.model_dump() for r in payload.rules],
            source_references=payload.source_references,
            raw_content=payload.raw_content,
            policy_metadata={"rag_index_status": "PENDING"},
        )
        db.add(version)
        await db.flush()

        # Draft versions are persisted but do not affect retrieval until activated.
        if payload.status.upper() == "ACTIVE":
            policy.active_version = payload.version
            try:
                index_result = await policy_index_service.index_version(policy, version)
            except Exception as exc:
                await db.rollback()
                raise ValueError(f"Policy version was not activated because RAG indexing failed: {type(exc).__name__}: {exc}") from exc
            version.policy_metadata = {"rag_index_status": "INDEXED", "rag_index": index_result}
        else:
            index_result = None
            version.policy_metadata = {"rag_index_status": "NOT_ACTIVE"}

        await record_audit(
            db,
            "POLICY_VERSION_CREATED",
            None,
            {
                "policy_id": policy_id,
                "version": payload.version,
                "status": payload.status,
                "rag_index": index_result,
            },
            "admin",
        )
        await db.commit()
        await db.refresh(version)
        return version

    async def activate_version(self, db: AsyncSession, policy_id: str, version: str):
        policy = await db.get(Policy, policy_id)
        if not policy:
            raise ValueError("Policy not found")

        target = await db.scalar(
            select(PolicyVersion).where(
                PolicyVersion.policy_id == policy_id,
                PolicyVersion.version == version,
            )
        )
        if not target:
            raise ValueError("Policy version not found")

        versions = (
            await db.execute(select(PolicyVersion).where(PolicyVersion.policy_id == policy_id))
        ).scalars().all()
        for item in versions:
            item.status = "ACTIVE" if item.id == target.id else "RETIRED"

        policy.active_version = version

        try:
            index_result = await policy_index_service.index_version(policy, target)
            for item in versions:
                await policy_index_service.sync_lifecycle_metadata(policy, item)
        except Exception as exc:
            await db.rollback()
            raise ValueError(f"Policy version was not activated because RAG indexing failed: {type(exc).__name__}: {exc}") from exc

        target.policy_metadata = {
            **(target.policy_metadata or {}),
            "rag_index_status": "INDEXED",
            "rag_index": index_result,
        }

        await record_audit(
            db,
            "POLICY_VERSION_ACTIVATED",
            None,
            {"policy_id": policy_id, "version": version, "rag_index": index_result},
            "admin",
        )
        await db.commit()
        await db.refresh(target)
        return target


policy_service = PolicyService()
