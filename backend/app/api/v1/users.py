from ...core.security import get_password_hash,verify_password_hash,create_token
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer
from sqlmodel import select,Session
from ...db.db import get_session
from ...models.user import User
from pydantic import BaseModel

router = APIRouter(tags=["users"])

class UserCreate(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/signup",response_model=User)
def signup(user_data: UserCreate, session: Session= Depends(get_session)):
    statement= select(User).where(User.email==user_data.email)
    existing_user = session.exec(statement).first()

    if existing_user:
        raise HTTPException(status_code=400,detail="Email already registered, Please login")
    

    hashed_password = get_password_hash(user_data.password)

    new_user = User(email=user_data.email,hashed_password=hashed_password)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    return new_user




@router.post("/login")
def login(body: LoginRequest, session: Session= Depends(get_session)):
    user = session.exec(select(User).where(User.email==body.email)).first()
    if not user or not verify_password_hash(body.password,user.hashed_password):
        raise HTTPException(status_code=401,detail="Invalid Credentials")
    token = create_token({"sub":str(user.id)})
    return {"access_token" : token,"token_type":"Bearer"}

