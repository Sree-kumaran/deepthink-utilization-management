from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

from app.services.qdrant_service import qdrant_service
from app.services.gemini_service import gemini_service

from app.api.routes.health import router as health_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.authorization import router as authorization_router
from app.api.routes.policies import router as policies_router
from app.api.routes.reviews import router as reviews_router
from app.api.routes.audit import router as audit_router
from app.api.routes.extraction import router as extraction_router
from app.api.routes.rag import router as rag_router

@asynccontextmanager
async def lifespan(app):
    from app.db.session import init_db
    await init_db()
    await qdrant_service.startup()
    gemini_service.startup()

    yield

    await qdrant_service.shutdown()



app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend-first UC02 prior authorization service",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


p = settings.API_PREFIX


# API routers
app.include_router(health_router, prefix=p)
app.include_router(dashboard_router, prefix=p)
app.include_router(authorization_router, prefix=p)
app.include_router(policies_router, prefix=p)
app.include_router(reviews_router, prefix=p)
app.include_router(audit_router, prefix=p)
app.include_router(extraction_router, prefix=p)
app.include_router(rag_router, prefix=p)


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": f"{p}/health/live",
    }