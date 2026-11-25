import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

from conftest import answer, scalar
from geco_bot import config, main
from geco_bot.receipt import build_receipt_pdf

REPO = Path(__file__).resolve().parents[2]
CAFE, HOTEL = -100001, -100006
POSITIVE_CHAT = 555
NEGATIVE_CHAT = -9001
OAT = "DRY-OAT-1L"


def run(coro):
    return asyncio.run(coro)


class FakeBot:
    def __init__(self, fail_times: int = 0):
        self.calls = []
        self.fail_times = fail_times

    async def send_document(self, **kwargs):
        if self.fail_times > 0:
            self.fail_times -= 1
            raise RuntimeError("telegram error")
        self.calls.append(kwargs)


def fake_app(fail_times: int = 0):
    return SimpleNamespace(bot=FakeBot(fail_times=fail_times))


def mark_existing_sent(db):
    with db.pool.connection() as conn:
        conn.execute("update orders set receipt_sent_at = now() where receipt_sent_at is null")


def create_confirmed_order(bot, db, reader, monkeypatch, user_id=CAFE, chat_id=POSITIVE_CHAT, po_number=None):
    answer(
        reader,
        monkeypatch,
        intent="order",
        po_number=po_number,
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 3, "unit": "CTN12", "raw_text": "3 ctn oat milk"}],
    )
    draft = run(bot.on_text(user_id, chat_id, "3 ctn oat milk"))
    reply = run(bot.on_button(user_id, chat_id, "confirm", draft.order_id))
    assert reply.text == main.CONFIRM_REPLIES["confirmed"]
    assert reply.show_receipt_button is True
    return draft.order_id


def test_pdf_contains_ref_and_total():
    order = {
        "id": "12345678-1234-1234-1234-1234567890ab",
        "po_number": "PO-9942",
        "confirmed_at": datetime(2026, 11, 25, 10, 30, tzinfo=timezone.utc),
        "created_at": datetime(2026, 11, 25, 10, 0, tzinfo=timezone.utc),
        "customer_name": "Kap\u00e9 Corner",
        "tier_name": "Cafe",
        "currency": "USD",
        "total": Decimal("142.50"),
        "lines": [
            {
                "sku": "DRY-OAT-1L",
                "product_name": "Oat Milk 1L",
                "quantity": Decimal("5.00"),
                "unit_code": "CTN12",
                "unit_price": Decimal("28.50"),
                "line_total": Decimal("142.50"),
            }
        ],
    }
    pdf_bytes = build_receipt_pdf(order, compress=False)
    assert pdf_bytes.startswith(b"%PDF")
    assert b"PO-9942" in pdf_bytes
    assert b"142.50" in pdf_bytes
    assert b"Kape Corner" in pdf_bytes
    assert b"This is an order confirmation, not a tax invoice" in pdf_bytes


def test_confirmed_order_sent_once(bot, db, reader, monkeypatch):
    mark_existing_sent(db)
    order_id = create_confirmed_order(bot, db, reader, monkeypatch, po_number="PO-ONCE")
    app = fake_app()

    first = run(main.process_receipts(app, db))
    second = run(main.process_receipts(app, db))

    assert first == 1
    assert second == 0
    assert len(app.bot.calls) == 1
    call = app.bot.calls[0]
    assert call["chat_id"] == POSITIVE_CHAT
    assert call["filename"] == "receipt-PO-ONCE.pdf"
    assert call["reply_markup"].inline_keyboard[0][0].callback_data == f"receipt:{order_id}"
    assert scalar(db, "select receipt_sent_at is not null from orders where id = %s", order_id) is True
    assert scalar(
        db,
        "select count(*) from messages m join order_messages om on om.message_id = m.id"
        " where om.order_id = %s and m.direction = 'out' and m.kind = 'file' and m.file_mime = 'application/pdf'",
        order_id,
    ) == 1


def test_backfilled_orders_not_sent(bot, db, reader, monkeypatch):
    order_id = create_confirmed_order(bot, db, reader, monkeypatch, chat_id=POSITIVE_CHAT)
    customer = db.customer_by_telegram_id(CAFE)
    conv_id = db.conversation_id(customer.id, POSITIVE_CHAT)
    fulfilled_id = db.create_draft(
        customer.id,
        conv_id,
        [{"sku": OAT, "quantity": Decimal("1"), "unit_code": "CTN12", "unit_price": Decimal("28.50"), "line_total": Decimal("28.50")}],
        Decimal("28.50"),
    )
    with db.pool.connection() as conn:
        conn.execute("update orders set status = 'fulfilled', confirmed_at = now() where id = %s", (fulfilled_id,))
        conn.execute("alter table orders drop column receipt_sent_at")
        migration_sql = (REPO / "supabase/migrations/20261127000000_receipts.sql").read_text(encoding="utf-8")
        conn.execute(migration_sql)

    app = fake_app()
    sent = run(main.process_receipts(app, db))

    assert sent == 0
    assert app.bot.calls == []
    assert scalar(db, "select receipt_sent_at is not null from orders where id = %s", order_id) is True
    assert scalar(db, "select receipt_sent_at is not null from orders where id = %s", fulfilled_id) is True


