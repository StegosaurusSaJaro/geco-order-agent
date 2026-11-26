import asyncio
from decimal import Decimal

from conftest import answer, scalar
from geco_bot import config, main

CAFE, HOTEL = -100001, -100006
CHAT = 555
OAT = "DRY-OAT-1L"
EGGS = "DRY-EGG-30"


def run(coro):
    return asyncio.run(coro)


def capture_agent(reader, monkeypatch, **fields):
    calls = []
    output = reader.schema.model_validate({"po_number": None, "lines": [], "reply": "", **fields})

    async def fake_run(model, parts):
        calls.append((model, parts))
        return output

    monkeypatch.setattr(reader, "run_agent", fake_run)
    return calls


def test_edit_replaces_lines_on_same_order(bot, db, reader, monkeypatch):
    capture_agent(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 3, "unit": "CTN12", "raw_text": "3 ctn oat milk"}],
    )
    draft = run(bot.on_text(CAFE, CHAT, "3 ctn oat milk"))
    assert draft.order_id is not None

    calls = capture_agent(
        reader,
        monkeypatch,
        intent="order",
        edit_draft=True,
        reply="Updated to 5 cartons.",
        lines=[{"sku": OAT, "quantity": 5, "unit": "CTN12", "raw_text": "5 ctn oat milk"}],
    )
    edited = run(bot.on_text(CAFE, CHAT, "make the oat milk 5"))

    assert edited.order_id == draft.order_id
    assert "5 ×" in edited.text and "$142.50" in edited.text
    assert scalar(db, "select count(*) from orders where conversation_id = (select id from conversations where telegram_chat_id = %s limit 1)", CHAT) == 1
    assert scalar(db, "select total from orders where id = %s", draft.order_id) == Decimal("142.50")
    assert scalar(db, "select count(*) from order_lines where order_id = %s and version = 1", draft.order_id) == 1
    assert scalar(db, "select quantity from order_lines where order_id = %s and version = 1", draft.order_id) == Decimal("5.00")
    prompt_text = "\n".join(p.text for p in calls[0][1] if p.text)
    assert "Current open draft order:" in prompt_text
    assert "DRY-OAT-1L | 3 | CTN12" in prompt_text


def test_question_with_draft_open_leaves_draft_unchanged(bot, db, reader, monkeypatch):
    capture_agent(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 3, "unit": "CTN12", "raw_text": "3 ctn oat milk"}],
    )
    draft = run(bot.on_text(CAFE, CHAT, "3 ctn oat milk"))
    total_before = scalar(db, "select total from orders where id = %s", draft.order_id)

    answer(reader, monkeypatch, intent="question", edit_draft=False, reply="Almond milk is {price:DRY-ALM-1L}.")
    reply = run(bot.on_text(CAFE, CHAT, "how much is almond milk?"))

    assert reply.order_id == draft.order_id
    assert "$" in reply.text
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "draft"
    assert scalar(db, "select total from orders where id = %s", draft.order_id) == total_before
    assert scalar(db, "select quantity from order_lines where order_id = %s", draft.order_id) == Decimal("3.00")


def test_over_threshold_order_held_on_confirm_with_no_stock_deducted(bot, db, reader, monkeypatch):
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 94, "unit": "CTN12", "raw_text": "94 ctn oat milk"}],
    )
    draft = run(bot.on_text(HOTEL, CHAT, "94 ctn oat milk"))
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "draft"
    assert scalar(db, "select total from orders where id = %s", draft.order_id) == Decimal("2411.10")

    held = run(bot.on_button(HOTEL, CHAT, "confirm", draft.order_id))
    assert held.text == main.CONFIRM_REPLIES["held"]
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "needs_review"
    assert scalar(db, "select review_reasons from orders where id = %s", draft.order_id) == ["total"]
    assert scalar(db, "select confirmed_at from orders where id = %s", draft.order_id) is None
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before


def test_under_threshold_order_confirms(bot, db, reader, monkeypatch):
    before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 77, "unit": "CTN12", "raw_text": "77 ctn oat milk"}],
    )
    draft = run(bot.on_text(HOTEL, CHAT, "77 ctn oat milk"))
    assert scalar(db, "select total from orders where id = %s", draft.order_id) == Decimal("1975.05")

    confirmed = run(bot.on_button(HOTEL, CHAT, "confirm", draft.order_id))
    assert confirmed.text == f"Order {draft.order_id[:8]} confirmed\n1 item · Total $1,975.05\nThank you!"
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "confirmed"
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == before - 77

    customer = db.customer_by_telegram_id(HOTEL)
    conv_id = db.conversation_id(customer.id, CHAT)
    exact_1999 = db.create_draft(
        customer.id,
        conv_id,
        [{"sku": OAT, "quantity": Decimal("1"), "unit_code": "CTN12", "unit_price": Decimal("1999.00"), "line_total": Decimal("1999.00")}],
        Decimal("1999.00"),
    )
    assert db.confirm(exact_1999, customer.id, Decimal("2000")) == "confirmed"


def test_over_threshold_and_short_stock_carries_both_reasons(bot, db, reader, monkeypatch):
    oat_before = scalar(db, "select stock_qty from products where sku = %s", OAT)
    eggs_before = scalar(db, "select stock_qty from products where sku = %s", EGGS)
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[
            {"sku": OAT, "quantity": 94, "unit": "CTN12", "raw_text": "94 ctn oat milk"},
            {"sku": EGGS, "quantity": 8, "unit": "TRAY30", "raw_text": "8 trays eggs"},
        ],
    )
    draft = run(bot.on_text(HOTEL, CHAT, "94 ctn oat milk + 8 trays eggs"))
    held = run(bot.on_button(HOTEL, CHAT, "confirm", draft.order_id))

    assert held.text == main.CONFIRM_REPLIES["held"]
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "needs_review"
    reasons = scalar(db, "select review_reasons from orders where id = %s", draft.order_id)
    assert set(reasons) == {"total", "stock"}
    assert scalar(db, "select stock_qty from products where sku = %s", OAT) == oat_before
    assert scalar(db, "select stock_qty from products where sku = %s", EGGS) == eggs_before


def test_double_confirm_on_held_order_returns_already_handled(bot, db, reader, monkeypatch):
    answer(
        reader,
        monkeypatch,
        intent="order",
        reply="Got it.",
        lines=[{"sku": OAT, "quantity": 94, "unit": "CTN12", "raw_text": "94 ctn oat milk"}],
    )
    draft = run(bot.on_text(HOTEL, CHAT, "94 ctn oat milk"))
    first = run(bot.on_button(HOTEL, CHAT, "confirm", draft.order_id))
    second = run(bot.on_button(HOTEL, CHAT, "confirm", draft.order_id))

    assert first.text == main.CONFIRM_REPLIES["held"]
    assert second.text == main.ALREADY_HANDLED
    assert scalar(db, "select status::text from orders where id = %s", draft.order_id) == "needs_review"


def test_config_reads_review_threshold_usd(monkeypatch):
    monkeypatch.setattr(config, "load_dotenv", lambda _path: None)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://example")
    monkeypatch.delenv("REVIEW_THRESHOLD_USD", raising=False)
    assert config.load_settings().review_threshold_usd == Decimal("2000")

    monkeypatch.setenv("REVIEW_THRESHOLD_USD", "1500")
    assert config.load_settings().review_threshold_usd == Decimal("1500")
