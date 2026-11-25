import logging
from dataclasses import dataclass

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import Application, CallbackQueryHandler, ContextTypes, MessageHandler, filters

from geco_bot import orders
from geco_bot.config import load_settings
from geco_bot.db import Database
from geco_bot.reader import Reader, check_lines

log = logging.getLogger(__name__)

UNKNOWN_SENDER = "Sorry, this Telegram account is not registered with GECO. Please contact your account manager."
READ_FAILED = "Sorry, I couldn't read that, please try again"
FILES_LATER = "Please type your order as a message for now"
CONFIRM_REPLIES = {
    "confirmed": "Your order is confirmed. Thank you!",
    "held": "Some items are short on stock, so our staff will check this order and get back to you.",
    "handled": "This order was already handled.",
}
CANCELLED = "Your order is cancelled."
ALREADY_HANDLED = CONFIRM_REPLIES["handled"]


@dataclass
class Reply:
    text: str
    order_id: str | None = None


class OrderBot:
    def __init__(self, db: Database, reader: Reader):
        self.db = db
        self.reader = reader

    async def on_text(self, user_id: int, chat_id: int, text: str, telegram_message_id=None) -> Reply:
        customer = self.db.customer_by_telegram_id(user_id)
        if customer is None:
            return Reply(UNKNOWN_SENDER)
        conversation_id = self.db.conversation_id(customer.id, chat_id)
        history = self.db.recent_messages(conversation_id)
        inbound_id = self.db.save_message(conversation_id, "in", "customer", "text", text, telegram_message_id)
        reading = await self.reader.read(text, history)
        reply = self.compose(customer, conversation_id, reading)
        outbound_id = self.db.save_message(conversation_id, "out", "bot", "text", reply.text)
        if reply.order_id:
            self.db.link_messages(reply.order_id, [inbound_id, outbound_id])
        return reply

    def compose(self, customer, conversation_id, reading) -> Reply:
        if reading is None:
            return Reply(READ_FAILED)
        facts = orders.reply_facts(self.db.price_and_stock(customer.tier_id, orders.placeholder_skus(reading.reply)))
        said = orders.fill_placeholders(reading.reply, facts).strip()
        if reading.intent == "price-list":
            return Reply(join(said, orders.price_list_text(self.db.price_list(customer.tier_id))))
        if reading.intent != "order":
            return Reply(said)
        kept, dropped = check_lines(reading.lines, self.reader.catalog_by_sku)
        products = self.db.price_and_stock(customer.tier_id, [line["sku"] for line in kept])
        lines, unpriced, total = orders.price_lines(kept, products)
        dropped += unpriced
        if not lines:
            return Reply(join(said, orders.dropped_text(dropped)))
        order_id = self.db.create_draft(customer.id, conversation_id, lines, total)
        return Reply(join(said, orders.draft_text(lines, products, total, dropped)), order_id)

    async def on_button(self, user_id: int, chat_id: int, action: str, order_id: str) -> Reply:
        customer = self.db.customer_by_telegram_id(user_id)
        if customer is None:
            return Reply(UNKNOWN_SENDER)
        conversation_id = self.db.conversation_id(customer.id, chat_id)
        pressed_id = self.db.save_message(conversation_id, "in", "customer", "button", action)
        if not self.db.order_belongs_to(order_id, customer.id, conversation_id):
            self.db.save_message(conversation_id, "out", "bot", "text", ALREADY_HANDLED)
            return Reply(ALREADY_HANDLED)
        if action == "confirm":
            text = CONFIRM_REPLIES[self.db.confirm(order_id, customer.id)]
        else:
            text = CANCELLED if self.db.cancel(order_id, customer.id) else ALREADY_HANDLED
        reply_id = self.db.save_message(conversation_id, "out", "bot", "text", text)
        self.db.link_messages(order_id, [pressed_id, reply_id])
        return Reply(text, order_id)

    def on_file(self, user_id: int, chat_id: int, kind: str, caption, file_name, file_mime, telegram_message_id):
        customer = self.db.customer_by_telegram_id(user_id)
        if customer is None:
            return Reply(UNKNOWN_SENDER)
        conversation_id = self.db.conversation_id(customer.id, chat_id)
        self.db.save_message(conversation_id, "in", "customer", kind, caption, telegram_message_id, file_name, file_mime)
        self.db.save_message(conversation_id, "out", "bot", "text", FILES_LATER)
        return Reply(FILES_LATER)


def join(*parts: str) -> str:
    return "\n\n".join(p for p in parts if p)


def buttons(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("Confirm", callback_data=f"confirm:{order_id}"),
        InlineKeyboardButton("Cancel", callback_data=f"cancel:{order_id}"),
    ]])


def build_app(token: str, bot: OrderBot) -> Application:
    async def text_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        msg = update.effective_message
        reply = await bot.on_text(update.effective_user.id, msg.chat_id, msg.text, msg.message_id)
        await msg.reply_text(reply.text, reply_markup=buttons(reply.order_id) if reply.order_id else None)

    async def button_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        action, order_id = query.data.split(":", 1)
        reply = await bot.on_button(update.effective_user.id, query.message.chat_id, action, order_id)
        await query.edit_message_reply_markup(reply_markup=None)
        await query.message.reply_text(reply.text)

    async def file_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        msg = update.effective_message
        doc = msg.document
        kind = "file" if doc else "photo"
        reply = bot.on_file(
            update.effective_user.id, msg.chat_id, kind, msg.caption,
            doc.file_name if doc else None, doc.mime_type if doc else "image/jpeg", msg.message_id,
        )
        await msg.reply_text(reply.text)

    app = Application.builder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT, text_handler))
    app.add_handler(CallbackQueryHandler(button_handler, pattern=r"^(confirm|cancel):"))
    app.add_handler(MessageHandler(filters.Document.ALL | filters.PHOTO, file_handler))
    return app


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    settings = load_settings()
    db = Database(settings.db_url)
    reader = Reader(db.catalog(), db.unit_codes(), settings.model, settings.fallback_model)
    build_app(settings.telegram_bot_token, OrderBot(db, reader)).run_polling()


if __name__ == "__main__":
    main()
