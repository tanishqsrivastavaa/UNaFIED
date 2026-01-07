from fastapi import Depends,HTTPException
from sqlmodel import Session
import os
from dotenv import load_dotenv
import jwt
from jwt import PyJWTError
from datetime import datetime,timedelta
from fastapi.security import HTTPBearer,HTTPAuthorizationCredentials
from passlib.context import CryptContext
from typing import Any
from db.db import get_session

load_dotenv()

SECRET_KEY= os.getenv("SECRET_AUTH_KEY")

#first we decide what algorithm we are going to use
ALGORITHM= "HS256"

#now we decide how long the token is alive for
ACCESS_TOKEN_TIME_LIMIT= 15 #15 minutes

bearer_scheme = HTTPBearer()


#first we will work on hashing the password

pwd_content = CryptContext(schemes=["bcrypt"],deprecated="auto")
def get_password_hash(password: str) -> str:
    return pwd_content.hash(password)

#now we will verify the hashed password
def verify_password_hash(plain_password: str,hash_password: str) -> bool:
    return pwd_content.verify(plain_password,hash_password)


"""now lets work on the token creation, verification, and getting current user"""

def create_token(data: dict, expires_detla: timedelta | None=None) -> str:
    
    to_encode = data.copy()

    if expires_detla:
        expire = datetime.now() + expires_detla
    else:
        expire = datetime.now() + timedelta(minutes=ACCESS_TOKEN_TIME_LIMIT)

    to_encode.update({"exp":expire})

    encoded_jwt = jwt.encode(to_encode,SECRET_KEY,ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict[str,Any]:
    try:
        payload = jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        return payload
    except PyJWTError:
        raise HTTPException(status_code=401,detail="Could not validate credentials")
    
#now we make the function to get current user


def get_current_user(token: HTTPAuthorizationCredentials = Depends(bearer_scheme),session: Session =Depends(get_session)):

    try:
        token_string = token.credentials
        payload = jwt.decode(token_string,SECRET_KEY,algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(status_code=401,detail="Invalid authentication credentials")
        
        user = session.exec(select(Users).where(Users.id==user_id)).first()
        if user is None:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )
        return user
    except PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials"
        )