from __future__ import annotations

import asyncio
import uuid
from typing import Any

from sqlalchemy import select

from app.db.models import Policy, PolicyVersion
from app.db.session import SessionLocal, engine
from app.services.gemini_service import gemini_service
from app.services.qdrant_service import qdrant_service


# ============================================================
# INDEXING CONFIGURATION
# ============================================================

CHUNK_SIZE = 1800
CHUNK_OVERLAP = 300

# Keep Gemini requests reasonably small.
EMBED_BATCH_SIZE = 10


# ============================================================
# TEXT CHUNKING
# ============================================================

def chunk_text(text: str) -> list[str]:
    """
    Split policy text into overlapping chunks.

    Existing indexed chunks are preserved because point IDs
    are deterministic.
    """

    text = (text or "").strip()

    if not text:
        return []

    chunks: list[str] = []

    start = 0
    text_length = len(text)

    while start < text_length:

        end = min(
            start + CHUNK_SIZE,
            text_length,
        )

        # Prefer natural boundaries.
        if end < text_length:

            boundary = text.rfind(
                "\n",
                start,
                end,
            )

            if boundary == -1:
                boundary = text.rfind(
                    " ",
                    start,
                    end,
                )

            if boundary > start + 500:
                end = boundary

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= text_length:
            break

        next_start = end - CHUNK_OVERLAP

        start = max(
            next_start,
            start + 1,
        )

    return chunks


# ============================================================
# DETERMINISTIC QDRANT ID
# ============================================================

def make_point_id(
    policy_id: str,
    version: str,
    chunk_index: int,
) -> str:

    raw = (
        f"uc02-policy:"
        f"{policy_id}:"
        f"{version}:"
        f"{chunk_index}"
    )

    return str(
        uuid.uuid5(
            uuid.NAMESPACE_URL,
            raw,
        )
    )


# ============================================================
# EXISTING POINT LOOKUP
# ============================================================

async def existing_point_ids(
    point_ids: list[str],
) -> set[str]:

    if not point_ids:
        return set()

    if qdrant_service.client is None:
        raise RuntimeError(
            "Qdrant client is not initialized"
        )

    result = await qdrant_service.client.retrieve(
        collection_name=qdrant_service.collection_name,
        ids=point_ids,
        with_payload=False,
        with_vectors=False,
    )

    return {
        str(point.id)
        for point in result
    }


# ============================================================
# INDEXER
# ============================================================

