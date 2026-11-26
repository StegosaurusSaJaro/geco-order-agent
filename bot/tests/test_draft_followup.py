import asyncio

from conftest import answer, scalar

CAFE = -100001
CHAT = 555
ALMOND = "DRY-ALM-1L"


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
    assert "Draft order:" in reply.text
    assert "2 x Barista Almond Milk 1L" in reply.text
    assert "Total:" in reply.text
    assert "Tap Confirm" in reply.text
    assert reply.order_id == draft.order_id


def test_checkout_followup_shows_buttons(bot, db, reader, monkeypatch):
    draft = create_almond_draft(bot, reader, monkeypatch)
    sentence = "Got it, I will prepare your checkout for the current items."
    answer(reader, monkeypatch, intent="follow-up", edit_draft=False, reply=sentence)

    reply = run(bot.on_text(CAFE, CHAT, "checkout"))

    assert sentence in reply.text
    assert "Draft order:" in reply.text
    assert "2 x Barista Almond Milk 1L" in reply.text
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
