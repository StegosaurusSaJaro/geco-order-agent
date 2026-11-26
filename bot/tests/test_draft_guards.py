import asyncio
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import psycopg
import pytest
from telegram.ext import CallbackQueryHandler

from conftest import answer, scalar
from geco_bot import main, orders
from geco_bot.reader import SYSTEM, check_lines

REPO = Path(__file__).resolve().parents[2]
CAFE = -100001
CHAT = 555
OAT = "DRY-OAT-1L"
EGGS = "DRY-EGG-30"
BEANS = "COF-ARB-1K"

THREE_LINES = [
    {"sku": OAT, "quantity": 2, "unit": "CTN12", "raw_text": "2 ctn oat milk"},
    {"sku": EGGS, "quantity": 3, "unit": "TRAY30", "raw_text": "3 trays eggs"},
    {"sku": BEANS, "quantity": 1, "unit": "BAG1KG", "raw_text": "1 kg arabica beans"},
]

ONE_LINE = [
    {"sku": OAT, "quantity": 2, "unit": "CTN12", "raw_text": "2 ctn oat milk"},
]


def run(coro):
    return asyncio.run(coro)


def get_button_handler(bot):
    app = main.build_app("123:test-token", bot)
    return next(
        h.callback
        for h in app.handlers[0]
        if isinstance(h, CallbackQueryHandler) and h.pattern and h.pattern.pattern == r"^(confirm|cancel|receipt):"
    )


def fake_callback(user_id: int, chat_id: int, data: str):
    query = SimpleNamespace(
        data=data,
        answer=AsyncMock(),
        edit_message_reply_markup=AsyncMock(),
        message=SimpleNamespace(
            chat_id=chat_id,
            reply_document=AsyncMock(),
            reply_text=AsyncMock(),
        ),
    )
    update = SimpleNamespace(
        effective_user=SimpleNamespace(id=user_id),
        callback_query=query,
    )
    return update, query


def test_r1_stale_confirm_token_rejected_and_current_token_confirms(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=ONE_LINE)
    first = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk"))
    assert first.order_id is not None
    assert first.draft_token is not None

    answer(
        reader,
        monkeypatch,
        intent="order",
        edit_draft=True,
        reply="Updated.",
        lines=[{"sku": OAT, "quantity": 5, "unit": "CTN12", "raw_text": "5 ctn oat milk"}],
    )
    edited = run(bot.on_text(CAFE, CHAT, "make it 5"))
    assert edited.order_id == first.order_id
    assert edited.draft_token is not None
    assert edited.draft_token != first.draft_token

    handler = get_button_handler(bot)
    update, query = fake_callback(CAFE, CHAT, f"confirm:{first.order_id}:{first.draft_token}")
    run(handler(update, None))

    assert scalar(db, "select status::text from orders where id = %s", first.order_id) == "draft"
    reply_text = query.message.reply_text.await_args.args[0]
    reply_markup = query.message.reply_text.await_args.kwargs["reply_markup"]
    assert reply_text.startswith(main.STALE_DRAFT_REPLY)
    assert "5 ×" in reply_text
    assert reply_markup.inline_keyboard[0][0].callback_data == f"confirm:{edited.order_id}:{edited.draft_token}"

    confirmed = run(bot.on_button(CAFE, CHAT, "confirm", edited.order_id, edited.draft_token))
    assert "confirmed" in confirmed.text
    assert scalar(db, "select status::text from orders where id = %s", edited.order_id) == "confirmed"


def test_r1_legacy_confirm_without_token_is_stale_and_cancel_works_with_or_without_token(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=ONE_LINE)
    draft = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk"))

    handler = get_button_handler(bot)
    update, query = fake_callback(CAFE, CHAT, f"confirm:{draft.order_id}")
    run(handler(update, None))

    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "draft"
    reply_text = query.message.reply_text.await_args.args[0]
    reply_markup = query.message.reply_text.await_args.kwargs["reply_markup"]
    assert reply_text.startswith(main.STALE_DRAFT_REPLY)
    assert reply_markup.inline_keyboard[0][0].callback_data == f"confirm:{draft.order_id}:{draft.draft_token}"

    cancel_no_token = run(bot.on_button(CAFE, CHAT, "cancel", draft.order_id))
    assert cancel_no_token.text == main.CANCELLED
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "cancelled"

    draft2 = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk"))
    update2, query2 = fake_callback(CAFE, CHAT, f"cancel:{draft2.order_id}:{draft2.draft_token}")
    run(handler(update2, None))
    assert query2.message.reply_text.await_args.args[0] == main.CANCELLED
    assert scalar(db, "select status::text from orders where id = %s", draft2.order_id) == "cancelled"


