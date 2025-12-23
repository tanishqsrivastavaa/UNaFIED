from ...core.security import get_password_hash
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import select,Session
from ...db.db import get_session
from ...models.user import User
from pydantic import BaseModel

router = APIRouter()

class UserCreate(BaseModel):
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