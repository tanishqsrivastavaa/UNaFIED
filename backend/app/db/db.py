from sqlmodel import Session,SQLModel,create_engine
import os
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL= os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DB URL NOT PRESENT")

engine = create_engine(url=DATABASE_URL,echo=True)

def get_session():
    with Session(engine) as session:
        yield session