def test_r1_draft_token_properties_and_callback_length_across_paths(bot, db, reader, monkeypatch):
    line_a = {"sku": OAT, "quantity": Decimal("2.00"), "unit_code": "CTN12"}
    line_b = {"sku": EGGS, "quantity": Decimal("3"), "unit_code": "TRAY30"}
    assert orders.draft_token([line_a, line_b]) == orders.draft_token([line_b, line_a])
    assert len(orders.draft_token([line_a, line_b])) == 8

    line_a_changed = {"sku": OAT, "quantity": Decimal("4"), "unit_code": "CTN12"}
    assert orders.draft_token([line_a_changed, line_b]) != orders.draft_token([line_a, line_b])

    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=ONE_LINE)
    created = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk"))

    answer(reader, monkeypatch, intent="order", edit_draft=True, reply="Updated.", lines=THREE_LINES)
    edited = run(bot.on_text(CAFE, CHAT, "add eggs and beans"))

    answer(reader, monkeypatch, intent="follow-up", edit_draft=False, reply="Here it is.")
    followup = run(bot.on_text(CAFE, CHAT, "what is in my draft?"))

    answer(reader, monkeypatch, intent="chit-chat", edit_draft=False, reply="Hi!")
    reminder = run(bot.on_text(CAFE, CHAT, "hi"))

    answer(reader, monkeypatch, intent="order", reply="Read file.", lines=ONE_LINE)
    file_reply = run(bot.on_file(CAFE, CHAT, "file", None, "po.pdf", "application/pdf", b"%PDF-1.4 test"))

    for reply in (created, edited, followup, reminder, file_reply):
        assert reply.order_id is not None
        assert reply.draft_token is not None
        markup = main.buttons(reply.order_id, reply.draft_token)
        confirm_cb = markup.inline_keyboard[0][0].callback_data
        assert confirm_cb == f"confirm:{reply.order_id}:{reply.draft_token}"
        assert len(confirm_cb.encode("utf-8")) <= 64

    customer = db.customer_by_telegram_id(CAFE)
    conv_id = db.conversation_id(customer.id, CHAT)
    msg_id = db.save_message(conv_id, "in", "customer", "text", "2 ctn oat milk")
    flag_id = db.log_screening(CAFE, "spam", "test", 5, message_id=msg_id, conversation_id=conv_id, status="held")
    with db.pool.connection() as conn:
        conn.execute("update screening_log set status = 'released', reviewed_at = now() where id = %s", (flag_id,))

    sent = []

    class FakeBot:
        async def send_message(self, **kwargs):
            sent.append(kwargs)

    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=ONE_LINE)
    assert run(bot.process_released_flags(FakeBot())) == 1
    assert len(sent) == 1
    confirm_cb = sent[0]["reply_markup"].inline_keyboard[0][0].callback_data
    assert confirm_cb.startswith("confirm:") and len(confirm_cb.split(":")) == 3
    assert len(confirm_cb.encode("utf-8")) <= 64


def test_r2_edit_names_removed_products_and_skips_quantity_only_edits(bot, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=THREE_LINES)
    run(bot.on_text(CAFE, CHAT, "2 oat, 3 eggs, 1 arabica"))

    answer(reader, monkeypatch, intent="order", edit_draft=True, reply="Updated.", lines=ONE_LINE)
    reduced = run(bot.on_text(CAFE, CHAT, "keep only oat milk"))
    eggs_name = reader.catalog_by_sku[EGGS]["name"]
    beans_name = reader.catalog_by_sku[BEANS]["name"]
    expected_note = f"Removed from your draft: {eggs_name}, {beans_name}"
    assert expected_note in reduced.text
    assert reduced.text.index(expected_note) < reduced.text.index(orders.DRAFT_HEADING)

    answer(
        reader,
        monkeypatch,
        intent="order",
        edit_draft=True,
        reply="Updated.",
        lines=[{"sku": OAT, "quantity": 5, "unit": "CTN12", "raw_text": "5 ctn oat milk"}],
    )
    qty_only = run(bot.on_text(CAFE, CHAT, "make oat milk 5"))
    assert "Removed from your draft:" not in qty_only.text


def test_r6_supersede_path_leaves_one_draft_and_names_removed_products(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=THREE_LINES)
    first = run(bot.on_text(CAFE, CHAT, "2 oat, 3 eggs, 1 arabica"))

    answer(reader, monkeypatch, intent="order", edit_draft=False, reply="Got it.", lines=ONE_LINE)
    second = run(bot.on_text(CAFE, CHAT, "just 2 oat milk"))

    customer = db.customer_by_telegram_id(CAFE)
    conv_id = db.conversation_id(customer.id, CHAT)
    assert second.order_id != first.order_id
    assert scalar(
        db,
        "select count(*) from orders where customer_id = %s and conversation_id = %s and status = 'draft'",
        customer.id,
        conv_id,
    ) == 1
    eggs_name = reader.catalog_by_sku[EGGS]["name"]
    beans_name = reader.catalog_by_sku[BEANS]["name"]
    assert f"Removed from your draft: {eggs_name}, {beans_name}" in second.text


