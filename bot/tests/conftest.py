import os
import shutil
import socket
import subprocess
import tempfile
import uuid
from pathlib import Path

import psycopg
import pytest

from geco_bot.db import Database
from geco_bot.main import OrderBot
from geco_bot.reader import Reader

REPO = Path(__file__).resolve().parents[2]
PG_BIN = Path(os.environ.get("PG_BIN", r"C:\Program Files\PostgreSQL\18\bin"))
SQL_FILES = [
    "supabase/tests/stubs.sql",
    "supabase/migrations/20261123000000_init.sql",
    "supabase/migrations/20261124000000_staff_order_message_links.sql",
    "supabase/migrations/20261124000100_product_stock.sql",
    "supabase/migrations/20261125000000_review_order.sql",
    "supabase/migrations/20261126000000_realtime.sql",
    "supabase/seed.sql",
    "supabase/stock.sql",
]
TEMPLATE_DB = "geco_template"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def server():
    temp = Path(tempfile.mkdtemp())
    data = temp / "data"
    port = free_port()
    subprocess.run([PG_BIN / "initdb", "-D", data, "-U", "postgres", "-A", "trust", "--encoding=UTF8", "--locale=C"],
                   check=True, capture_output=True)
    subprocess.run([PG_BIN / "pg_ctl", "-D", data, "-l", temp / "pg.log", "-o", f"-p {port} -h 127.0.0.1", "-w", "start"],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)
    base = f"postgresql://postgres@127.0.0.1:{port}"
    try:
        with psycopg.connect(f"{base}/postgres", autocommit=True) as conn:
            conn.execute(f"create database {TEMPLATE_DB}")
        for rel in SQL_FILES:
            subprocess.run([PG_BIN / "psql", f"{base}/{TEMPLATE_DB}", "-v", "ON_ERROR_STOP=1", "-q", "-f", REPO / rel],
                           check=True, capture_output=True)
        yield base
    finally:
        subprocess.run([PG_BIN / "pg_ctl", "-D", data, "-m", "immediate", "-w", "stop"], capture_output=True)
        shutil.rmtree(temp, ignore_errors=True)


@pytest.fixture
def db(server):
    name = "t_" + uuid.uuid4().hex[:12]
    with psycopg.connect(f"{server}/postgres", autocommit=True) as conn:
        conn.execute(f"create database {name} template {TEMPLATE_DB}")
    database = Database(f"{server}/{name}")
    yield database
    database.close()


@pytest.fixture
def reader(db):
    return Reader(db.catalog(), db.unit_codes(), "primary-model", "fallback-model")


@pytest.fixture
def bot(db, reader):
    return OrderBot(db, reader)


def answer(reader, monkeypatch, **fields):
    output = reader.schema.model_validate({"po_number": None, "lines": [], "reply": "", **fields})

    async def fake_run(_model, _prompt):
        return output

    monkeypatch.setattr(reader, "run_agent", fake_run)


def scalar(db, sql, *params):
    with db.pool.connection() as conn:
        row = conn.execute(sql, params).fetchone()
    return next(iter(row.values()))
