'''
Test database connections, operations and other interactions.
'''
import pytest
from sqlalchemy import create_engine, Column, Integer, MetaData, String, Table, text, select, inspect
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from sqlalchemy.orm import sessionmaker
from backend.core.database import Base
from backend.scheduler import models


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database

    Outputs:
    - Tuple of (test_user_table, test_device_table, metadata)

    Use:
    - Defines and creates two ad-hoc test tables for DB interaction tests.
'''
def _create_test_tables(db_session):
    metadata = MetaData()

    table_users = Table(
        "test_user_table",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("email", String(100), nullable=False, unique=True),
        Column("name", String(50), nullable=False),
    )

    table_devices = Table(
        "test_device_table",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("serial", String(50), nullable=False),
        Column("tag", String(50), nullable=False),
        Column("location", String(100), nullable=False),
        Column("status", String(50), nullable=False),
    )

    metadata.create_all(db_session.bind)
    return table_users, table_devices, metadata


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database

    Outputs:
    - Yields (test_user_table, test_device_table, metadata)

    Use:
    - Ensures core tables exist, creates test tables, and drops them after tests.
'''
@pytest.fixture
def test_tables(db_session):
    inspector = inspect(db_session.bind)
    assert "user_table" in inspector.get_table_names()
    assert "device_table" in inspector.get_table_names()

    table_users, table_devices, metadata = _create_test_tables(db_session)
    try:
        yield table_users, table_devices, metadata
    finally:
        metadata.drop_all(db_session.bind)


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database

    Outputs:
    - None

    Use:
    - Verifies a basic DB connection by running a simple SELECT.
'''
def test_database_connection(db_session):
    result = db_session.execute(text("SELECT 1")).scalar_one()
    assert result == 1


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database
    - test_tables: Fixture providing test tables

    Outputs:
    - None

    Use:
    - Confirms the test tables are created after core tables.
'''
def test_create_test_tables_after_core_tables(db_session, test_tables):
    inspector = inspect(db_session.bind)
    assert "test_user_table" in inspector.get_table_names()
    assert "test_device_table" in inspector.get_table_names()


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database
    - test_tables: Fixture providing test tables

    Outputs:
    - None

    Use:
    - Inserts rows into both test tables and verifies they were created.
'''
def test_test_tables_insert(db_session, test_tables):
    table_users, table_devices, _ = test_tables

    db_session.execute(
        table_users.insert().values(email="a@example.com", name="Alice")
    )
    db_session.execute(
        table_users.insert().values(email="b@example.com", name="Bob")
    )
    db_session.execute(
        table_devices.insert().values(
            serial="SN-001", tag="edge", location="Dublin", status="active"
        )
    )
    db_session.execute(
        table_devices.insert().values(
            serial="SN-002", tag="core", location="Galway", status="inactive"
        )
    )
    db_session.commit()

    users = db_session.execute(select(table_users)).all()
    devices = db_session.execute(select(table_devices)).all()
    assert len(users) == 2
    assert len(devices) == 2


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database
    - test_tables: Fixture providing test tables

    Outputs:
    - None

    Use:
    - Updates existing rows in both test tables and verifies changes.
'''
def test_test_tables_update(db_session, test_tables):
    table_users, table_devices, _ = test_tables

    db_session.execute(
        table_users.insert().values(email="a@example.com", name="Alice")
    )
    db_session.execute(
        table_devices.insert().values(
            serial="SN-002", tag="core", location="Galway", status="inactive"
        )
    )
    db_session.commit()

    db_session.execute(
        table_users.update().where(table_users.c.email == "a@example.com").values(
            name="Alice Updated"
        )
    )
    db_session.execute(
        table_devices.update().where(table_devices.c.serial == "SN-002").values(
            status="active"
        )
    )
    db_session.commit()

    user_row = db_session.execute(
        select(table_users).where(table_users.c.email == "a@example.com")
    ).first()
    device_row = db_session.execute(
        select(table_devices).where(table_devices.c.serial == "SN-002")
    ).first()
    assert user_row is not None
    assert user_row._mapping["name"] == "Alice Updated"
    assert device_row is not None
    assert device_row._mapping["status"] == "active"


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database
    - test_tables: Fixture providing test tables

    Outputs:
    - None

    Use:
    - Searches the test tables by specific criteria and validates results.
