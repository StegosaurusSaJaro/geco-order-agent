import asyncio
from decimal import Decimal

from conftest import answer, scalar
from geco_bot import main, onboarding
from geco_bot.orders import fill_placeholders

CAFE, RESTAURANT, HOTEL = -100001, -100003, -100006
CHAT = 555
OAT = "DRY-OAT-1L"


def run(coro):
    return asyncio.run(coro)


def oat_order(reader, monkeypatch, quantity=3):
    answer(reader, monkeypatch, intent="order", reply="Got it.",
           lines=[{"sku": OAT, "quantity": quantity, "unit": "CTN12", "raw_text": f"{quantity} ctn oat milk"}])


def test_price_comes_from_the_senders_tier(bot, db, reader, monkeypatch):
    oat_order(reader, monkeypatch, quantity=1)
    prices = []
    for user in (CAFE, RESTAURANT, HOTEL):
        reply = run(bot.on_text(user, CHAT, "1 ctn oat milk"))
        prices.append(scalar(db, "select unit_price from order_lines where order_id = %s", reply.order_id))
    expected = [scalar(db, "select unit_price from tier_prices where tier_id = %s and sku = %s", t, OAT) for t in (1, 2, 3)]
    assert prices == expected
    assert prices[0] == Decimal("28.50") and prices[2] == Decimal("25.65")


def test_placeholders_filled_and_unknown_sku_removed():
    facts = {("price", OAT): "$28.50 per Carton of 12", ("stock", OAT): "120 x Carton of 12"}
    text = fill_placeholders("Oat milk is ${price:DRY-OAT-1L}, we have {stock:DRY-OAT-1L}. Kale is {price:VEG-KAL-1K}.", facts)
    assert "$28.50 per Carton of 12" in text and "$$" not in text
    assert "120 x Carton of 12" in text
    assert "{" not in text and "VEG-KAL" not in text


def test_price_question_answered_at_each_tier(bot, reader, monkeypatch):
    answer(reader, monkeypatch, intent="question", reply="Oat milk is {price:DRY-OAT-1L}.")
    assert "$28.50" in run(bot.on_text(CAFE, CHAT, "how much is oat milk")).text
    assert "$25.65" in run(bot.on_text(HOTEL, CHAT, "how much is oat milk")).text


def test_line_with_wrong_unit_is_dropped_and_named(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.", lines=[
        {"sku": "DRG-FLR-5K", "quantity": 2, "unit": "TRAY30", "raw_text": "2 trays flour"},
        {"sku": OAT, "quantity": 3, "unit": "CTN12", "raw_text": "3 ctn oat milk"},
    ])
    reply = run(bot.on_text(CAFE, CHAT, "2 trays flour + 3 ctn oat milk"))
    assert "I couldn't match: 2 trays flour" in reply.text
    assert scalar(db, "select count(*) from order_lines where order_id = %s", reply.order_id) == 1


def test_double_confirm_saves_once_and_deducts_once(bot, db, reader, monkeypatch):
    oat_order(reader, monkeypatch, quantity=3)
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    draft = run(bot.on_text(CAFE, CHAT, "3 ctn oat milk"))
    first = run(bot.on_button(CAFE, CHAT, "confirm", draft.order_id))
    second = run(bot.on_button(CAFE, CHAT, "confirm", draft.order_id))
    assert first.text == main.CONFIRM_REPLIES["confirmed"]
    assert second.text == main.ALREADY_HANDLED
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "confirmed"
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before - 3
    assert scalar(db, "select count(*) from order_messages where order_id = %s", draft.order_id) == 6


def test_short_stock_is_marked_and_held_on_confirm(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", reply="Got it.",
           lines=[{"sku": "DRY-EGG-30", "quantity": 8, "unit": "TRAY30", "raw_text": "8 trays eggs"}])
    draft = run(bot.on_text(CAFE, CHAT, "8 trays eggs"))
    assert "only 5 available" in draft.text
    held = run(bot.on_button(CAFE, CHAT, "confirm", draft.order_id))
    assert held.text == main.CONFIRM_REPLIES["held"]
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "needs_review"
    assert scalar(db, "select review_reasons from orders where id = %s", draft.order_id) == ["stock"]
    assert scalar(db, "select stock_qty from products where sku = 'DRY-EGG-30'") == Decimal("5.00")


def test_cancel_works_once(bot, db, reader, monkeypatch):
    oat_order(reader, monkeypatch)
    draft = run(bot.on_text(CAFE, CHAT, "3 ctn oat milk"))
    assert run(bot.on_button(CAFE, CHAT, "cancel", draft.order_id)).text == main.CANCELLED
    assert run(bot.on_button(CAFE, CHAT, "confirm", draft.order_id)).text == main.ALREADY_HANDLED
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "cancelled"


def test_model_failure_gets_retry_reply_and_no_order(bot, db, reader, monkeypatch):
    calls = []

    async def failing(model, _prompt):
        calls.append(model)
        raise RuntimeError("503 UNAVAILABLE")

    monkeypatch.setattr(reader, "run_agent", failing)
    orders_before = scalar(db, "select count(*) from orders")
    reply = run(bot.on_text(CAFE, CHAT, "3 ctn oat milk"))
    assert reply.text == main.READ_FAILED and reply.order_id is None
    assert calls == ["primary-model", "fallback-model"]
    assert scalar(db, "select count(*) from orders") == orders_before
    assert scalar(db, "select body from messages where author = 'bot' order by created_at desc limit 1") == main.READ_FAILED


def test_unknown_sender_stores_nothing(bot, db, reader, monkeypatch):
    oat_order(reader, monkeypatch)
    calls = []
    orig_read = reader.read

    async def spy_read(*args, **kwargs):
        calls.append(args)
        return await orig_read(*args, **kwargs)

    monkeypatch.setattr(reader, "read", spy_read)
    counts = "select (select count(*) from messages) + (select count(*) from conversations) + (select count(*) from orders)"
    before = scalar(db, counts)
    reply = run(bot.on_text(424242, CHAT, "3 ctn oat milk"))
    assert reply.text == onboarding.WELCOME
    assert scalar(db, counts) == before
    assert scalar(db, "select count(*) from signups where telegram_user_id = %s and status = 'collecting'", 424242) == 1
    assert calls == []

    group_reply = run(bot.on_text(424243, -9001, "3 ctn oat milk"))
    assert group_reply.text == onboarding.GROUP_SIGNUP_REPLY
    assert scalar(db, counts) == before
    assert scalar(db, "select count(*) from signups where telegram_user_id = %s", 424243) == 0
    assert calls == []
