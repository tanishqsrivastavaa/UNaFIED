import os
from sqlmodel import Session, SQLModel, create_engine
from dotenv import load_dotenv
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DB URL NOT PRESENT")

DEBUG = os.getenv("DEBUG", "false").lower() == "true"

engine = create_engine(url=DATABASE_URL, echo=DEBUG)

SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)


def get_session():
    with Session(engine) as session:
        yield session
