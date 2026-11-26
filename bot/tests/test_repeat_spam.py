import asyncio

from conftest import answer, scalar
from geco_bot.screen import FLAGGED_REPLY, load_rules, screen

CAFE = -100001
CHAT = 555


def run(coro):
    return asyncio.run(coro)


def test_screen_repeat_threshold():
    rules = load_rules()
    assert screen("Pls", 2, rules, repeat_count=2) is None
    assert screen("Pls", 3, rules, repeat_count=3) == ("spam", "repeated message x3")


def test_repeat_third_held_and_skips_reader(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="chit-chat", reply="Okay.")
    assert run(bot.on_text(CAFE, CHAT, "Pls")).text == "Okay."
    assert run(bot.on_text(CAFE, CHAT, "Pls")).text == "Okay."

    calls = []

    async def fail_read(*args, **kwargs):
        calls.append((args, kwargs))
        raise AssertionError("reader.read should not be called")

    monkeypatch.setattr(reader, "read", fail_read)
    third = run(bot.on_text(CAFE, CHAT, "Pls"))

    assert third.text == FLAGGED_REPLY
    assert calls == []
    assert scalar(db, "select decision from screening_log") == "spam"
    assert scalar(db, "select status from screening_log") == "held"
    assert scalar(db, "select reason from screening_log") == "repeated message x3"


def test_repeat_case_and_whitespace_normalized(bot, db, reader, monkeypatch):
    answer(reader, monkeypatch, intent="chit-chat", reply="Okay.")
    assert run(bot.on_text(CAFE, CHAT, "Pls")).text == "Okay."
    assert run(bot.on_text(CAFE, CHAT, " pls ")).text == "Okay."

    third = run(bot.on_text(CAFE, CHAT, "PLS"))
    assert third.text == FLAGGED_REPLY
    assert scalar(db, "select decision from screening_log") == "spam"
    assert scalar(db, "select status from screening_log") == "held"
    assert scalar(db, "select reason from screening_log") == "repeated message x3"


def test_buttons_excluded_from_repeat_count(bot, db, reader, monkeypatch):
    customer = db.customer_by_telegram_id(CAFE)
    conv_id = db.conversation_id(customer.id, CHAT)
    for _ in range(3):
        db.save_message(conv_id, "in", "customer", "button", "Pls")

    answer(reader, monkeypatch, intent="chit-chat", reply="Okay.")
    assert run(bot.on_text(CAFE, CHAT, "Pls")).text == "Okay."
    assert run(bot.on_text(CAFE, CHAT, "Pls")).text == "Okay."
    assert scalar(db, "select count(*) from screening_log") == 0
