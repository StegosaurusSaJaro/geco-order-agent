import asyncio
from decimal import Decimal

from conftest import answer, scalar
from geco_bot import config, main

TEST_USER = -999001
CHAT = 555
OAT = "DRY-OAT-1L"
EGGS = "DRY-EGG-30"


def run(coro):
    return asyncio.run(coro)


def ensure_test_customer(db):
    if db.customer_by_telegram_id(TEST_USER) is None:
        with db.pool.connection() as conn:
            conn.execute(
                "insert into customers (name, kind, tier_id, telegram_user_id) values (%s, %s, %s, %s)",
                ("Test Hotel", "hotel", 3, TEST_USER),
            )
    return db.customer_by_telegram_id(TEST_USER)


def add_past_order(db, telegram_user_id: int, chat_id: int, sku: str, quantity: int, status: str = "confirmed"):
    customer = ensure_test_customer(db) if telegram_user_id == TEST_USER else db.customer_by_telegram_id(telegram_user_id)
    conv_id = db.conversation_id(customer.id, chat_id)
    price = scalar(db, "select unit_price from tier_prices where sku = %s and tier_id = %s", sku, customer.tier_id)
    qty = Decimal(quantity)
    line_total = qty * price
    order_id = db.create_draft(
        customer.id,
        conv_id,
        [{"sku": sku, "quantity": qty, "unit_code": "CTN12", "unit_price": price, "line_total": line_total}],
        line_total,
    )
    with db.pool.connection() as conn:
        conn.execute("update orders set status = %s where id = %s", (status, order_id))


def test_over_three_times_usual_is_held(bot, db, reader, monkeypatch):
    add_past_order(db, TEST_USER, CHAT, OAT, 5, "confirmed")
    add_past_order(db, TEST_USER, CHAT, OAT, 5, "fulfilled")
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 16, "unit": "CTN12", "raw_text": "16 ctn oat milk"}],
    )
    draft = run(bot.on_text(TEST_USER, CHAT, "16 ctn oat milk"))
    held = run(bot.on_button(TEST_USER, CHAT, "confirm", draft.order_id))

    assert held.text == main.CONFIRM_REPLIES["held"]
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "needs_review"
    assert scalar(db, "select review_reasons from orders where id = %s", draft.order_id) == ["quantity"]
    assert scalar(db, "select confirmed_at from orders where id = %s", draft.order_id) is None
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before


def test_exactly_three_times_confirms(bot, db, reader, monkeypatch):
    add_past_order(db, TEST_USER, CHAT, OAT, 5, "confirmed")
    add_past_order(db, TEST_USER, CHAT, OAT, 5, "fulfilled")
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 15, "unit": "CTN12", "raw_text": "15 ctn oat milk"}],
    )
    draft = run(bot.on_text(TEST_USER, CHAT, "15 ctn oat milk"))
    confirmed = run(bot.on_button(TEST_USER, CHAT, "confirm", draft.order_id))

    assert confirmed.text == main.CONFIRM_REPLIES["confirmed"]
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "confirmed"
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before - 15


def test_one_past_order_not_checked(bot, db, reader, monkeypatch):
    add_past_order(db, TEST_USER, CHAT, OAT, 2, "confirmed")
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 10, "unit": "CTN12", "raw_text": "10 ctn oat milk"}],
    )
    draft = run(bot.on_text(TEST_USER, CHAT, "10 ctn oat milk"))
    confirmed = run(bot.on_button(TEST_USER, CHAT, "confirm", draft.order_id))

    assert confirmed.text == main.CONFIRM_REPLIES["confirmed"]
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "confirmed"
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before - 10


def test_current_order_not_counted_as_history(bot, db, reader, monkeypatch):
    add_past_order(db, TEST_USER, CHAT, OAT, 1, "confirmed")
    add_past_order(db, TEST_USER, CHAT, OAT, 10, "fulfilled")
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 20, "unit": "CTN12", "raw_text": "20 ctn oat milk"}],
    )
    draft = run(bot.on_text(TEST_USER, CHAT, "20 ctn oat milk"))
    held = run(bot.on_button(TEST_USER, CHAT, "confirm", draft.order_id))

    assert held.text == main.CONFIRM_REPLIES["held"]
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "needs_review"
    assert scalar(db, "select review_reasons from orders where id = %s", draft.order_id) == ["quantity"]
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before


def test_over_threshold_and_unusual_quantity_carries_both_reasons(bot, db, reader, monkeypatch):
    add_past_order(db, TEST_USER, CHAT, OAT, 5, "confirmed")
    add_past_order(db, TEST_USER, CHAT, OAT, 5, "fulfilled")
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 94, "unit": "CTN12", "raw_text": "94 ctn oat milk"}],
    )
    draft = run(bot.on_text(TEST_USER, CHAT, "94 ctn oat milk"))
    held = run(bot.on_button(TEST_USER, CHAT, "confirm", draft.order_id))

    assert held.text == main.CONFIRM_REPLIES["held"]
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "needs_review"
    reasons = scalar(db, "select review_reasons from orders where id = %s", draft.order_id)
    assert set(reasons) == {"quantity", "total"}
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before


def test_unusual_quantity_and_short_stock_carries_both_reasons(bot, db, reader, monkeypatch):
    add_past_order(db, TEST_USER, CHAT, OAT, 2, "confirmed")
    add_past_order(db, TEST_USER, CHAT, OAT, 2, "fulfilled")
    oat_before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    eggs_before = scalar(db, "select stock_qty from products where sku = %s", EGGS)
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[
            {"sku": OAT, "quantity": 10, "unit": "CTN12", "raw_text": "10 ctn oat milk"},
            {"sku": EGGS, "quantity": 8, "unit": "TRAY30", "raw_text": "8 trays eggs"},
        ],
    )
    draft = run(bot.on_text(TEST_USER, CHAT, "10 ctn oat milk + 8 trays eggs"))
    held = run(bot.on_button(TEST_USER, CHAT, "confirm", draft.order_id))

    assert held.text == main.CONFIRM_REPLIES["held"]
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "needs_review"
    reasons = scalar(db, "select review_reasons from orders where id = %s", draft.order_id)
    assert set(reasons) == {"quantity", "stock"}
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == oat_before
    assert scalar(db, "select stock_qty from products where sku = %s", EGGS) == eggs_before


def test_config_reads_quantity_settings(monkeypatch):
    monkeypatch.setattr(config, "load_dotenv", lambda _path: None)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://example")
    monkeypatch.delenv("QUANTITY_FACTOR", raising=False)
    monkeypatch.delenv("QUANTITY_MIN_HISTORY", raising=False)
    settings = config.load_settings()
    assert settings.quantity_factor == Decimal("3")
    assert settings.quantity_min_history == 2

    monkeypatch.setenv("QUANTITY_FACTOR", "4.5")
    monkeypatch.setenv("QUANTITY_MIN_HISTORY", "5")
    settings = config.load_settings()
    assert settings.quantity_factor == Decimal("4.5")
    assert settings.quantity_min_history == 5
