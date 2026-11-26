import asyncio
from decimal import Decimal

import pytest

from conftest import answer, scalar
from geco_bot import orders

CAFE = -100001
CHAT = 555
ALMOND = {"sku": "DRY-ALM-1L", "quantity": 2, "unit": "CTN12", "raw_text": "2 cartons almond milk"}
MATCHA = {"sku": "COF-MAT-1K", "quantity": 3, "unit": "BAG1KG", "raw_text": "3 bags matcha"}
OAT = {"sku": "DRY-OAT-1L", "quantity": 2, "unit": "CTN12", "raw_text": "2 cartons oat milk"}


def create_draft(bot, reader, monkeypatch, lines, po_number=None):
    answer(reader, monkeypatch, intent="order", lines=lines, po_number=po_number)
    reply = asyncio.run(bot.on_text(CAFE, CHAT, "Please place an order"))
    assert reply.order_id is not None
    return reply


def test_draft_text_exact_layout(db):
    with db.pool.connection() as conn:
        conn.execute("update products set stock_qty = 2 where sku = %s", (MATCHA["sku"],))
    customer = db.customer_by_telegram_id(CAFE)
    products = db.price_and_stock(customer.tier_id, [ALMOND["sku"], MATCHA["sku"]])
    lines, unpriced, total = orders.price_lines([ALMOND, MATCHA], products)
    assert not unpriced

    assert orders.draft_text(lines, products, total, ["foo", "bar"]) == (
        "Draft order\n\n"
        "1. Barista Almond Milk 1L\n"
        "   2 × Carton of 12 @ $29.40 = $58.80\n"
        "2. Ceremonial Uji Matcha Powder\n"
        "   3 × 1 kg Bag @ $68.00 = $204.00\n"
        "   ⚠️ Only 2 available, staff will check this line\n"
        "──────────\n"
        "Total: $262.80\n"
        "I couldn't match: foo, bar\n\n"
        "Tap Confirm to place it or Cancel to drop it."
    )


def test_draft_without_warnings_or_dropped_lines(bot, reader, monkeypatch):
    reply = create_draft(bot, reader, monkeypatch, [ALMOND])

    assert "⚠️" not in reply.text
    assert "I couldn't match" not in reply.text


def test_reminder_replaces_draft_heading(bot, reader, monkeypatch):
    draft = create_draft(bot, reader, monkeypatch, [ALMOND])
    sentence = "Hi there! How can I help today?"
    answer(reader, monkeypatch, intent="chit-chat", reply=sentence)

    reply = asyncio.run(bot.on_text(CAFE, CHAT, "hi"))

    assert reply.text.count("You still have an open draft") == 1
    assert "Draft order" not in reply.text
    assert reply.text.startswith(f"{sentence}\n\nYou still have an open draft\n\n")
    assert reply.order_id == draft.order_id


def test_followup_uses_default_draft_heading(bot, reader, monkeypatch):
    draft = create_draft(bot, reader, monkeypatch, [ALMOND])
    sentence = "Here is your order so far."
    answer(reader, monkeypatch, intent="follow-up", reply=sentence)

    reply = asyncio.run(bot.on_text(CAFE, CHAT, "show my order"))

    assert reply.text.startswith(f"{sentence}\n\nDraft order\n\n")
    assert reply.order_id == draft.order_id


def test_price_list_groups_each_seed_product_once(bot, db, reader, monkeypatch):
    customer = db.customer_by_telegram_id(CAFE)
    with db.pool.connection() as conn:
        products = conn.execute(
            "select p.category, p.name, u.name as unit_name, tp.unit_price from products p"
            " join units_of_measure u on u.code = p.unit_code"
            " join tier_prices tp on tp.sku = p.sku and tp.tier_id = %s"
            " where p.active order by p.name",
            (customer.tier_id,),
        ).fetchall()
    answer(reader, monkeypatch, intent="price-list")

    reply = asyncio.run(bot.on_text(CAFE, CHAT, "price list"))

    heading, dairy, coffee_tea, dry_goods, sauces, packaging, footer = reply.text.split("\n\n")
    assert heading == "Your price list"
    for section, category, label in (
        (dairy, "dairy", "DAIRY"),
        (coffee_tea, "coffee_tea", "COFFEE & TEA"),
        (dry_goods, "dry_goods", "DRY GOODS"),
        (sauces, "sauces", "SAUCES"),
        (packaging, "packaging", "PACKAGING"),
    ):
        assert section.splitlines() == [label] + [
            f"{p['name']} — ${p['unit_price']:,.2f} / {p['unit_name']}" for p in products if p["category"] == category
        ]
    assert footer == 'Reply with what you need, e.g. "2 cartons oat milk".'


def test_price_list_formats_unknown_category():
    rows = [{"name": "Paper Straws", "unit_name": "Pack", "unit_price": Decimal("8.00"), "category": "new_group"}]

    assert "\n\nNEW GROUP\nPaper Straws — $8.00 / Pack\n\n" in orders.price_list_text(rows)


@pytest.mark.parametrize(
    ("po_number", "lines", "item_count"),
    [(None, [ALMOND, MATCHA, OAT], "3 items"), ("PO-9942", [ALMOND], "1 item")],
)
def test_confirmation_uses_order_reference_and_saved_total(bot, db, reader, monkeypatch, po_number, lines, item_count):
    draft = create_draft(bot, reader, monkeypatch, lines, po_number=po_number)
    saved_total = scalar(db, "update orders set total = total + 0.01 where id = %s returning total", draft.order_id)

    reply = asyncio.run(bot.on_button(CAFE, CHAT, "confirm", draft.order_id, draft.draft_token))

    reference = po_number or draft.order_id[:8]
    expected = f"Order {reference} confirmed\n{item_count} · Total ${saved_total:,.2f}\nThank you!"
    assert reply.text == expected
    assert reply.show_receipt_button
    assert scalar(
        db,
        "select m.body from order_messages om join messages m on m.id = om.message_id"
        " where om.order_id = %s and m.direction = 'out' order by m.created_at desc limit 1",
        draft.order_id,
    ) == expected


def test_held_confirmation_keeps_staff_reply(bot, db, reader, monkeypatch):
    with db.pool.connection() as conn:
        conn.execute("update products set stock_qty = 2 where sku = %s", (MATCHA["sku"],))
    draft = create_draft(bot, reader, monkeypatch, [MATCHA])

    reply = asyncio.run(bot.on_button(CAFE, CHAT, "confirm", draft.order_id, draft.draft_token))

    assert reply.text == "Our staff will check this order and get back to you."
    assert not reply.show_receipt_button
