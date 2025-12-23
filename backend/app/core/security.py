##User login and authentication
import os
from dotenv import load_dotenv
from typing import Optional
from datetime import datetime,timedelta
from passlib.context import CryptContext
import jwt
from fastapi.security import HTTPBearer 
from db.db import get_session

load_dotenv()

SECRET_KEY= os.getenv("AUTH_KEY")
if not SECRET_KEY:
    raise ValueError("No AUTH_KEY found in environment variables!")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

bearer_scheme= HTTPBearer()

def create_access_token(data: dict, expires_delta: timedelta | None=None) -> str:
    
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp":expire})

    encoded_jwt = jwt.encode(to_encode,SECRET_KEY,algorithm=ALGORITHM)

    return encoded_jwt


