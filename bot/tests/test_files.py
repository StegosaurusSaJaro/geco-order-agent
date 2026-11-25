import asyncio

from conftest import answer, scalar
from geco_bot import main

CAFE, HOTEL = -100001, -100006
CHAT = 555
OAT = "DRY-OAT-1L"


def run(coro):
    return asyncio.run(coro)


def oat_lines(quantity=3):
    return [{"sku": OAT, "quantity": quantity, "unit": "CTN12", "raw_text": f"{quantity} ctn oat milk"}]


def test_button_isolated_across_customers(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", lines=oat_lines(), reply="Got it.")
    draft = run(bot.on_text(CAFE, CHAT, "3 ctn oat milk"))
    reply = run(bot.on_button(HOTEL, CHAT, "confirm", draft.order_id))
    assert reply.text == main.ALREADY_HANDLED
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "draft"
    assert scalar(db, "select count(*) from order_messages where order_id = %s", draft.order_id) == 2


def test_button_isolated_across_chats(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="order", lines=oat_lines(), reply="Got it.")
    draft = run(bot.on_text(CAFE, CHAT, "3 ctn oat milk"))
    reply = run(bot.on_button(CAFE, CHAT + 1, "cancel", draft.order_id))
    assert reply.text == main.ALREADY_HANDLED
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "draft"
    assert scalar(db, "select count(*) from order_messages where order_id = %s", draft.order_id) == 2
