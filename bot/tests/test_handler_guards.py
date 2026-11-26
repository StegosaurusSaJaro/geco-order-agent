import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

from telegram import Chat, Message, Update, User
from telegram.error import BadRequest

from geco_bot.main import Reply, build_app


class FakeOrderBot:
    def __init__(self, reply: Reply):
        self.reply = reply
        self.text_calls = 0

    async def on_text(self, *_args, **_kwargs):
        self.text_calls += 1
        return self.reply

    async def on_button(self, *_args, **_kwargs):
        return self.reply

    async def on_signup_button(self, *_args, **_kwargs):
        return self.reply


class FakeMessage:
    def __init__(self, chat_id: int = 123):
        self.chat_id = chat_id
        self.text_replies = []
        self.doc_replies = []

    async def reply_text(self, text, reply_markup=None):
        self.text_replies.append((text, reply_markup))

    async def reply_document(self, document, filename=None):
        self.doc_replies.append((document.read(), filename))


class FakeQuery:
    def __init__(self, data: str, message: FakeMessage):
        self.data = data
        self.message = message

    async def answer(self):
        raise BadRequest("Query is too old")

    async def edit_message_reply_markup(self, reply_markup=None):
        raise BadRequest("Message is not modified")


def test_button_handler_delivers_reply_when_markup_edit_fails():
    bot = FakeOrderBot(Reply("Order confirmed", order_id="ord-1", show_receipt_button=True))
    app = build_app("000000:TEST_TOKEN", bot)
    button_handler = app.handlers[0][2]
    msg = FakeMessage(chat_id=123)
    update = SimpleNamespace(
        callback_query=FakeQuery("confirm:ord-1:abcd1234", msg),
        effective_user=SimpleNamespace(id=42),
    )

    asyncio.run(button_handler.callback(update, None))

    assert len(msg.text_replies) == 1
    assert msg.text_replies[0][0] == "Order confirmed"
    assert msg.text_replies[0][1] is not None


def test_button_handler_delivers_pdf_when_markup_edit_fails():
    bot = FakeOrderBot(Reply("", order_id="ord-1", document=b"%PDF-1.4", file_name="receipt-1.pdf"))
    app = build_app("000000:TEST_TOKEN", bot)
    button_handler = app.handlers[0][2]
    msg = FakeMessage(chat_id=123)
    update = SimpleNamespace(
        callback_query=FakeQuery("receipt:ord-1", msg),
        effective_user=SimpleNamespace(id=42),
    )

    asyncio.run(button_handler.callback(update, None))

    assert msg.doc_replies == [(b"%PDF-1.4", "receipt-1.pdf")]


def test_signup_handler_delivers_reply_when_markup_edit_fails():
    bot = FakeOrderBot(Reply("Thanks! Submitted."))
    app = build_app("000000:TEST_TOKEN", bot)
    signup_handler = app.handlers[0][3]
    msg = FakeMessage(chat_id=123)
    update = SimpleNamespace(
        callback_query=FakeQuery("signup:submit", msg),
        effective_user=SimpleNamespace(id=42),
    )

    asyncio.run(signup_handler.callback(update, None))

    assert msg.text_replies == [("Thanks! Submitted.", None)]


def test_edited_text_message_is_ignored():
    bot = FakeOrderBot(Reply("ok"))
    app = build_app("000000:TEST_TOKEN", bot)
    text_handler = app.handlers[0][0]
    user = User(id=42, first_name="Ana", is_bot=False)
    chat = Chat(id=123, type="private")
    now = datetime.now(timezone.utc)

    fresh_update = Update(
        update_id=1,
        message=Message(message_id=10, date=now, chat=chat, from_user=user, text="2 ctn oat milk"),
    )
    edited_update = Update(
        update_id=2,
        edited_message=Message(message_id=10, date=now, chat=chat, from_user=user, text="3 ctn oat milk"),
    )

    assert text_handler.check_update(fresh_update) is not False
    assert text_handler.check_update(edited_update) is False
