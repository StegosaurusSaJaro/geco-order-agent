import asyncio

from conftest import answer, scalar

from geco_bot.main import RESEND_ORDER_REPLY

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


def test_followup_shows_draft_and_buttons(bot, db, reader, monkeypatch):
    draft = create_almond_draft(bot, reader, monkeypatch)
    sentence = "Here is your current draft order!"
    answer(reader, monkeypatch, intent="follow-up", edit_draft=False, reply=sentence)

    reply = run(bot.on_text(CAFE, CHAT, "what is in my draft?"))

    assert sentence in reply.text
    assert "Draft order\n\n" in reply.text
    assert "1. Barista Almond Milk 1L\n   2 × Carton of 12" in reply.text
    assert "Total:" in reply.text
    assert "Tap Confirm" in reply.text
    assert reply.order_id == draft.order_id


def test_checkout_followup_shows_buttons(bot, db, reader, monkeypatch):
    draft = create_almond_draft(bot, reader, monkeypatch)
    sentence = "Got it, I will prepare your checkout for the current items."
    answer(reader, monkeypatch, intent="follow-up", edit_draft=False, reply=sentence)

    reply = run(bot.on_text(CAFE, CHAT, "checkout"))

    assert sentence in reply.text
    assert "Draft order\n\n" in reply.text
    assert "1. Barista Almond Milk 1L\n   2 × Carton of 12" in reply.text
    assert "Total:" in reply.text
    assert "Tap Confirm" in reply.text
    assert reply.order_id == draft.order_id


def test_followup_without_draft_unchanged(bot, db, reader, monkeypatch):
    sentence = "You don't have an open draft order yet."
    answer(reader, monkeypatch, intent="follow-up", edit_draft=False, reply=sentence)

    reply = run(bot.on_text(CAFE, CHAT, "ready to checkout"))

    assert reply.text == sentence
    assert reply.order_id is None


def test_followup_does_not_change_draft(bot, db, reader, monkeypatch):
    draft = create_almond_draft(bot, reader, monkeypatch)
    total_before = scalar(db, "select total from orders where id = %s", draft.order_id)
    lines_before = draft_line_rows(db, draft.order_id)

    answer(reader, monkeypatch, intent="follow-up", edit_draft=False, reply="Here is your current draft order!")
    reply = run(bot.on_text(CAFE, CHAT, "show my order"))

    assert reply.order_id == draft.order_id
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "draft"
    assert scalar(db, "select total from orders where id = %s", draft.order_id) == total_before
    assert draft_line_rows(db, draft.order_id) == lines_before


def test_followup_partial_unpriced_sku_omits_total_and_buttons(bot, db, reader, monkeypatch):
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
    total_before = scalar(db, "select total from orders where id = %s", draft.order_id)
    lines_before = draft_line_rows(db, draft.order_id)

    customer = db.customer_by_telegram_id(CAFE)
    with db.pool.connection() as conn:
        saved = conn.execute(
            "delete from tier_prices where tier_id = %s and sku = %s returning tier_id, sku, unit_price",
            (customer.tier_id, OAT),
        ).fetchone()
    assert saved is not None

    try:
        sentence = "Here is your current draft order!"
        answer(reader, monkeypatch, intent="follow-up", edit_draft=False, reply=sentence)
        reply = run(bot.on_text(CAFE, CHAT, "what is in my draft?"))

        assert reply.order_id is None
        assert sentence in reply.text
        assert OAT in reply.text
        assert RESEND_ORDER_REPLY in reply.text
        assert "Total:" not in reply.text
        assert "Tap Confirm" not in reply.text
        assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "draft"
        assert scalar(db, "select total from orders where id = %s", draft.order_id) == total_before
        assert draft_line_rows(db, draft.order_id) == lines_before
    finally:
        with db.pool.connection() as conn:
            conn.execute(
                "insert into tier_prices (tier_id, sku, unit_price) values (%s, %s, %s)",
                (saved["tier_id"], saved["sku"], saved["unit_price"]),
            )


def test_followup_all_unpriced_skus_omits_total_and_buttons(bot, db, reader, monkeypatch):
    draft = create_almond_draft(bot, reader, monkeypatch)
    total_before = scalar(db, "select total from orders where id = %s", draft.order_id)
    lines_before = draft_line_rows(db, draft.order_id)

    customer = db.customer_by_telegram_id(CAFE)
    with db.pool.connection() as conn:
        saved = conn.execute(
            "delete from tier_prices where tier_id = %s and sku = %s returning tier_id, sku, unit_price",
            (customer.tier_id, ALMOND),
        ).fetchone()
    assert saved is not None

    try:
        sentence = "Here is your current draft order!"
        answer(reader, monkeypatch, intent="follow-up", edit_draft=False, reply=sentence)
        reply = run(bot.on_text(CAFE, CHAT, "what is in my draft?"))

        assert reply.order_id is None
        assert sentence in reply.text
        assert ALMOND in reply.text
        assert RESEND_ORDER_REPLY in reply.text
        assert "Total:" not in reply.text
        assert "Tap Confirm" not in reply.text
        assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "draft"
        assert scalar(db, "select total from orders where id = %s", draft.order_id) == total_before
        assert draft_line_rows(db, draft.order_id) == lines_before
    finally:
        with db.pool.connection() as conn:
            conn.execute(
                "insert into tier_prices (tier_id, sku, unit_price) values (%s, %s, %s)",
                (saved["tier_id"], saved["sku"], saved["unit_price"]),
            )
