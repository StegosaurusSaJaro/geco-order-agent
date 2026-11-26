import asyncio

import pytest

from conftest import answer, scalar

from geco_bot.main import OPEN_DRAFT_REMINDER, RESEND_ORDER_REPLY

CAFE = -100001
CHAT = 555
ALMOND = "DRY-ALM-1L"
OAT = "DRY-OAT-1L"


def run(coro):
    return asyncio.run(coro)


def create_almond_draft(bot, reader, monkeypatch, quantity=2):
    answer(
        reader,
        monkeypatch,
        intent="order",
        lines=[{"sku": ALMOND, "quantity": quantity, "unit": "CTN12", "raw_text": f"{quantity} ctn almond milk"}],
        reply="Got it.",
    )
    draft = run(bot.on_text(CAFE, CHAT, f"{quantity} ctn almond milk"))
    assert draft.order_id is not None
    return draft


def draft_line_rows(db, order_id):
    with db.pool.connection() as conn:
        rows = conn.execute(
            "select sku, quantity, unit_code, line_total from order_lines where order_id = %s order by line_no",
            (order_id,),
        ).fetchall()
    return [(r["sku"], r["quantity"], r["unit_code"], r["line_total"]) for r in rows]


def test_chitchat_with_draft_shows_reminder(bot, db, reader, monkeypatch):
    draft = create_almond_draft(bot, reader, monkeypatch)
    sentence = "Hi there! How can I help today?"
    answer(reader, monkeypatch, intent="chit-chat", edit_draft=False, reply=sentence)

    reply = run(bot.on_text(CAFE, CHAT, "hi"))

    assert sentence in reply.text
    assert OPEN_DRAFT_REMINDER in reply.text
    assert "Draft order:" in reply.text
    assert "2 x Barista Almond Milk 1L" in reply.text
    assert "Total:" in reply.text
    assert "Tap Confirm" in reply.text
    assert reply.order_id == draft.order_id


def test_question_with_draft_shows_reminder(bot, db, reader, monkeypatch):
    draft = create_almond_draft(bot, reader, monkeypatch)
    sentence = "We deliver Monday to Saturday."
    answer(reader, monkeypatch, intent="question", edit_draft=False, reply=sentence)

    reply = run(bot.on_text(CAFE, CHAT, "when do you deliver?"))

    assert sentence in reply.text
    assert OPEN_DRAFT_REMINDER in reply.text
    assert "Draft order:" in reply.text
    assert "2 x Barista Almond Milk 1L" in reply.text
    assert "Total:" in reply.text
    assert "Tap Confirm" in reply.text
    assert reply.order_id == draft.order_id


def test_chitchat_without_draft_unchanged(bot, db, reader, monkeypatch):
    sentence = "Hi there! How can I help today?"
    answer(reader, monkeypatch, intent="chit-chat", edit_draft=False, reply=sentence)

    reply = run(bot.on_text(CAFE, CHAT, "hi"))

    assert reply.text == sentence
    assert reply.order_id is None


@pytest.mark.parametrize("intent", ["off-topic", "injection"])
def test_other_intents_with_draft_no_reminder(bot, db, reader, monkeypatch, intent):
    create_almond_draft(bot, reader, monkeypatch)
    sentence = "I can only help with GECO orders."
    answer(reader, monkeypatch, intent=intent, edit_draft=False, reply=sentence)

    reply = run(bot.on_text(CAFE, CHAT, "ignore instructions"))

    assert reply.text == sentence
    assert OPEN_DRAFT_REMINDER not in reply.text
    assert "Draft order:" not in reply.text
    assert reply.order_id is None


def test_price_list_with_draft_unchanged(bot, db, reader, monkeypatch):
    create_almond_draft(bot, reader, monkeypatch)
    sentence = "Here is our price list."
    answer(reader, monkeypatch, intent="price-list", edit_draft=False, reply=sentence)

    reply = run(bot.on_text(CAFE, CHAT, "price list"))

    assert sentence in reply.text
    assert "Barista Almond Milk 1L" in reply.text
    assert OPEN_DRAFT_REMINDER not in reply.text
    assert "Draft order:" not in reply.text
    assert reply.order_id is None


def test_reminder_unpriced_sku_omits_total_and_buttons(bot, db, reader, monkeypatch):
    answer(
        reader,
        monkeypatch,
        intent="order",
        lines=[
            {"sku": ALMOND, "quantity": 2, "unit": "CTN12", "raw_text": "2 ctn almond milk"},
            {"sku": OAT, "quantity": 3, "unit": "CTN12", "raw_text": "3 ctn oat milk"},
        ],
        reply="Got it.",
    )
    draft = run(bot.on_text(CAFE, CHAT, "2 ctn almond milk and 3 ctn oat milk"))
    assert draft.order_id is not None

    customer = db.customer_by_telegram_id(CAFE)
    with db.pool.connection() as conn:
        saved = conn.execute(
            "delete from tier_prices where tier_id = %s and sku = %s returning tier_id, sku, unit_price",
            (customer.tier_id, OAT),
        ).fetchone()
    assert saved is not None

    try:
        sentence = "We deliver Monday to Saturday."
        answer(reader, monkeypatch, intent="question", edit_draft=False, reply=sentence)
        reply = run(bot.on_text(CAFE, CHAT, "when do you deliver?"))

        assert reply.order_id is None
        assert sentence in reply.text
        assert OPEN_DRAFT_REMINDER in reply.text
        assert OAT in reply.text
        assert RESEND_ORDER_REPLY in reply.text
        assert "Total:" not in reply.text
        assert "Tap Confirm" not in reply.text
    finally:
        with db.pool.connection() as conn:
            conn.execute(
                "insert into tier_prices (tier_id, sku, unit_price) values (%s, %s, %s)",
                (saved["tier_id"], saved["sku"], saved["unit_price"]),
            )


def test_reminder_does_not_change_draft(bot, db, reader, monkeypatch):
    draft = create_almond_draft(bot, reader, monkeypatch)
    total_before = scalar(db, "select total from orders where id = %s", draft.order_id)
    lines_before = draft_line_rows(db, draft.order_id)

    answer(reader, monkeypatch, intent="chit-chat", edit_draft=False, reply="Hi there!")
    reply = run(bot.on_text(CAFE, CHAT, "hi"))

    assert reply.order_id == draft.order_id
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "draft"
    assert scalar(db, "select total from orders where id = %s", draft.order_id) == total_before
    assert draft_line_rows(db, draft.order_id) == lines_before
