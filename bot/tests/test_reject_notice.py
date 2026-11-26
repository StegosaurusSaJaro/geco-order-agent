import asyncio
from decimal import Decimal
from types import SimpleNamespace

from conftest import answer, scalar
from geco_bot import main
from geco_bot.receipt import order_ref

CAFE = -100001
HOTEL = -100006
CHAT = 777
OAT = "DRY-OAT-1L"


def run(coro):
    return asyncio.run(coro)


class FakeBot:
    def __init__(self, fail_times: int = 0):
        self.calls = []
        self.fail_times = fail_times

    async def send_message(self, **kwargs):
        if self.fail_times > 0:
            self.fail_times -= 1
            raise RuntimeError("telegram error")
        self.calls.append(kwargs)


def fake_app(fail_times: int = 0):
    return SimpleNamespace(bot=FakeBot(fail_times=fail_times))


def make_held_order(db, user_id: int = HOTEL, chat_id: int = CHAT) -> str:
    customer = db.customer_by_telegram_id(user_id)
    conv_id = db.conversation_id(customer.id, chat_id)
    order_lines = [
        {
            "sku": OAT,
            "quantity": Decimal("94"),
            "unit_code": "CTN12",
            "unit_price": Decimal("25.65"),
            "line_total": Decimal("2411.10"),
        }
    ]
    order_id = db.create_draft(customer.id, conv_id, order_lines, Decimal("2411.10"))
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


def test_staff_reject_sends_notice_once(db):
    order_id = make_held_order(db)
    assert call_review(db, "authenticated", order_id, "reject") == "rejected"
    app = fake_app()

    first = run(main.process_reject_notices(app, db))
    second = run(main.process_reject_notices(app, db))

    assert first == 1
    assert second == 0
    assert len(app.bot.calls) == 1
    ref = order_ref({"id": order_id, "po_number": None})
    expected_text = main.REJECT_NOTICE_TEXT.format(ref=ref)
    call = app.bot.calls[0]
    assert call["chat_id"] == CHAT
    assert call["text"] == expected_text
    assert ref in call["text"]
    assert call["text"].startswith("Sorry, we couldn't accept order ")
    assert scalar(db, "select rejected_by_staff_at is not null from orders where id = %s", order_id) is True
    assert scalar(db, "select reject_notice_sent_at is not null from orders where id = %s", order_id) is True
    assert scalar(
        db,
        "select count(*) from messages m join order_messages om on om.message_id = m.id"
        " where om.order_id = %s and m.direction = 'out' and m.author = 'bot' and m.kind = 'text' and m.body = %s",
        order_id,
        expected_text,
    ) == 1


def test_customer_cancel_gets_no_notice(bot, db, reader, monkeypatch):
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 2, "unit": "CTN12", "raw_text": "2 ctn oat milk"}],
    )
    draft = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk"))
    run(bot.on_button(CAFE, CHAT, "cancel", draft.order_id))
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "cancelled"
    assert scalar(db, "select rejected_by_staff_at from orders where id = %s", draft.order_id) is None

    app = fake_app()
    sent = run(main.process_reject_notices(app, db))

    assert sent == 0
    assert app.bot.calls == []


def test_failed_notice_does_not_block(db):
    first_id = make_held_order(db)
    second_id = make_held_order(db)
    assert call_review(db, "authenticated", first_id, "reject") == "rejected"
    assert call_review(db, "authenticated", second_id, "reject") == "rejected"

    app = fake_app(fail_times=1)
    sent = run(main.process_reject_notices(app, db))

    assert sent == 1
    assert len(app.bot.calls) == 1
    assert scalar(db, "select reject_notice_sent_at from orders where id = %s", first_id) is None
    assert scalar(db, "select reject_notice_sent_at is not null from orders where id = %s", second_id) is True
    assert scalar(
        db,
        "select count(*) from messages m join order_messages om on om.message_id = m.id"
        " where om.order_id = %s and m.direction = 'out' and m.author = 'bot' and m.kind = 'text'",
        first_id,
    ) == 0
    assert scalar(
        db,
        "select count(*) from messages m join order_messages om on om.message_id = m.id"
        " where om.order_id = %s and m.direction = 'out' and m.author = 'bot' and m.kind = 'text'",
        second_id,
    ) == 1

    retry = run(main.process_reject_notices(app, db))

    assert retry == 1
    assert len(app.bot.calls) == 2
    assert scalar(db, "select reject_notice_sent_at is not null from orders where id = %s", first_id) is True
    assert scalar(
        db,
        "select count(*) from messages m join order_messages om on om.message_id = m.id"
        " where om.order_id = %s and m.direction = 'out' and m.author = 'bot' and m.kind = 'text'",
        first_id,
    ) == 1
