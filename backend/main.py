import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.api.v1 import users
from app.api.routes import chat
from app.api.routes import tools

load_dotenv()

app = FastAPI(title="UNaFIED", version="0.1.0")

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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
