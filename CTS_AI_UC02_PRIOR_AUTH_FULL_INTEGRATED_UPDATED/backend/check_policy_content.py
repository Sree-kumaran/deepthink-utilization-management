import asyncio
import asyncpg

from app.core.config import settings


async def main():
    url = settings.DATABASE_URL.replace(
        "postgresql+asyncpg://",
        "postgresql://",
    )

    conn = await asyncpg.connect(url)

    total = await conn.fetchval(
        "SELECT COUNT(*) FROM policy_versions"
    )

    with_raw = await conn.fetchval(
        """
        SELECT COUNT(*)
        FROM policy_versions
        WHERE raw_content IS NOT NULL
        AND length(raw_content) > 0
        """
    )

    print("TOTAL_POLICY_VERSIONS =", total)
    print("WITH_RAW_CONTENT      =", with_raw)

    await conn.close()


asyncio.run(main())