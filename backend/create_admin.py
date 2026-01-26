#!/usr/bin/env python
"""
Script to create an admin user in the database.
Usage: python backend/create_admin.py [username] [email] [password]
"""

import os
import sys

# Try multiple import strategies so this script works when run:
# - from the project root: `python backend/create_admin.py ...`
# - inside the container where `/app` is the project root
# - as a module `python -m backend.create_admin ...`
try:
    from backend.core.database import SessionLocal
    from backend.core.hash import hash_password
    from backend.scheduler.models import User
except Exception:
    # Add project root and backend folder to sys.path, then retry
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    backend_dir = os.path.join(project_root, 'backend')
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    try:
        from backend.core.database import SessionLocal
        from backend.core.hash import hash_password
        from backend.scheduler.models import User
    except Exception:
        # Fallback to non-package imports when running with PYTHONPATH or in dev
        from core.database import SessionLocal
        from core.hash import hash_password
        from scheduler.models import User

def create_admin_user(username: str, email: str, password: str):
    """Create an admin user in the database"""
    db = SessionLocal()
    
    try:
        # Check if user already exists
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"Error: User '{username}' already exists")
            return False
        
        # Hash the password
        hashed_password = hash_password(password)
        
        # Create the admin user
        admin_user = User(
            username=username,
            email=email,
            password=hashed_password,
            is_admin=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print(f"✓ Admin user created successfully!")
        print(f"  Username: {admin_user.username}")
        print(f"  Email: {admin_user.email}")
        print(f"  ID: {admin_user.id}")
        return True
    
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python backend/create_admin.py <username> <email> <password>")
        print("Example: python backend/create_admin.py admin admin@example.com secretpass123")
        sys.exit(1)
    
    username = sys.argv[1]
    email = sys.argv[2]
    password = sys.argv[3]
    
    if len(password) < 8:
        print("Error: Password must be at least 8 characters long")
        sys.exit(1)
    
    success = create_admin_user(username, email, password)
    sys.exit(0 if success else 1)

