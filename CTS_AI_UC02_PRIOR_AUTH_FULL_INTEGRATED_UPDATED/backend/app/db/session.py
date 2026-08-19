from collections.abc import AsyncGenerator
import os
import socket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings
from app.db.base import Base

db_url = settings.DATABASE_URL

is_postgres_reachable = False
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    if s.connect_ex(("127.0.0.1", 5432)) == 0:
        is_postgres_reachable = True
    s.close()
except Exception:
    is_postgres_reachable = False

if not is_postgres_reachable:
    try:
        socket.gethostbyname("postgres")
        is_postgres_reachable = True
    except socket.gaierror:
        is_postgres_reachable = False

if is_postgres_reachable:
    if "@postgres:" in db_url:
        try:
            socket.gethostbyname("postgres")
        except socket.gaierror:
            db_url = db_url.replace("@postgres:", "@localhost:")
    engine = create_async_engine(db_url, pool_pre_ping=True, pool_recycle=1800, future=True)
else:
    db_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "prior_auth.db"))
    db_url = f"sqlite+aiosqlite:///{db_file}"
    print(f"Notice: PostgreSQL offline on port 5432. Using SQLite database: {db_file}")
    engine = create_async_engine(db_url, future=True)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    import app.db.models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed top 10 policies if table is empty
    try:
        from app.db.models import Policy
        from app.scripts.seed_top_10_policies import seed_policies
        async with SessionLocal() as session:
            result = await session.execute(select(Policy).limit(1))
            if not result.scalar_one_or_none():
                print("Seeding initial payer policies into database...")
                await seed_policies()
    except Exception as exc:
        print(f"Policy seeding notice: {exc}")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


