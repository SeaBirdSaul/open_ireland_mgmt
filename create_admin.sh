#!/bin/bash
# Convenient wrapper to create an admin user inside the backend container
# Usage: ./create_admin.sh <username> <email> <password>

if [ $# -lt 3 ]; then
    echo "Usage: ./create_admin.sh <username> <email> <password>"
    echo "Example: ./create_admin.sh admin admin@example.com SecurePassword123"
    exit 1
fi

docker compose run --rm backend python backend/create_admin.py "$1" "$2" "$3"