'''
def test_test_tables_search(db_session, test_tables):
    table_users, table_devices, _ = test_tables

    db_session.execute(
        table_users.insert().values(email="a@example.com", name="Alice Updated")
    )
    db_session.execute(
        table_devices.insert().values(
            serial="SN-001", tag="edge", location="Dublin", status="active"
        )
    )
    db_session.execute(
        table_devices.insert().values(
            serial="SN-002", tag="core", location="Galway", status="active"
        )
    )
    db_session.commit()

    user_row = db_session.execute(
        select(table_users).where(table_users.c.name == "Alice Updated")
    ).first()
    device_rows = db_session.execute(
        select(table_devices).where(table_devices.c.status == "active")
    ).all()

    assert user_row is not None
    assert user_row._mapping["email"] == "a@example.com"
    assert len(device_rows) == 2


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database
    - test_tables: Fixture providing test tables

    Outputs:
    - None

    Use:
    - Deletes rows from both test tables and confirms removal.
'''
def test_test_tables_delete(db_session, test_tables):
    table_users, table_devices, _ = test_tables

    db_session.execute(
        table_users.insert().values(email="a@example.com", name="Alice")
    )
    db_session.execute(
        table_users.insert().values(email="b@example.com", name="Bob")
    )
    db_session.execute(
        table_devices.insert().values(
            serial="SN-001", tag="edge", location="Dublin", status="active"
        )
    )
    db_session.execute(
        table_devices.insert().values(
            serial="SN-002", tag="core", location="Galway", status="inactive"
        )
    )
    db_session.commit()

    db_session.execute(
        table_users.delete().where(table_users.c.email == "b@example.com")
    )
    db_session.execute(
        table_devices.delete().where(table_devices.c.serial == "SN-001")
    )
    db_session.commit()

    remaining_users = db_session.execute(select(table_users)).all()
    remaining_devices = db_session.execute(select(table_devices)).all()
    assert len(remaining_users) == 1
    assert len(remaining_devices) == 1


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database
    - test_tables: Fixture providing test tables

    Outputs:
    - None

    Use:
    - Attempts to insert duplicate entries to validate constraint handling.
'''
def test_duplicate_entries_handling(db_session, test_tables):
    table_users, _, _ = test_tables

    db_session.execute(
        table_users.insert().values(email="dup@example.com", name="Dup User")
    )
    db_session.commit()

    with pytest.raises(IntegrityError):
        db_session.execute(
            table_users.insert().values(email="dup@example.com", name="Dup User 2")
        )
        db_session.commit()

    db_session.rollback()


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database
    - test_tables: Fixture providing test tables

    Outputs:
    - None

    Use:
    - Attempts to create a duplicate table to confirm DB error behavior.
'''
def test_duplicate_table_creation(db_session, test_tables):
    table_users, _, _ = test_tables

    with pytest.raises((OperationalError, SQLAlchemyError)):
        table_users.create(db_session.bind, checkfirst=False)


'''
    Parameters:
    - db_session: SQLAlchemy session bound to the test database
    - test_tables: Fixture providing test tables

    Outputs:
    - None

    Use:
    - Deletes rows across core and test tables and verifies cleanup.
'''
def test_delete_rows_from_all_tables(db_session, test_tables):
    table_users, table_devices, _ = test_tables

    user = models.User(
        username="delete_user",
        email="delete_user@example.com",
        password="hashed",
        is_admin=False,
    )
    device = models.Device(
        deviceType="Switch",
        deviceName="Switch1",
        ip_address="10.0.0.1",
        status="Available",
        Out_Port=1,
        In_Port=1,
    )
    db_session.add(user)
    db_session.add(device)
    db_session.commit()

    db_session.execute(
        table_users.insert().values(email="delete@example.com", name="Temp")
    )
    db_session.execute(
        table_devices.insert().values(
            serial="DEL-001", tag="temp", location="Cork", status="active"
        )
    )
    db_session.commit()

    db_session.delete(user)
    db_session.delete(device)
    db_session.execute(table_users.delete())
    db_session.execute(table_devices.delete())
    db_session.commit()

    assert db_session.query(models.User).count() == 0
    assert db_session.query(models.Device).count() == 0
    assert db_session.execute(select(table_users)).first() is None
    assert db_session.execute(select(table_devices)).first() is None


