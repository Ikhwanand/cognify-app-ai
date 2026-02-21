from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from routers import chat, documents, settings, evals, mcp, skills
from config import settings as app_settings
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from limiter import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting Cognify AI Backend...")
    init_db()
    print("✅ Database initialized")

    # Sync skills to disk for Agno LocalSkills
    try:
        from database import engine
        from sqlmodel import Session
        from services.skills import sync_skills_to_disk

        with Session(engine) as db:
            sync_skills_to_disk(db)
        print("✅ Skills synchronized")
    except Exception as e:
        print(f"⚠️ Failed to sync skills: {e}")
    yield
    # Shutdown
    print("👋 Shutting down...")
    try:
        from services.mcp_service import mcp_service

        await mcp_service.close_all_connections()
        print("✅ MCP connections closed")
    except Exception as e:
        print(f"⚠️ Failed to close MCP connections: {e}")


app = FastAPI(
    title="Cognify AI",
    description="AI-powered personal knowledge assistant with RAG",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter

app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(settings.router)
app.include_router(evals.router)
app.include_router(mcp.router)
app.include_router(skills.router)


@app.get("/")
async def root():
    return {
        "message": "Cognify AI Backend",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=app_settings.host,
        port=app_settings.port,
        reload=app_settings.debug,
    )
