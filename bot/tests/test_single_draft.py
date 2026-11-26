import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from telegram.ext import CallbackQueryHandler

from conftest import answer, scalar
from geco_bot import main

CAFE, HOTEL = -100001, -100006
CHAT, OTHER_CHAT = 555, 556
OAT = "DRY-OAT-1L"
EGGS = "DRY-EGG-30"
BEANS = "COF-ARB-1K"

TWO_LINES = [
    {"sku": OAT, "quantity": 2, "unit": "CTN12", "raw_text": "2 ctn oat milk"},
    {"sku": EGGS, "quantity": 3, "unit": "TRAY30", "raw_text": "3 trays eggs"},
]

THREE_LINES = [
    {"sku": OAT, "quantity": 4, "unit": "CTN12", "raw_text": "4 ctn oat milk"},
    {"sku": EGGS, "quantity": 5, "unit": "TRAY30", "raw_text": "5 trays eggs"},
    {"sku": BEANS, "quantity": 2, "unit": "BAG1KG", "raw_text": "2 kg arabica beans"},
]


def run(coro):
    return asyncio.run(coro)


def test_new_order_cancels_previous_open_draft(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=TWO_LINES)
    draft_a = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk, 3 trays eggs"))

    answer(reader, monkeypatch, intent="order", edit_draft=False, reply="New draft.", lines=THREE_LINES)
    draft_b = run(bot.on_text(CAFE, CHAT, "4 ctn oat milk, 5 trays eggs, 2 kg arabica beans"))

    customer = db.customer_by_telegram_id(CAFE)
    conv_id = db.conversation_id(customer.id, CHAT)

    assert draft_b.order_id is not None
    assert draft_b.order_id != draft_a.order_id
    assert scalar(db, "select status::text from orders where id = %s", draft_a.order_id) == "cancelled"
    assert scalar(db, "select status::text from orders where id = %s", draft_b.order_id) == "draft"
    assert scalar(
        db,
        "select count(*) from orders where customer_id = %s and conversation_id = %s and status = 'draft'",
        customer.id,
        conv_id,
    ) == 1
    assert scalar(db, "select count(*) from order_lines where order_id = %s and version = 1", draft_b.order_id) == 3


def test_confirm_on_cancelled_draft_buttons_returns_already_handled(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=TWO_LINES)
    draft_a = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk, 3 trays eggs"))

    answer(reader, monkeypatch, intent="order", edit_draft=False, reply="New draft.", lines=THREE_LINES)
    run(bot.on_text(CAFE, CHAT, "4 ctn oat milk, 5 trays eggs, 2 kg arabica beans"))

    customer = db.customer_by_telegram_id(CAFE)
    conv_id = db.conversation_id(customer.id, CHAT)
    res = run(bot.on_button(CAFE, CHAT, "confirm", draft_a.order_id))

    assert res.text == main.ALREADY_HANDLED
    assert scalar(db, "select status::text from orders where id = %s", draft_a.order_id) == "cancelled"
    assert scalar(
        db,
        "select count(*) from orders where conversation_id = %s and status = 'confirmed'",
        conv_id,
    ) == 0


def test_open_draft_returns_new_draft(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=TWO_LINES)
    run(bot.on_text(CAFE, CHAT, "2 ctn oat milk, 3 trays eggs"))

    answer(reader, monkeypatch, intent="order", edit_draft=False, reply="New draft.", lines=THREE_LINES)
    draft_b = run(bot.on_text(CAFE, CHAT, "4 ctn oat milk, 5 trays eggs, 2 kg arabica beans"))

    customer = db.customer_by_telegram_id(CAFE)
    conv_id = db.conversation_id(customer.id, CHAT)
    current = db.open_draft(customer.id, conv_id)

    assert current is not None
    assert current["id"] == draft_b.order_id
    assert len(current["lines"]) == 3


def test_other_chats_and_other_customers_drafts_not_cancelled(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=TWO_LINES)
    other_chat_draft = run(bot.on_text(CAFE, OTHER_CHAT, "2 ctn oat milk, 3 trays eggs"))
    other_customer_draft = run(bot.on_text(HOTEL, CHAT, "2 ctn oat milk, 3 trays eggs"))
    draft_a = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk, 3 trays eggs"))

    answer(reader, monkeypatch, intent="order", edit_draft=False, reply="New draft.", lines=THREE_LINES)
    draft_b = run(bot.on_text(CAFE, CHAT, "4 ctn oat milk, 5 trays eggs, 2 kg arabica beans"))

    assert scalar(db, "select status::text from orders where id = %s", other_chat_draft.order_id) == "draft"
    assert scalar(db, "select status::text from orders where id = %s", other_customer_draft.order_id) == "draft"
    assert scalar(db, "select status::text from orders where id = %s", draft_a.order_id) == "cancelled"
    assert scalar(db, "select status::text from orders where id = %s", draft_b.order_id) == "draft"


def test_edit_draft_true_keeps_same_order_id(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=TWO_LINES)
    draft_a = run(bot.on_text(CAFE, CHAT, "2 ctn oat milk, 3 trays eggs"))

    answer(reader, monkeypatch, intent="order", edit_draft=True, reply="Updated.", lines=THREE_LINES)
    edited = run(bot.on_text(CAFE, CHAT, "update to 4 oat, 5 eggs, 2 arabica"))

    assert edited.order_id == draft_a.order_id
    assert scalar(db, "select status::text from orders where id = %s", draft_a.order_id) == "draft"
    assert scalar(db, "select count(*) from order_lines where order_id = %s and version = 1", draft_a.order_id) == 3


def test_receipt_button_clears_markup_and_sends_pdf_without_markup(bot, reader, monkeypatch):
    answer(
        reader,
        monkeypatch,
        intent="order",
        po_number="PO-BTN",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 3, "unit": "CTN12", "raw_text": "3 ctn oat milk"}],
    )
    draft = run(bot.on_text(CAFE, CHAT, "3 ctn oat milk"))
    confirm_reply = run(bot.on_button(CAFE, CHAT, "confirm", draft.order_id, draft.draft_token))
    assert confirm_reply.show_receipt_button is True

    app = main.build_app("123:test-token", bot)
    button_handler = next(
        h.callback
        for h in app.handlers[0]
        if isinstance(h, CallbackQueryHandler) and h.pattern and h.pattern.pattern == r"^(confirm|cancel|receipt):"
    )

    query = SimpleNamespace(
        data=f"receipt:{draft.order_id}",
        answer=AsyncMock(),
        edit_message_reply_markup=AsyncMock(),
        message=SimpleNamespace(
            chat_id=CHAT,
            reply_document=AsyncMock(),
            reply_text=AsyncMock(),
        ),
    )
    update = SimpleNamespace(
        effective_user=SimpleNamespace(id=CAFE),
        callback_query=query,
    )

    run(button_handler(update, None))

    query.answer.assert_awaited_once()
    query.edit_message_reply_markup.assert_awaited_once_with(reply_markup=None)
    query.message.reply_document.assert_awaited_once()
    assert "reply_markup" not in query.message.reply_document.await_args.kwargs
    query.message.reply_text.assert_not_called()