def test_r3_unique_index_cleanup_and_create_draft_retry(db, monkeypatch):
    customer = db.customer_by_telegram_id(CAFE)
    conv_id = db.conversation_id(customer.id, CHAT)
    line = [
        {
            "sku": OAT,
            "quantity": Decimal("2"),
            "unit_code": "CTN12",
            "unit_price": Decimal("28.50"),
            "line_total": Decimal("57.00"),
        }
    ]

    first_id = db.create_draft(customer.id, conv_id, line, Decimal("57.00"))
    with pytest.raises(psycopg.errors.UniqueViolation) as exc_info:
        with db.pool.connection() as conn:
            conn.execute(
                "insert into orders (customer_id, conversation_id, status, source, total)"
                " values (%s, %s, 'draft', 'text', 10.00)",
                (customer.id, conv_id),
            )
    assert exc_info.value.diag.constraint_name == "orders_one_open_draft"

    second_id = db.create_draft(customer.id, conv_id, line, Decimal("57.00"))
    assert second_id != first_id
    assert scalar(
        db,
        "select count(*) from orders where customer_id = %s and conversation_id = %s and status = 'draft'",
        customer.id,
        conv_id,
    ) == 1

    with db.pool.connection() as conn:
        conn.execute("drop index orders_one_open_draft")
        older = conn.execute(
            "insert into orders (customer_id, conversation_id, status, source, total, created_at)"
            " values (%s, %s, 'draft', 'text', 10.00, now() - interval '1 hour') returning id::text",
            (customer.id, conv_id),
        ).fetchone()["id"]
        newer = conn.execute(
            "insert into orders (customer_id, conversation_id, status, source, total, created_at)"
            " values (%s, %s, 'draft', 'text', 20.00, now() + interval '1 minute') returning id::text",
            (customer.id, conv_id),
        ).fetchone()["id"]
        migration_sql = (REPO / "supabase/migrations/20261127000400_one_open_draft.sql").read_text(encoding="utf-8")
        conn.execute(migration_sql)

    assert scalar(db, "select status::text from orders where id = %s", older) == "cancelled"
    assert scalar(db, "select status::text from orders where id = %s", second_id) == "cancelled"
    assert scalar(db, "select status::text from orders where id = %s", newer) == "draft"
    assert scalar(
        db,
        "select count(*) from orders where customer_id = %s and conversation_id = %s and status = 'draft'",
        customer.id,
        conv_id,
    ) == 1


def test_r4_closed_order_labeled_in_history_and_open_draft_unlabeled(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", po_number="PO-CLOSED", reply="Got it.", lines=ONE_LINE)
    first = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk"))
    run(bot.on_button(CAFE, CHAT, "confirm", first.order_id, first.draft_token))

    answer(reader, monkeypatch, intent="order", reply="New draft.", lines=ONE_LINE)
    second = run(bot.on_text(CAFE, CHAT, "another 2 ctn oat milk"))

    customer = db.customer_by_telegram_id(CAFE)
    conv_id = db.conversation_id(customer.id, CHAT)
    history = db.recent_messages(conv_id)
    bot_bodies = [m["body"] for m in history if m["author"] == "bot"]

    assert any("[order PO-CLOSED is closed: confirmed]" in b for b in bot_bodies)
    open_draft_msgs = [b for b in bot_bodies if b.startswith("New draft.")]
    assert len(open_draft_msgs) == 1
    assert "is closed:" not in open_draft_msgs[0]

    future_ts = scalar(db, "select now() + interval '1 minute'")
    before_history = db.history_before(conv_id, future_ts)
    assert any("[order PO-CLOSED is closed: confirmed]" in m["body"] for m in before_history if m["author"] == "bot")

    with db.pool.connection() as conn:
        stored_bodies = [
            r["body"]
            for r in conn.execute(
                "select body from messages where conversation_id = %s and body is not null",
                (conv_id,),
            ).fetchall()
        ]
    assert all("is closed:" not in b for b in stored_bodies)
    assert "closed orders" in SYSTEM.lower()


def test_r5_whole_units_only(bot, reader, monkeypatch):
    raw_lines = [
        SimpleNamespace(sku=EGGS, quantity=0.5, unit="TRAY30", raw_text="half tray eggs"),
        SimpleNamespace(sku=OAT, quantity=2.0, unit="CTN12", raw_text="2 cartons oat milk"),
    ]
    kept, dropped = check_lines(raw_lines, reader.catalog_by_sku)
    assert kept == [{"sku": OAT, "quantity": Decimal("2"), "unit_code": "CTN12"}]
    assert dropped == ["half tray eggs (whole units only)"]

    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[
            {"sku": EGGS, "quantity": 0.5, "unit": "TRAY30", "raw_text": "half tray eggs"},
            {"sku": OAT, "quantity": 2.0, "unit": "CTN12", "raw_text": "2 cartons oat milk"},
        ],
    )
    reply = run(bot.on_text(CAFE, CHAT, "half tray eggs and 2 cartons oat milk"))
    assert "I couldn't match: half tray eggs (whole units only)" in reply.text
    assert "2 ×" in reply.text
