from sqlmodel import SQLModel
from pydantic import BaseModel



#Model to create a new user
class UserCreate(BaseModel):
    email: str
    password: str

#Model to login user
class LoginRequest(BaseModel):
    email: str
    password: str


