import uuid
from sqlmodel import SQLModel
from pydantic import BaseModel, Field



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


#Reminder settings; email_available says whether the server can send email at all
class PreferencesRead(BaseModel):
    reminder_lead_minutes: int
    email_notifications: bool
    email_available: bool


class PreferencesUpdate(BaseModel):
    reminder_lead_minutes: int | None = Field(default=None, ge=0, le=1440)
    email_notifications: bool | None = None
