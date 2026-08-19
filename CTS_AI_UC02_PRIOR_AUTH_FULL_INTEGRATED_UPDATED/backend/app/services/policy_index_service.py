from __future__ import annotations

from typing import Any

from app.scripts.index_policies import chunk_text, make_point_id
from app.services.gemini_service import gemini_service
from app.services.qdrant_service import qdrant_service


class PolicyIndexService:
    """Incrementally index a single policy version into the existing RAG store."""

    EMBED_BATCH_SIZE = 10

    async def index_version(self, policy, policy_version) -> dict[str, Any]:
        raw_content = (policy_version.raw_content or "").strip()
        if not raw_content:
            raise ValueError("Policy version must contain raw_content before it can be indexed into RAG")

        if gemini_service.client is None:
            gemini_service.startup()
        if qdrant_service.client is None:
            await qdrant_service.startup()

        chunks = chunk_text(raw_content)
        if not chunks:
            raise ValueError("Policy version contains no indexable text")

        points = []
        for index, chunk in enumerate(chunks):
            point_id = make_point_id(policy.id, policy_version.version, index)
            points.append({
                "point_id": point_id,
                "text": chunk,
                "index": index,
            })

        new_points = []
        for start in range(0, len(points), self.EMBED_BATCH_SIZE):
            batch = points[start : start + self.EMBED_BATCH_SIZE]
            vectors = await gemini_service.embed_documents([item["text"] for item in batch])
            if len(vectors) != len(batch):
                raise RuntimeError(
                    f"Gemini returned {len(vectors)} vectors for {len(batch)} policy chunks"
                )

            for item, vector in zip(batch, vectors):
                new_points.append({
                    "id": item["point_id"],
                    "vector": vector,
                    "payload": {
                        "policy_id": policy.id,
                        "version": policy_version.version,
                        "policy_status": policy_version.status,
                        "is_active_version": policy.active_version == policy_version.version,
                        "effective_from": policy_version.effective_from,
                        "effective_to": policy_version.effective_to,
                        "source": (
                            policy_version.source_references[0]
                            if policy_version.source_references
                            else None
                        ),
                        "page": None,
                        "section": None,
                        "text": item["text"],
                        "chunk_index": item["index"],
                        "chunk_count": len(chunks),
                        "content_type": "policy_evidence",
                    },
                })

        await qdrant_service.upsert_points(new_points)
        return {
            "policy_id": policy.id,
            "version": policy_version.version,
            "chunks": len(chunks),
            "indexed": len(new_points),
        }

    async def sync_lifecycle_metadata(self, policy, policy_version) -> None:
        """Refresh active/retired metadata for already embedded chunks."""
        raw_content = (policy_version.raw_content or "").strip()
        chunks = chunk_text(raw_content)
        if not chunks:
            return
        if qdrant_service.client is None:
            raise RuntimeError("Qdrant client not initialized")

        point_ids = [
            make_point_id(policy.id, policy_version.version, index)
            for index in range(len(chunks))
        ]
        await qdrant_service.set_payload(
            point_ids=point_ids,
            payload={
                "policy_status": policy_version.status,
                "is_active_version": policy.active_version == policy_version.version,
                "effective_from": policy_version.effective_from,
                "effective_to": policy_version.effective_to,
            },
        )


policy_index_service = PolicyIndexService()
