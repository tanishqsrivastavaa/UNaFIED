##User login and authentication
import os
from dotenv import load_dotenv
from typing import Optional
from datetime import datetime,timedelta
import jwt
from jwt import PyJWTError
from fastapi.security import HTTPBearer,HTTPAuthorizationCredentials
from fastapi import HTTPException,Depends
from sqlmodel import Session
from db.db import get_session
from typing import Any
from passlib.context import CryptContext
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


def verify_token(token: str) -> dict[str,Any]:
    try:
        payload = jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        return payload
    except PyJWTError:
        raise HTTPException(status_code=401,detail= "Could not validate credentials")
    

def get_current_user(token:HTTPAuthorizationCredentials = Depends(bearer_scheme),session : Session = Depends(get_session)):
    try:
        token_string = token.credentials

        payload = jwt.decode(token_string,SECRET_KEY,algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code = 401,
                detail = "Invalid authentication credentials"
            ,)

    #querying the db to get user object
        user = session.exec(select(Users).where(Users.id == user_id)).first()
        if user is None:
                raise HTTPException(
                    status_code = 401,
                    detail = "User not found"
                ,)

        return user
    except PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
        )


pwd_content = CryptContext(schemes=["bcrypt"],deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_content.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_content.verify(plain_password,hashed_password)