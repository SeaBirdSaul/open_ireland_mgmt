# deps.py - Shared FastAPI dependencies
'''
Defines shared FastAPI dependencies for the backend application,
    Including database session management.
Can be imported and can then use variable "db" 
'''
from sqlalchemy.orm import Session
from backend.core.database import SessionLocal


def get_db():
    """
    Dependency to get database session.
    Yields a database session and ensures it's closed after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