def test_failed_send_retries(bot, db, reader, monkeypatch):
    mark_existing_sent(db)
    order_id = create_confirmed_order(bot, db, reader, monkeypatch, chat_id=POSITIVE_CHAT)
    app = fake_app(fail_times=1)

    first = run(main.process_receipts(app, db))
    assert first == 0
    assert app.bot.calls == []
    assert scalar(db, "select receipt_sent_at from orders where id = %s", order_id) is None
    assert scalar(
        db,
        "select count(*) from messages m join order_messages om on om.message_id = m.id"
        " where om.order_id = %s and m.kind = 'file'",
        order_id,
    ) == 0

    second = run(main.process_receipts(app, db))
    assert second == 1
    assert len(app.bot.calls) == 1
    assert scalar(db, "select receipt_sent_at is not null from orders where id = %s", order_id) is True


def test_seeded_negative_chat_id_not_sent_to_telegram(bot, db, reader, monkeypatch):
    mark_existing_sent(db)
    neg_order = create_confirmed_order(bot, db, reader, monkeypatch, user_id=CAFE, chat_id=NEGATIVE_CHAT)
    pos_order = create_confirmed_order(bot, db, reader, monkeypatch, user_id=HOTEL, chat_id=POSITIVE_CHAT)
    app = fake_app()

    sent = run(main.process_receipts(app, db))

    assert sent == 2
    assert len(app.bot.calls) == 1
    assert app.bot.calls[0]["chat_id"] == POSITIVE_CHAT
    assert scalar(db, "select receipt_sent_at is not null from orders where id = %s", neg_order) is True
    assert scalar(db, "select receipt_sent_at is not null from orders where id = %s", pos_order) is True


def test_get_receipt_refuses_other_customer(bot, db, reader, monkeypatch):
    cafe_order = create_confirmed_order(bot, db, reader, monkeypatch, user_id=CAFE, chat_id=POSITIVE_CHAT)

    other = run(bot.on_button(HOTEL, POSITIVE_CHAT, "receipt", cafe_order))
    assert other.text == main.ALREADY_HANDLED
    assert other.document is None

    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 2, "unit": "CTN12", "raw_text": "2 ctn oat milk"}],
    )
    draft = run(bot.on_text(CAFE, POSITIVE_CHAT, "2 ctn oat milk"))
    draft_receipt = run(bot.on_button(CAFE, POSITIVE_CHAT, "receipt", draft.order_id))
    assert draft_receipt.text == main.RECEIPT_UNAVAILABLE
    assert draft_receipt.document is None

    own = run(bot.on_button(CAFE, POSITIVE_CHAT, "receipt", cafe_order))
    assert own.document is not None
    assert own.document.startswith(b"%PDF")
    assert own.file_name == f"receipt-{cafe_order[:8]}.pdf"
    assert scalar(
        db,
        "select count(*) from messages m join order_messages om on om.message_id = m.id"
        " where om.order_id = %s and m.direction = 'out' and m.kind = 'file' and m.file_mime = 'application/pdf'",
        cafe_order,
    ) == 1


def test_config_reads_poll_seconds(monkeypatch):
    monkeypatch.setattr(config, "load_dotenv", lambda _path: None)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://example")
    monkeypatch.delenv("POLL_SECONDS", raising=False)
    assert config.load_settings().poll_seconds == 5.0

    monkeypatch.setenv("POLL_SECONDS", "2.5")
    assert config.load_settings().poll_seconds == 2.5


BLOCKED_CHAT, OK_CHAT = 555, 777


class BlockedChatBot:
    def __init__(self):
        self.calls = []

    async def send_document(self, **kwargs):
        if kwargs["chat_id"] == BLOCKED_CHAT:
            raise RuntimeError("Forbidden: bot was blocked by the user")
        self.calls.append(kwargs)


def test_one_failing_chat_does_not_block_others(bot, db, reader, monkeypatch):
    mark_existing_sent(db)
    blocked = create_confirmed_order(bot, db, reader, monkeypatch, user_id=CAFE, chat_id=BLOCKED_CHAT)
    ok = create_confirmed_order(bot, db, reader, monkeypatch, user_id=HOTEL, chat_id=OK_CHAT)
    app = SimpleNamespace(bot=BlockedChatBot())
    for _ in range(3):
        run(main.process_receipts(app, db))
    assert scalar(db, "select receipt_sent_at is not null from orders where id = %s", ok) is True
    assert [c["chat_id"] for c in app.bot.calls] == [OK_CHAT]
    assert scalar(db, "select receipt_sent_at from orders where id = %s", blocked) is None


def test_pdf_build_error_retries(bot, db, reader, monkeypatch):
    mark_existing_sent(db)
    order_id = create_confirmed_order(bot, db, reader, monkeypatch, chat_id=POSITIVE_CHAT)
    real_build = main.build_receipt_pdf
    attempts = 0

    def flaky_build(order):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("pdf error")
        return real_build(order)

    monkeypatch.setattr(main, "build_receipt_pdf", flaky_build)
    app = fake_app()

    first = run(main.process_receipts(app, db))
    assert first == 0
    assert app.bot.calls == []
    assert scalar(db, "select receipt_sent_at from orders where id = %s", order_id) is None
    assert scalar(
        db,
        "select count(*) from messages m join order_messages om on om.message_id = m.id"
        " where om.order_id = %s and m.kind = 'file'",
        order_id,
    ) == 0

    second = run(main.process_receipts(app, db))
    assert second == 1
    assert len(app.bot.calls) == 1
    assert scalar(db, "select receipt_sent_at is not null from orders where id = %s", order_id) is True
