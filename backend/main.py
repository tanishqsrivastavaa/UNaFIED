from fastapi import FastAPI
from sqlmodel import SQLModel
from app.api.v1 import users
from app.api.routes import chat
from fastapi.security import HTTPBearer

bearer_scheme = HTTPBearer()
app = FastAPI()

app.include_router(users.router,prefix="/api/v1",tags=["users"])
app.include_router(chat.router,prefix="/chat",tags=["chats"])


@app.get("/health")
def health() -> dict[str,str]:
    return {"status":"ok"}
