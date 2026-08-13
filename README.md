# Open Ireland Lab Scheduler & Inventory Management

A comprehensive lab booking and inventory management system for the Open Ireland Lab (Open Ireland Testbed). This platform enables researchers and administrators to reserve and manage lab equipment, track hardware assets, and maintain a centralized device inventory.

**Status**: ✅ Phase U2 Complete | 🔄 Phase U3 In Planning | 📊 202 Devices Synchronized

---

## Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Features](#features)
  - [Scheduler Features](#scheduler-features)
  - [Inventory Management Features](#inventory-management-features)
  - [Admin Features](#admin-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [Services & URLs](#services--urls)
  - [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
  - [Running Services](#running-services)
  - [Code Changes & Hot Reload](#code-changes--hot-reload)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Recent Updates (Phase U2)](#recent-updates-phase-u2)
- [Implemented Features](#implemented-features)
- [Pending Features & Roadmap](#pending-features--roadmap)
- [Known Issues & Limitations](#known-issues--limitations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Additional Documentation](#additional-documentation)

---

## Overview

The Open Ireland Lab Management System consists of:

| Component | Description |
|-----------|-------------|
| **Scheduler** | Lab booking system for managing device reservations with conflict detection |
| **Inventory Management** | Hardware asset tracking, device lifecycle management, and categorization |
| **Backend API** | FastAPI application serving both scheduler and inventory REST endpoints |
| **Scheduler Frontend** | React-based UI for booking devices and managing reservations |
| **Inventory Frontend** | React-based UI for device inventory and asset management |

---

## Current Status

### 🎯 Project Phase: U2 Complete, U3 Planned

| Component | Status | Notes |
|-----------|--------|-------|
| **Phase U2** | ✅ Complete | Device unification - scheduler uses unified `devices` table |
| **Device Sync** | ✅ 100% | 202/202 devices synchronized between tables |
| **Database** | ✅ Healthy | `provdb_prod` with 202 devices, bookings functional |
| **Backend API** | ✅ Running | All endpoints accessible on port 20001 |
| **Scheduler UI** | ✅ Running | React app accessible on port 25002 |
| **Inventory UI** | ✅ Running | React app accessible on port 25003 |
| **Phase U3** | 🔄 Planned | Migrate booking FK from `device_table` to `devices` |

### 📊 Database health (as of Dec 15, 2025)
- **devices table**: 202 rows
- **device_table (legacy)**: 202 rows  
- **Synchronization**: 100% (202 matching IDs)
- **Maintenance columns**: ✅ Present (maintenance_start, maintenance_end)
- **Bookings**: Functional, LEFT JOIN to devices works correctly

---

## Features

### Scheduler Features

#### User Features
- ✅ User registration and login with session management
- ✅ Single and multi-device booking with visual schedule table
- ✅ Booking conflict detection (max 2 users per device at same time)
- ✅ Personal booking record management (view, cancel, delete)
- ✅ Booking favorites - save and reuse booking configurations
- ✅ Collaborator support - add collaborators to bookings
- ✅ Booking extension and rebooking functionality
- ✅ Fuzzy search for device selection (Fuse.js)
- ✅ Dark/Light mode toggle
- ✅ Discord notifications for booking events

#### Admin Features
- ✅ Admin authentication with secret key
- ✅ Device lifecycle management (CRUD operations)
- ✅ Booking approval/rejection dashboard
- ✅ Full booking history with advanced filters
- ✅ Device maintenance window management
- ✅ Conflict resolution dashboard
- ✅ Priority season toggle
- ✅ PDU (Power Distribution Unit) control panel
- ✅ Admin Control Panel with unified dashboard

### Inventory Management Features

- ✅ Device CRUD operations with full history tracking
- ✅ Device type categorization (ROADM, TeraFlex, Transponder, etc.)
- ✅ Manufacturer management
- ✅ Site/location management (physical rack positions)
- ✅ Tag-based device organization
- ✅ Device status tracking (Available, Maintenance, Unavailable)
- ✅ Serial number and asset ID (oi_id) tracking
- ✅ File attachments for device manuals/documentation
- ✅ Device history audit log
- ✅ Pagination and filtering for large device lists

### Admin Features

- ✅ Unified Admin Dashboard with key metrics
- ✅ Pending approvals overview
- ✅ Conflict management interface
- ✅ Device utilization insights (placeholder)
- ✅ Rules engine (placeholder for future automation)
- ✅ User and role management

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Network                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Scheduler UI   │  │  Inventory UI   │  │  Backend API    │ │
│  │  (React:25002)  │  │  (React:25003)  │  │ (FastAPI:20001) │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │          │
│           └────────────────────┼────────────────────┘          │
│                                │                               │
│                      ┌─────────▼─────────┐                     │
│                      │   MySQL Database  │                     │
│                      │   (provdb_dev)    │                     │
│                      │   @ 10.10.10.4    │                     │
│                      └───────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Python 3.12** | Core programming language |
| **FastAPI** | RESTful API framework |
| **SQLAlchemy 2.0** | ORM for database operations |
| **MySQL/MariaDB** | Production database |
| **Pydantic** | Request/response validation |
| **bcrypt/Passlib** | Password security |
| **APScheduler** | Background task scheduling |
| **Uvicorn** | ASGI server |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **React Router v7** | Client-side routing |
| **Tailwind CSS 3.4** | Utility-first CSS |
| **Zustand** | State management |
| **React Query** | Server state management |
| **Fuse.js** | Fuzzy search |
| **Day.js** | Date/time handling |
| **ReactFlow** | Topology visualization |

### DevOps
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **pytest** | Backend testing |
| **Jest** | Frontend testing |
| **React Testing Library** | Component testing |
| **MSW** | API mocking for tests |

---

## Getting Started

### Prerequisites

- **Docker** (version 20.10 or later)
- **Docker Compose** (version 2.0 or later)
- **MySQL/MariaDB** database server accessible from Docker containers
- Network access to the database host (default: `10.10.10.4:3306`)

### Quick Start with Docker

1. **Clone the repository**:
   ```bash
   git clone https://github.com/agastya-raj/open_ireland_mgmt.git
   cd open_ireland_mgmt
   ```

2. **Configure database connection** (if needed):
   
   Edit `docker-compose.yml` to update the `DATABASE_URL`:
   ```yaml
   environment:
     - DATABASE_URL=mysql+pymysql://username:password@host:3306/provdb_dev
   ```
   Also update the 'DISCORD_BOT_TOKEN', instructions can be found in [DISCORD_SETUP.md](DISCORD_SETUP.md):
   ```yaml
   environment:
     - DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
   ```
   
   > ⚠️ **Important**: Always use `provdb_prod` (development database), never `provdb` (production).

3. **Build and start all services**:
   ```bash
   docker compose build
   docker compose up
   ```

   Or run in detached mode:
   ```bash
   docker compose up -d
   ```

4. **Access the applications**:
   
   | Application | URL |
   |-------------|-----|
   | Scheduler UI | http://localhost:25002 |
   | Inventory UI | http://localhost:25003 |
   | Backend API Docs | http://localhost:20001/docs |

### Services & URLs

| Service | Container Name | Port | URL |
|---------|---------------|------|-----|
| Backend API | `openireland-backend` | 20001 | http://localhost:20001 |
| Scheduler Frontend | `openireland-scheduler-frontend` | 25002 | http://localhost:25002 |
| Inventory Frontend | `openireland-inventory-frontend` | 25003 | http://localhost:25003 |

### Environment Variables

#### Backend Service
| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_PORT` | FastAPI server port | `20001` |
| `FRONTEND_URL` | Scheduler frontend URL | `http://localhost:25002` |
| `DEBUG` | Enable debug mode | `True` |
| `DATABASE_URL` | MySQL connection string | Required |
| `ADMIN_SECRET` | Secret key for admin registration | `""` |
| `DISCORD_WEBHOOK_URL` | Discord notifications webhook | Optional |

#### Frontend Services
| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:20001` |
| `REACT_APP_SCHEDULER_API_URL` | Scheduler API URL | Same as above |
| `PORT` | React dev server port | `3000`/`3001` |

---

## Adding a User/Setting up the first User

### Prerequisites

- A running frontend and backend.
- The Discord ID of the account you wish to link with the Scheduler.
- Said account in a server with the discord bot.

### Adding a basic User to the Scheduler


1. **Open the Scheduler frontend**

   Open the scheduler UI at `http://localhost:25002` (the backend API runs at `http://localhost:20001` — API docs are available at `http://localhost:20001/docs`).

2. **Register an account**

   Click the **REGISTER** button and complete the account form. Ensure the email and Discord ID are correct — these are used for authentication and notifications.

3. **Enter the verification token**

   After registering, an authentication token is sent by the Discord bot (usually via DM). Enter that token on the registration confirmation / verification page in the scheduler UI to activate the account. If you do not receive a token, check the bot setup in [DISCORD_SETUP.md](DISCORD_SETUP.md) and verify the bot can DM the user.

   If the UI does not show a verification field, look for a link or prompt in the registration flow labelled "Enter verification token" or similar.

### Setting up the initial admin user (manual DB example)

> Note: Prefer granting admin privileges through the admin UI when available. Only use direct DB updates on a development or staging database, and never perform manual edits on a production database without a backup and explicit approval.

1. **Log into MySQL** (example)

```bash
mysql -u <username> -p -h <host> provdb_dev
# or: mysql -u <username> -p
# then: USE provdb_dev;
```

2. **Verify the user record**

Use a targeted `SELECT` rather than `SELECT *` to inspect the relevant fields:

```sql
SELECT id, username, email, discord_id, status, role, is_admin
FROM provdb_dev.user_table
WHERE id = <userID>;
```

Example output (column names may vary depending on your schema):

| id | username | firstName | lastName | email | discord_id | status | role |
|----|----------|-----------|----------|-------|------------|--------|------|
| 1  | jsmith   | John      | Smith    | ...   | 123456789  | active | viewer 

3. **Update role (two common schema variations)**

- If your table uses a `role` column:

```sql
UPDATE provdb_dev.user_table
SET role = 'admin'
WHERE id = <userID>;
```

4. **Verify the change**

```sql
SELECT id, username, role, is_admin FROM provdb_dev.user_table WHERE id = <userID>;
```

### Safety and audit notes

- Do not perform manual changes directly on the production database. Use a development or staging instance (for example: `provdb_dev`) and ensure you have a recent backup before applying changes.
- Prefer the admin console or an authenticated API endpoint to change roles; direct SQL updates circumvent application-level auditing.
- Record any manual changes in your deployment or ops logs for auditability.

### Results

After granting the admin role (via the admin UI or the DB update above), the user will have access to the Admin Console and can manage bookings and user roles through the application UI instead of manual DB edits.

---

## Development Workflow

### Running Services

```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f backend

# Stop all services
docker compose down

# Rebuild after changes
docker compose up --build
```

### Code Changes & Hot Reload

The Docker setup includes volume mounts for live code reloading:

- **Backend**: Python file changes trigger uvicorn auto-reload
- **Frontends**: React dev servers watch for changes and hot-reload

#### Running Individual Services

```bash
# Backend only
docker compose up backend

# Scheduler frontend only (requires backend)
docker compose up scheduler-frontend

# Inventory frontend only (requires backend)
docker compose up inventory-frontend
```

---

## Database Schema

### Core Tables

#### User Table (`user_table`)
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Primary Key |
| `username` | VARCHAR(50) | Unique username |
| `email` | VARCHAR(100) | Email address |
| `password` | VARCHAR(100) | Hashed password |
| `is_admin` | BOOLEAN | Admin privileges flag |
| `discord_id` | VARCHAR(20) | Discord user ID for notifications |

#### Device Tables

**⚠️ IMPORTANT**: Phase U2 unified the device models. The scheduler now uses the `devices` table as primary source of truth. The legacy `device_table` is kept in sync but will be deprecated in Phase U3.

**Primary Device Table (`devices`)** - Current source of truth for scheduler
| Column | Type | Description | Phase U2 Status |
|--------|------|-------------|-----------------|
| `id` | INT | Primary Key | Used by scheduler (U2) |
| `oi_id` | VARCHAR(50) | Open Ireland asset ID | ✅ |
| `name` | VARCHAR(200) | Device name | ✅ |
| `device_type_id` | INT | FK to device_types | ✅ |
| `manufacturer_id` | INT | FK to manufacturers | ✅ |
| `model` | VARCHAR(100) | Device model | ✅ |
| `serial_number` | VARCHAR(100) | Unique serial | ✅ |
| `status` | VARCHAR(50) | Device status (Available/Maintenance/Unavailable) | ✅ Fixed in U2 |
| `site_id` | INT | FK to sites | ✅ |
| `rack` | VARCHAR(50) | Rack location | ✅ |
| `u_position` | INT | Rack unit position | ✅ |
| `hostname` | VARCHAR(100) | Network hostname | ✅ |
| `mgmt_ip` | VARCHAR(50) | Management IP | ✅ |
| `polatis_name` | VARCHAR(100) | Polatis switch reference | ✅ |
| `maintenance_start` | VARCHAR(100) | Maintenance window start | ✅ Added in U2 |
| `maintenance_end` | VARCHAR(100) | Maintenance window end | ✅ Added in U2 |
| `notes` | TEXT | Additional notes | ✅ |

**Legacy Device Table (`device_table`)** - For backward compatibility, will be removed in Phase U3
| Column | Type | Description | Status |
|--------|------|-------------|--------|
| `id` | INT | Primary Key | Synchronized with devices |
| `deviceType` | VARCHAR(50) | Type of device | Legacy |
| `deviceName` | VARCHAR(50) | Device name | Legacy |
| `ip_address` | VARCHAR(50) | Management IP | Legacy |
| `status` | VARCHAR(50) | Device status | Kept in sync |
| `maintenance_start` | VARCHAR(100) | Maintenance window start | Synchronized in U2 |
| `maintenance_end` | VARCHAR(100) | Maintenance window end | Synchronized in U2 |
| `Out_Port` / `In_Port` | INT | Polatis switch ports | Legacy |

**Phase U3 Plan**: Migrate `Booking.device_id` FK from `device_table` to `devices`, then remove `device_table` entirely.

#### Booking Table (`booking_table`)
| Column | Type | Description |
|--------|------|-------------|
| `booking_id` | INT | Primary Key |
| `device_id` | INT | FK to device_table |
| `user_id` | INT | FK to user_table |
| `grouped_booking_id` | VARCHAR(64) | UUID for multi-device bookings |
| `start_time` | DATETIME | Booking start |
| `end_time` | DATETIME | Booking end |
| `status` | VARCHAR(50) | PENDING/CONFIRMED/CANCELLED/EXPIRED |
| `comment` | TEXT | User comments |
| `collaborators` | JSON | List of collaborator usernames |
| `is_collaborator` | BOOLEAN | Collaborator booking flag |

#### Supporting Tables
- `device_types` - Device type definitions with scheduling flags
- `manufacturers` - Manufacturer information
- `sites` - Physical locations
- `tags` - Device categorization tags
- `inventory_device_tags` - Device-tag associations
- `device_history` - Audit log for device changes
- `booking_favorite` - Saved booking configurations

---

## API Documentation

### Base URLs
- **Scheduler API**: `http://localhost:20001/api/`
- **Inventory API**: `http://localhost:20001/api/inventory/`
- **Admin API**: `http://localhost:20001/admin/`
- **Interactive Docs**: `http://localhost:20001/docs`

### Key Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | User registration |
| POST | `/login` | User login |
| GET | `/check-session` | Verify session |
| POST | `/logout` | User logout |

#### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bookings` | Create booking(s) |
| GET | `/bookings?user_id=X` | Get user's bookings |
| DELETE | `/bookings/{id}` | Cancel booking |
| PUT | `/bookings/{id}/extend` | Extend booking |
| PUT | `/bookings/{id}/rebook` | Rebook to new time |

#### Devices (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/devices` | List all devices |
| POST | `/admin/devices` | Create device |
| PUT | `/admin/devices/{id}` | Update device |
| DELETE | `/admin/devices/{id}` | Delete device |

#### Inventory Devices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/devices` | List devices (paginated) |
| POST | `/api/inventory/devices` | Create device |
| GET | `/api/inventory/devices/{id}` | Get device details |
| PUT | `/api/inventory/devices/{id}` | Update device |
| DELETE | `/api/inventory/devices/{id}` | Delete device |
| GET | `/api/inventory/device-types` | List device types |
| GET | `/api/inventory/manufacturers` | List manufacturers |
| GET | `/api/inventory/sites` | List sites |
| GET | `/api/inventory/tags` | List tags |

---

## Testing

### Running Tests

#### Docker-Based Testing (Recommended)
```bash
./scheduler/run-tests-docker.sh
```

#### Local Testing

**Backend Tests:**
```bash
cd backend
pip install -r requirements.txt
pytest -v

# With coverage
pytest --cov=. --cov-report=html

# Specific test file
pytest tests/test_auth.py

# Specific test
pytest tests/test_auth.py::test_user_login_success
```

**Frontend Tests:**
```bash
cd scheduler/frontend
npm install
npm test

# CI mode (no watch)
npm run test:ci

# With coverage
npm run test:coverage
```

### Test Coverage

#### Backend Test Files
| File | Coverage Area |
|------|---------------|
| `test_auth.py` | User authentication |
| `test_admin_auth.py` | Admin authentication |
| `test_bookings.py` | Booking CRUD |
| `test_conflicts.py` | Conflict detection |
| `test_devices.py` | Device management |
| `test_approval.py` | Approval workflow |
| `test_pdu.py` | PDU control |
| `test_inventory_api.py` | Inventory endpoints |

#### Safety Features
- Tests use in-memory SQLite database (never production)
- Production database protection built-in
- Each test gets isolated database state

---

## Project Structure

```
open_ireland_mgmt/
├── backend/                    # FastAPI Backend
│   ├── main.py                 # Application entry point
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Backend container
│   ├── core/                   # Core utilities
│   │   ├── database.py         # Database connection
│   │   ├── deps.py             # Dependency injection
│   │   ├── hash.py             # Password hashing
│   │   └── discord_utils.py    # Discord notifications
│   ├── scheduler/              # Scheduler module
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── schemas.py          # Pydantic schemas
│   │   ├── routers/            # API routes
│   │   │   ├── admin.py        # Admin endpoints
│   │   │   ├── admin_debug.py  # Debug endpoints
│   │   │   └── control_panel.py# PDU control
│   │   └── services/           # Business logic
│   │       ├── topology_resolver.py
│   │       └── recommendation_engine.py
│   ├── inventory/              # Inventory module
│   │   ├── models.py           # Inventory models
│   │   ├── schemas.py          # Inventory schemas
│   │   └── router.py           # Inventory API
│   └── tests/                  # Backend tests
│       ├── conftest.py         # Test fixtures
│       └── test_*.py           # Test files
├── scheduler/
│   └── frontend/               # Scheduler React App
│       ├── package.json
│       ├── Dockerfile
│       └── src/
│           ├── admin/          # Admin components
│           ├── adminv2/        # New admin UI
│           ├── client/         # User components
│           ├── components/     # Shared components
│           ├── services/       # API services
│           └── store/          # Zustand stores
├── inventory/
│   └── frontend/               # Inventory React App
│       ├── package.json
│       ├── Dockerfile
│       └── src/
│           ├── routes/         # Page components
│           ├── components/     # UI components
│           └── api/            # API client
├── packages/
│   └── ui/                     # Shared UI components
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
├── docker-compose.yml          # Docker orchestration
└── README.md                   # This file
```

---

## Recent Updates (Phase U2)

### ✅ Phase U2 Completion Summary (December 2025)

Phase U2 successfully unified device management in the scheduler. The scheduler now uses the `InventoryDevice` model (`devices` table) as the primary source of truth instead of the legacy `Device` model (`device_table`).

#### What Was Accomplished

**Database Migration**:
- Added `maintenance_start` and `maintenance_end` columns to `devices` table (VARCHAR 100, NULL)
- Verified 100% synchronization: 202/202 devices matching between `devices` and `device_table`
- Status column fixed to use scheduler values directly ("Available", "Maintenance", "Unavailable")

**Code Changes**:
- Fixed critical status mapping bug (reverted from `@property` to real DB column)
- Fixed deviceType setter with validation (prevents auto-creation of invalid types)
- Rewrote 11 device type filter queries with proper JOIN patterns
- Migrated scheduler modules:
  - `routers/admin.py`: Updated to use `InventoryDevice`, 11 query rewrites
  - `services/topology_resolver.py`: Added eager loading with joinedload
  - `services/recommendation_engine.py`: Updated imports

**Testing**:
- Created comprehensive test suite: `tests/inventory/test_scheduler_compatibility.py` (14 tests)
- Covers properties, queries, status mapping, serialization
- Test suite ready but cannot execute in container due to import path issues (U3.5 target)

**Backward Compatibility**:
- ✅ All API contracts preserved (no endpoint changes)
- ✅ Frontend requires no changes
- ✅ All legacy field names (deviceName, deviceType, etc.) work via ORM properties
- ✅ Status values preserved

#### Files Modified in U2

| File | Changes | Lines |
|------|---------|-------|
| `backend/inventory/models.py` | Status fix, deviceType validation | 140, 208-227 |
| `backend/scheduler/routers/admin.py` | InventoryDevice import, 11 query rewrites | 1-246 |
| `backend/scheduler/services/topology_resolver.py` | Import, eager loading | 11-44 |
| `backend/scheduler/services/recommendation_engine.py` | Import update | 11-16 |
| `tests/inventory/test_scheduler_compatibility.py` | NEW - comprehensive validation | 263 lines |
| `pytest.ini` | NEW - pytest configuration | - |
| Database: `devices` table | 2 columns added | maintenance_* |

**Total**: 6 files modified/created, 2 DB columns added, ~500 lines changed

---

## Implemented Features

### Phase U2 (Device Unification) - ✅ Complete
- Scheduler uses unified `devices` table
- 100% device synchronization (202 devices)
- 11 queries rewritten with proper JOINs
- Maintenance columns working correctly
- Eager loading for performance optimization
- Full backward API compatibility maintained

### Scheduler Core - ✅ Complete
- User registration/login with session management
- Multi-device booking with visual schedule
- Booking conflict detection (max 2 users per device)
- Booking approval/rejection workflow
- Maintenance window management
- Discord notifications for booking events
- PDU control integration
- Admin dashboard with key metrics

### Inventory Management - ✅ Complete
- Device CRUD with full history tracking
- Device type/manufacturer/site management
- Tag-based device organization
- Status tracking (Available, Maintenance, Unavailable)
- Serial number and asset ID (oi_id) tracking
- Pagination and filtering for large device lists
- Admin utilities for device discovery and validation

---

## Pending Features & Roadmap

### 🔴 Phase U3 (FK Migration) - CRITICAL PRIORITY

**Target**: Complete before next database deployment

**Objectives**:
1. [ ] Migrate `Booking.device_id` FK from `device_table.id` to `devices.id`
2. [ ] Update `scheduler/models.py` to reference `devices` table
3. [ ] Remove legacy `Device` model from scheduler (use `InventoryDevice` only)
4. [ ] Delete `device_table` after comprehensive validation
5. [ ] Update API documentation
6. [ ] Update architecture diagrams

**Status**: In planning phase

**Impact**: Eliminates split device table architecture, ensures new devices immediately available to scheduler

---

### 🟡 Phase U3.5 (Bug Fixes)

1. [ ] **Fix test suite autoimport** - Resolve import path issues in container environment
2. [ ] **Implement file attachments** - Add `DeviceAttachment` model and endpoints
3. [ ] **Enhance error handling** - Better error messages for device lifecycle

**Estimated scope**: 2-3 development days

- [ ] Rules engine for booking automation
- [ ] Utilization analytics and reporting dashboard
- [ ] Email notifications (in addition to Discord)
- [ ] Calendar integration (iCal export for bookings)
- [ ] Mobile-responsive UI improvements
- [ ] Advanced filtering and search in admin panel
- [ ] Audit log viewer in admin UI
- [ ] Webhook support for external integrations
- [ ] Multi-language support
- [ ] API key authentication for programmatic access

---

## Known Issues & Limitations

### Critical Issues (Phase U3 Priority)

| Issue | Impact | Status | Priority |
|-------|--------|--------|----------|
| **Split Device Tables** | New devices created via admin don't appear in scheduler | Active | 🔴 CRITICAL |
| **Dual Device References** | `Booking` model references legacy `device_table` instead of unified `devices` | Active | 🔴 CRITICAL |

**Explanation of Split Device Tables**:
- Admin uses `devices` table (source: `InventoryDevice` model)
- Scheduler uses legacy `device_table` (source: `Device` model)
- While IDs are 100% synchronized (202/202), new devices created via admin are **NOT written to `device_table`**
- This means new devices can be registered in inventory but cannot be booked
- **Solution**: Phase U3 will migrate `Booking.device_id` FK to reference `devices` table and deprecate `device_table`

### Current Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| **File Attachments** | 🔄 Planned | Device manual uploads not yet implemented |
| **Automated Tests** | ⚠️ Partial | Test suite exists but import path issues prevent execution in container |
| **Rules Engine** | 🔄 Planned | Automated booking rules not implemented |
| **API Rate Limiting** | ❌ Not Implemented | No rate limiting on endpoints |
| **Email Notifications** | ❌ Not Implemented | Only Discord notifications available |

### Database Considerations

⚠️ **Important Database Notes:**
- Always use `provdb_prod` (production) database
- Never point to `provdb` in development
- Database is external (not containerized)
- Tables auto-create on startup (idempotent via `Base.metadata.create_all()`)
- Maintenance columns (`maintenance_start`, `maintenance_end`) exist in both `devices` and `device_table`

---

## Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check if ports are in use
lsof -i :20001
lsof -i :25002
lsof -i :25003

# Check Docker daemon is running
docker ps

# Verify Docker Compose version
docker compose version

# View service logs
docker compose logs backend
docker compose logs scheduler-frontend
docker compose logs inventory-frontend

# Try clean rebuild
docker compose down
docker compose up --build
```

#### Frontend Can't Reach Backend
1. Verify backend is running: `docker compose ps`
2. Check backend logs: `docker compose logs backend`
3. Verify `REACT_APP_API_URL` environment variable is set correctly
4. Check CORS settings in `backend/main.py`
5. Make sure port 20001 is accessible from frontend container

**Network Debugging**:
```bash
# From within frontend container
docker compose exec scheduler-frontend curl http://localhost:20001/

# Check if backend is actually listening
docker compose exec backend netstat -tlnp | grep 20001
```

#### Database Connection Errors
```bash
# 1. Verify DATABASE_URL is correctly set
docker compose config | grep DATABASE_URL

# 2. Check if database is accessible from Docker
docker compose exec backend ping 10.10.10.4
docker compose exec backend nc -zv 10.10.10.4 3306

# 3. Verify credentials
# Try manually connecting with provided credentials:
mysql -h 10.10.10.4 -u openireland -p -D provdb_dev
```

**Common Database Issues**:
- ❌ Using `provdb` (production) instead of `provdb_dev` (development)
- ❌ Database host unreachable (network/firewall issue)
- ❌ Incorrect credentials in `DATABASE_URL`
- ❌ MySQL server not running on destination host

#### Code Changes Not Reflecting
1. Verify volume mounts in `docker-compose.yml` (should mount source directories)
2. Backend: uvicorn should auto-reload on change (check logs for reload message)
3. Frontend: React dev server should hot-reload (check browser console)
4. If changes still not showing, try:
   ```bash
   docker compose restart backend
   docker compose restart scheduler-frontend
   ```
5. Last resort: `docker compose down && docker compose up --build`

#### Test Suite Failures

**Import Path Issues**:
```bash
# Tests cannot run in container due to import path issues
# Expected error: ModuleNotFoundError or ImportError when running pytest

# Workaround: Run tests locally with Python virtual environment
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest -v
```

**Database Issues in Tests**:
- Tests use in-memory SQLite (never production DB)
- If test database creation fails, check conftest.py setup
- Verify all models are imported in conftest.py

---

### Common Issues (General)

#### 404 on API Endpoints
1. Check if routes are mounted correctly in `backend/main.py`
2. Verify router imports aren't failing (see Backend 404 Errors section above)
3. Check backend startup logs for errors
4. Access `/docs` endpoint to see available routes
5. Note: If `/docs` returns 404, it's likely a startup issue

#### Port Already in Use
```bash
# Kill process on port
kill -9 $(lsof -t -i :20001)
kill -9 $(lsof -t -i :25002)
kill -9 $(lsof -t -i :25003)

# Or let Docker handle it
docker compose down
docker system prune -f
```

#### Slow Performance or Memory Issues
```bash
# Check container resource usage
docker stats

# Check disk space
df -h

# Clean up Docker resources
docker system prune -a
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally
4. Run tests: `./scheduler/run-tests-docker.sh`
5. Commit: `git commit -am 'Add my feature'`
6. Push: `git push origin feature/my-feature`
7. Create a Pull Request

### Code Style
- Backend: Follow PEP 8 guidelines
- Frontend: ESLint + Prettier
- Use meaningful commit messages
- Add tests for new features

---

## Additional Documentation

### Project Documentation

| Document | Location | Description | Last Updated |
|----------|----------|-------------|--------------|
| **Scheduler Guide** | [scheduler/README.md](scheduler/README.md) | Detailed scheduler architecture and features | 2025 |
| **Testing Guide** | [backend/tests/README.md](backend/tests/README.md) | Backend test suite documentation | 2025 |
| **Admin UI Guide** | [docs/admin_ui.md](docs/admin_ui.md) | Admin interface features and usage | 2025 |

### Phase Reports & Progress

| Document | Location | Description | Scope |
|----------|----------|-------------|-------|
| **Phase U2 Final Report** | [docs/U2_FINAL_REPORT.md](docs/U2_FINAL_REPORT.md) | Complete U2 device unification details | Database migration, code changes, test suite |
| **Current State Report** | [docs/CURRENT_STATE_REPORT_DECEMBER_15.md](docs/CURRENT_STATE_REPORT_DECEMBER_15.md) | Infrastructure status and pending actions | Services, database, Phase U3 plan |
| **U2 Verification Results** | [docs/U2_verification_results.md](docs/U2_verification_results.md) | Verification and testing results | Device sync, query compatibility |
| **U2 Stability Report** | [docs/U2_stability_pass_report.md](docs/U2_stability_pass_report.md) | Stability verification report | Performance, reliability |
| **U1.5 Compatibility Audit** | [docs/U1.5_compatibility_audit.md](docs/U1.5_compatibility_audit.md) | Compatibility assessment | API, schema, backward compatibility |

### Architecture & Design

| Document | Purpose |
|----------|---------|
| [docs/device_unification_audit.md](docs/device_unification_audit.md) | Device model architecture analysis |

### Quick Start References

- **API Documentation**: http://localhost:20001/docs (Interactive Swagger UI)
- **Scheduler Frontend**: http://localhost:25002
- **Inventory Frontend**: http://localhost:25003
- **Backend Health**: `curl http://localhost:20001/health`

---

*Last updated: April 2026*
*Phase Status: U2 Complete, U3 Planning*
*Backend Port: 20001 (Host Networking)*
*Phase Status: U2 Complete, U3 Planning*