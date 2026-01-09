from ...core.security import get_current_user
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer,OAuth2PasswordRequestForm
from sqlmodel import select,Session
from ...db.db import get_session
from ...models.user import User
from ...schemas.user import LoginRequest, UserCreate
from ...crud.user import create_user,authenticate_user

router = APIRouter(tags=["users"])

@router.post("/signup",response_model=User)
async def signup(user_data: UserCreate, session: Session= Depends(get_session)):
    new_user= await create_user(user_data,session)

    if not new_user:
        raise HTTPException(status_code=401,detail="Email already registered, please login.")

    return new_user


@router.post("/login")
async def login(body: LoginRequest, session: Session= Depends(get_session)):

    result = await authenticate_user(body,session)
    if not result:
        raise HTTPException(status_code=401,detail="Invalid credentials")
    
    return result
        


@router.get("/me")
async def read_users_me(current_user:User = Depends(get_current_user)):
    return current_user