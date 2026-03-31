import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.api.v1 import users
from app.api.routes import chat
from app.api.routes import tools
from app.api.websockets import chat_ws
from app.api.websockets.manager import get_connection_manager
from app.core.redis import get_redis
from app.core.logger import logger

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("Starting UNaFIED backend...")

    # Initialize Redis connection for WebSocket manager
    redis_client = await get_redis()
    manager = get_connection_manager()
    manager.set_redis_pubsub(redis_client)

    logger.info("WebSocket manager initialized with Redis Pub/Sub")

    yield

    # Shutdown
    logger.info("Shutting down UNaFIED backend...")

    # Close all WebSocket connections
    await manager.close_all()

    logger.info("Shutdown complete")


app = FastAPI(title="UNaFIED", version="0.2.0", lifespan=lifespan)

# --- CORS ---
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(chat.router, prefix="/api/v1/chats", tags=["chats"])
app.include_router(tools.router, prefix="/api/v1/tools", tags=["tools"])
app.include_router(chat_ws.router, prefix="/api/v1", tags=["websockets"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
