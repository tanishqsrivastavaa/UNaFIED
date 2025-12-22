import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field

class User(SQLModel,table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4,primary_key=True)
    email: str = Field(unique=True, index= True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.now)
    