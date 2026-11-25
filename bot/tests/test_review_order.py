from decimal import Decimal

import psycopg
import pytest

from conftest import scalar

HOTEL = -100006
CHAT = 777
OAT = "DRY-OAT-1L"
EGGS = "DRY-EGG-30"


def make_held_order(db, lines: list[tuple[str, Decimal, str, Decimal]], total: Decimal) -> str:
    customer = db.customer_by_telegram_id(HOTEL)
    conv_id = db.conversation_id(customer.id, CHAT)
    order_lines = [
        {
            "sku": sku,
            "quantity": qty,
            "unit_code": unit,
            "unit_price": price,
            "line_total": qty * price,
        }
        for sku, qty, unit, price in lines
    ]
    order_id = db.create_draft(customer.id, conv_id, order_lines, total)
    assert db.confirm(order_id, customer.id, Decimal("2000")) == "held"
    return order_id


def call_review(db, role: str, order_id: str, decision: str) -> str:
    with db.pool.connection() as conn, conn.transaction():
        conn.execute(f"set local role {role}")
        row = conn.execute(
            "select public.review_order(%s, %s) as result",
            (order_id, decision),
        ).fetchone()
    return row["result"]


def test_approve_in_stock_held_order_deducts_once_and_confirms(db):
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    order_id = make_held_order(
        db,
        [(OAT, Decimal("94"), "CTN12", Decimal("25.65"))],
        Decimal("2411.10"),
    )

    first = call_review(db, "authenticated", order_id, "approve")
    second = call_review(db, "authenticated", order_id, "approve")

    assert first == "approved"
    assert second == "handled"
    assert scalar(db, "select status::text from orders where id = %s", order_id) == "confirmed"
    assert scalar(db, "select confirmed_at from orders where id = %s", order_id) is not None
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before - Decimal("94")


def test_approve_short_stock_returns_short_and_changes_nothing(db):
    oat_before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    eggs_before = scalar(db, "select stock_qty from products where sku = %s", EGGS)
    order_id = make_held_order(
        db,
        [
            (OAT, Decimal("10"), "CTN12", Decimal("25.65")),
            (EGGS, Decimal("8"), "TRAY30", Decimal("8.10")),
        ],
        Decimal("321.30"),
    )

    result = call_review(db, "authenticated", order_id, "approve")

    assert result == "short"
    assert scalar(db, "select status::text from orders where id = %s", order_id) == "needs_review"
    assert scalar(db, "select confirmed_at from orders where id = %s", order_id) is None
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == oat_before
    assert scalar(db, "select stock_qty from products where sku = %s", EGGS) == eggs_before


def test_reject_cancels_without_touching_stock_and_second_call_is_handled(db):
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    order_id = make_held_order(
        db,
        [(OAT, Decimal("94"), "CTN12", Decimal("25.65"))],
        Decimal("2411.10"),
    )

    first = call_review(db, "authenticated", order_id, "reject")
    second = call_review(db, "authenticated", order_id, "reject")

    assert first == "rejected"
    assert second == "handled"
    assert scalar(db, "select status::text from orders where id = %s", order_id) == "cancelled"
    assert scalar(db, "select confirmed_at from orders where id = %s", order_id) is None
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before


def test_anon_cannot_execute_review_order(db):
    order_id = make_held_order(
        db,
        [(OAT, Decimal("94"), "CTN12", Decimal("25.65"))],
        Decimal("2411.10"),
    )

    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        call_review(db, "anon", order_id, "approve")

    assert scalar(db, "select status::text from orders where id = %s", order_id) == "needs_review"
