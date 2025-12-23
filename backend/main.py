from fastapi import FastAPI
from app.api.v1.auth import router

app=FastAPI()

app = FastAPI()
app.include_router(router, prefix="/api/v1", tags=["auth"])

