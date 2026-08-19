from __future__ import annotations

import asyncio

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams

from app.core.config import settings


class QdrantService:
    """
    Production-oriented Qdrant service.

    - Connects to Qdrant with retries.
    - Waits for Qdrant to become available.
    - Creates the policy collection only if it does not exist.
    - Keeps the existing collection/data intact.
    - Supports single-point and batch upserts.
    """

    VECTOR_SIZE = 3072
    DISTANCE = Distance.COSINE

    MAX_STARTUP_RETRIES = 3
    RETRY_DELAY_SECONDS = 1

    def __init__(self):
        self.client: AsyncQdrantClient | None = None
        self.collection_name = settings.QDRANT_COLLECTION

    async def startup(self):
        """
        Connect to Qdrant and ensure the policy collection exists.

        The API must not crash merely because Qdrant is still starting or offline in dev mode.
        """

        if self.client is not None:
            return

        qdrant_url = settings.QDRANT_URL
        if "qdrant" in qdrant_url:
            import socket
            try:
                socket.gethostbyname("qdrant")
            except socket.gaierror:
                qdrant_url = qdrant_url.replace("qdrant", "localhost")

        client = AsyncQdrantClient(
            url=qdrant_url,
            check_compatibility=False,
            timeout=3,
        )

        for attempt in range(
            1,
            self.MAX_STARTUP_RETRIES + 1,
        ):
            try:
                # Verify Qdrant is reachable.
                await client.get_collections()

                self.client = client

                print(
                    f"Qdrant connected "
                    f"(attempt {attempt}/{self.MAX_STARTUP_RETRIES})"
                )

                exists = await self.client.collection_exists(
                    self.collection_name
                )

                if not exists:
                    await self.client.create_collection(
                        collection_name=self.collection_name,
                        vectors_config=VectorParams(
                            size=self.VECTOR_SIZE,
                            distance=self.DISTANCE,
                        ),
                    )

                    print(
                        f"Created Qdrant collection: "
                        f"{self.collection_name}"
                    )

                else:
                    print(
                        f"Qdrant collection ready: "
                        f"{self.collection_name}"
                    )

                return

            except Exception as exc:
                print(
                    f"Qdrant unavailable "
                    f"(attempt {attempt}/"
                    f"{self.MAX_STARTUP_RETRIES}): "
                    f"{type(exc).__name__}"
                )

                if attempt < self.MAX_STARTUP_RETRIES:
                    await asyncio.sleep(
                        self.RETRY_DELAY_SECONDS
                    )

        await client.close()
        self.client = None
        print("Notice: Qdrant vector database is offline. Proceeding in fallback mode.")

    async def health(self) -> bool:
        if self.client is None:
            return False

        try:
            await self.client.get_collections()
            return True

        except Exception:
            return False

    async def upsert(
        self,
        point_id: str,
        vector: list[float],
        payload: dict,
    ):
        """
        Upsert a single Qdrant point.
        """

        if self.client is None:
            raise RuntimeError(
                "Qdrant client not initialized"
            )

        from qdrant_client.models import PointStruct

        await self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            ],
        )

    async def upsert_points(
        self,
        points: list[dict],
    ):
        """
        Upsert multiple Qdrant points.

        Expected input:

        [
            {
                "id": "...",
                "vector": [...],
                "payload": {...},
            },
            ...
        ]

        This is used by the policy indexer.
        """

        if self.client is None:
            raise RuntimeError(
                "Qdrant client not initialized"
            )

        if not points:
            return

        from qdrant_client.models import PointStruct

        qdrant_points = []

        for point in points:
            qdrant_points.append(
                PointStruct(
                    id=point["id"],
                    vector=point["vector"],
                    payload=point["payload"],
                )
            )

        await self.client.upsert(
            collection_name=self.collection_name,
            points=qdrant_points,
        )


    async def set_payload(
        self,
        point_ids: list[str],
        payload: dict,
    ):
        """Update metadata on existing policy vectors without re-embedding."""
        if self.client is None:
            raise RuntimeError("Qdrant client not initialized")
        if not point_ids:
            return
        await self.client.set_payload(
            collection_name=self.collection_name,
            payload=payload,
            points=point_ids,
        )

    async def search(
        self,
        vector: list[float],
        limit: int = 5,
    ):
        if self.client is None:
            return []

        result = await self.client.query_points(
            collection_name=self.collection_name,
            query=vector,
            limit=limit,
            with_payload=True,
        )

        return result.points

    async def count(self):
        if self.client is None:
            return 0

        result = await self.client.count(
            collection_name=self.collection_name,
            exact=True,
        )

        return result.count

    async def shutdown(self):
        if self.client is not None:
            await self.client.close()
            self.client = None


qdrant_service = QdrantService()