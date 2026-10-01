import uuid
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


#What the API shows about a user; never the password hash
class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    timezone: str
