from sqlmodel import select, Session
from ..models.user import User
from ..schemas.user import UserCreate,LoginRequest
from ..core.security import get_password_hash,verify_password_hash, create_token

async def create_user(user_data: UserCreate, session:Session) -> User | None:
    statement = select(User).where(User.email==user_data.email)
    existing_user = session.exec(statement=statement).first()

    if existing_user:
        return None
    
    hashed_password= get_password_hash(user_data.password)
    new_user= User(email=user_data.email,hashed_password=hashed_password)

    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    return new_user


async def authenticate_user(body:LoginRequest, session:Session) -> dict | None:

    user = session.exec(select(User).where(User.email==body.email)).first()

    if not user or not verify_password_hash(body.password,user.hashed_password):
        return None
    
    token = create_token({"sub":str(user.id)})

    return {"access_token":token,"token_type":"Bearer"}