async def index_policies():

    print("=" * 72)
    print("UC02 PRODUCTION POLICY RAG INDEXER")
    print("=" * 72)

    # --------------------------------------------------------
    # START SERVICES
    # --------------------------------------------------------

    gemini_service.startup()

    await qdrant_service.startup()

    print("Gemini : READY")
    print("Qdrant : READY")
    print()

    total_policy_versions = 0
    total_chunks = 0
    existing_chunks = 0
    newly_indexed = 0

    try:

        async with SessionLocal() as db:

            # ------------------------------------------------
            # LOAD POLICIES + VERSIONS
            # ------------------------------------------------

            result = await db.execute(
                select(
                    Policy,
                    PolicyVersion,
                )
                .join(
                    PolicyVersion,
                    PolicyVersion.policy_id
                    == Policy.id,
                )
                .where(
                    PolicyVersion.raw_content.is_not(None)
                )
                .order_by(
                    Policy.id,
                    PolicyVersion.created_at,
                )
            )

            rows = result.all()

            total_policy_versions = len(rows)

            print(
                f"Policy versions with content: "
                f"{total_policy_versions}"
            )

            print()

            if not rows:

                print(
                    "No policy versions with raw_content found."
                )

                return

            # ------------------------------------------------
            # PROCESS EACH POLICY VERSION
            # ------------------------------------------------

            for number, (
                policy,
                policy_version,
            ) in enumerate(
                rows,
                start=1,
            ):

                policy_id = policy.id
                version = policy_version.version

                chunks = chunk_text(
                    policy_version.raw_content
                )

                total_chunks += len(chunks)

                print("-" * 72)

                print(
                    f"[{number}/{total_policy_versions}] "
                    f"{policy_id} / {version}"
                )

                print(
                    f"Status       : "
                    f"{policy_version.status}"
                )

                print(
                    f"Active       : "
                    f"{policy.active_version == version}"
                )

                print(
                    f"Chunks       : "
                    f"{len(chunks)}"
                )

                if not chunks:

                    print(
                        "No content chunks. Skipping."
                    )

                    continue

                # ------------------------------------------------
                # BUILD DETERMINISTIC IDS
                # ------------------------------------------------

                point_ids = [
                    make_point_id(
                        policy_id=policy_id,
                        version=version,
                        chunk_index=index,
                    )
                    for index in range(
                        len(chunks)
                    )
                ]

                # ------------------------------------------------
                # FIND ALREADY INDEXED CHUNKS
                # ------------------------------------------------

                existing_ids = (
                    await existing_point_ids(
                        point_ids
                    )
                )

                pending: list[
                    dict[str, Any]
                ] = []

                for index, (
                    chunk,
                    point_id,
                ) in enumerate(
                    zip(
                        chunks,
                        point_ids,
                    )
                ):

                    if point_id in existing_ids:

                        existing_chunks += 1

                        continue

                    pending.append(
                        {
                            "index": index,
                            "text": chunk,
                            "point_id": point_id,
                        }
                    )

                print(
                    f"Already indexed: "
                    f"{len(chunks) - len(pending)}"
                )

                print(
                    f"Pending        : "
                    f"{len(pending)}"
                )

                # Nothing to do for this policy.
                if not pending:

                    continue

                # ------------------------------------------------
                # EMBED ONLY MISSING CHUNKS
                # ------------------------------------------------

                for batch_start in range(
                    0,
                    len(pending),
                    EMBED_BATCH_SIZE,
                ):

                    batch = pending[
                        batch_start:
                        batch_start
                        + EMBED_BATCH_SIZE
                    ]

                    batch_number = (
                        batch_start
                        // EMBED_BATCH_SIZE
                    ) + 1

                    total_batches = (
                        len(pending)
                        + EMBED_BATCH_SIZE
                        - 1
                    ) // EMBED_BATCH_SIZE

                    print(
                        f"Embedding batch "
                        f"{batch_number}/"
                        f"{total_batches} "
                        f"({len(batch)} chunks)"
                    )

                    texts = [
                        item["text"]
                        for item in batch
                    ]

                    # ------------------------------------------------
                    # GEMINI EMBEDDING
                    # ------------------------------------------------

                    try:

                        vectors = (
                            await gemini_service
                            .embed_documents(
                                texts
                            )
                        )

                    except Exception as exc:

                        print()
                        print(
                            "Gemini embedding failed."
                        )
                        print(
                            f"Error type : "
                            f"{type(exc).__name__}"
                        )
                        print(
                            f"Error      : "
                            f"{exc}"
                        )
                        print()
                        print(
                            "Indexing stopped safely."
                        )
                        print(
                            "Existing Qdrant vectors "
                            "were NOT deleted."
                        )

                        raise

                    if len(vectors) != len(batch):

                        raise RuntimeError(
                            "Gemini returned "
                            f"{len(vectors)} vectors "
                            f"for {len(batch)} chunks."
                        )

                    # ------------------------------------------------
                    # UPSERT EACH POINT
                    #
                    # IMPORTANT:
                    # QdrantService currently exposes:
                    #
                    #     upsert(point_id, vector, payload)
                    #
                    # It does NOT expose:
                    #
                    #     upsert_points(...)
                    #
                    # Therefore we use the existing Qdrant API
                    # instead of changing qdrant_service.py.
                    # ------------------------------------------------

                    for item, vector in zip(
                        batch,
                        vectors,
                    ):

                        payload = {
                            # Identity
                            "policy_id": policy_id,
                            "version": version,

                            # Policy lifecycle
                            "policy_status": (
                                policy_version.status
                            ),

                            "is_active_version": (
                                policy.active_version
                                == version
                            ),

                            # Effective dates
                            "effective_from": (
                                policy_version
                                .effective_from
                            ),

                            "effective_to": (
                                policy_version
                                .effective_to
                            ),

                            # Source
                            "source": (
                                policy_version
                                .source_references[0]
                                if policy_version
                                .source_references
                                else None
                            ),

                            # Evidence
                            "page": None,
                            "section": None,
                            "text": item["text"],

                            # Chunk metadata
                            "chunk_index": (
                                item["index"]
                            ),

                            "chunk_count": len(
                                chunks
                            ),

                            # Retrieval classification
                            "content_type": (
                                "policy_evidence"
                            ),
                        }

                        await qdrant_service.upsert(
                            point_id=item[
                                "point_id"
                            ],
                            vector=vector,
                            payload=payload,
                        )

                        newly_indexed += 1

                    print(
                        f"  Qdrant upserted: "
                        f"{len(batch)}"
                    )

                    print(
                        f"  Total newly indexed: "
                        f"{newly_indexed}"
                    )

        # --------------------------------------------------------
        # FINAL REPORT
        # --------------------------------------------------------

        qdrant_count = (
            await qdrant_service.count()
        )

        print()
        print("=" * 72)
        print("POLICY RAG INDEXING COMPLETE")
        print("=" * 72)

        print(
            f"Policy versions : "
            f"{total_policy_versions}"
        )

        print(
            f"Total chunks    : "
            f"{total_chunks}"
        )

        print(
            f"Already existed : "
            f"{existing_chunks}"
        )

        print(
            f"Newly indexed   : "
            f"{newly_indexed}"
        )

        print(
            f"Qdrant vectors  : "
            f"{qdrant_count}"
        )

        print("=" * 72)

    finally:

        await qdrant_service.shutdown()

        await engine.dispose()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    try:

        asyncio.run(
            index_policies()
        )

    except KeyboardInterrupt:

        print()
        print(
            "Indexing cancelled safely."
        )