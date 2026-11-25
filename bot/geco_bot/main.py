import asyncio
import contextlib
import io
import logging
from dataclasses import dataclass
from decimal import Decimal

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import Application, CallbackQueryHandler, ContextTypes, MessageHandler, filters

from geco_bot import orders
from geco_bot.config import load_settings
from geco_bot.db import Database
from geco_bot.reader import Reader, check_lines
from geco_bot.receipt import build_receipt_pdf, order_ref

log = logging.getLogger(__name__)

UNKNOWN_SENDER = "Sorry, this Telegram account is not registered with GECO. Please contact your account manager."
READ_FAILED = "Sorry, I couldn't read that, please try again"
FILES_LATER = "Please type your order as a message for now"
CONFIRM_REPLIES = {
    "confirmed": "Your order is confirmed. Thank you!",
    "held": "Our staff will check this order and get back to you.",
    "handled": "This order was already handled.",
}
CANCELLED = "Your order is cancelled."
ALREADY_HANDLED = CONFIRM_REPLIES["handled"]
RECEIPT_UNAVAILABLE = "Receipt is only available for confirmed orders."


@dataclass
class Reply:
    text: str
    order_id: str | None = None
    show_receipt_button: bool = False
    document: bytes | None = None
    file_name: str | None = None


class OrderBot:
    def __init__(
        self,
        db: Database,
        reader: Reader,
        review_threshold: Decimal = Decimal("2000"),
        quantity_factor: Decimal = Decimal("3"),
        quantity_min_history: int = 2,
    ):
        self.db = db
        self.reader = reader
        self.review_threshold = review_threshold
        self.quantity_factor = quantity_factor
        self.quantity_min_history = quantity_min_history

    async def on_text(self, user_id: int, chat_id: int, text: str, telegram_message_id=None) -> Reply:
        customer = self.db.customer_by_telegram_id(user_id)
        if customer is None:
            return Reply(UNKNOWN_SENDER)
        conversation_id = self.db.conversation_id(customer.id, chat_id)
        history = self.db.recent_messages(conversation_id)
        draft = self.db.open_draft(customer.id, conversation_id)
        inbound_id = self.db.save_message(conversation_id, "in", "customer", "text", text, telegram_message_id)
        reading = await self.reader.read(text, history, draft=draft)
        reply = self.compose(customer, conversation_id, reading, draft=draft)
        outbound_id = self.db.save_message(conversation_id, "out", "bot", "text", reply.text)
        if reply.order_id:
            self.db.link_messages(reply.order_id, [inbound_id, outbound_id])
        return reply

    def compose(self, customer, conversation_id, reading, source: str = "text", draft: dict | None = None) -> Reply:
        if reading is None:
            return Reply(READ_FAILED)
        facts = orders.reply_facts(self.db.price_and_stock(customer.tier_id, orders.placeholder_skus(reading.reply)))
        said = orders.fill_placeholders(reading.reply, facts).strip()
        if reading.intent == "price-list":
            return Reply(join(said, orders.price_list_text(self.db.price_list(customer.tier_id))))
        if reading.intent != "order" and not reading.edit_draft:
            return Reply(said)
        kept, dropped = check_lines(reading.lines, self.reader.catalog_by_sku)
        products = self.db.price_and_stock(customer.tier_id, [line["sku"] for line in kept])
        lines, unpriced, total = orders.price_lines(kept, products)
        dropped += unpriced
        if not lines:
            return Reply(join(said, orders.dropped_text(dropped)))
        if reading.edit_draft and draft and self.db.replace_draft_lines(
            draft["id"], customer.id, lines, total, po_number=reading.po_number
        ):
            order_id = draft["id"]
        else:
            order_id = self.db.create_draft(
                customer.id, conversation_id, lines, total, source=source, po_number=reading.po_number
            )
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
            outcome = self.db.confirm(
                order_id,
                customer.id,
                self.review_threshold,
                self.quantity_factor,
                self.quantity_min_history,
            )
            text = CONFIRM_REPLIES[outcome]
            reply_id = self.db.save_message(conversation_id, "out", "bot", "text", text)
            self.db.link_messages(order_id, [pressed_id, reply_id])
            return Reply(text, order_id, show_receipt_button=(outcome == "confirmed"))
        if action == "receipt":
            order = self.db.receipt_data(order_id)
            if order is None or order["customer_id"] != customer.id or order["status"] not in ("confirmed", "fulfilled"):
                reply_id = self.db.save_message(conversation_id, "out", "bot", "text", RECEIPT_UNAVAILABLE)
                self.db.link_messages(order_id, [pressed_id, reply_id])
                return Reply(RECEIPT_UNAVAILABLE)
            pdf_bytes = build_receipt_pdf(order)
            file_name = f"receipt-{order_ref(order)}.pdf"
            reply_id = self.db.save_message(
                conversation_id, "out", "bot", "file", None, file_name=file_name, file_mime="application/pdf"
            )
            self.db.link_messages(order_id, [pressed_id, reply_id])
            return Reply("", order_id, show_receipt_button=True, document=pdf_bytes, file_name=file_name)
        text = CANCELLED if self.db.cancel(order_id, customer.id) else ALREADY_HANDLED
        reply_id = self.db.save_message(conversation_id, "out", "bot", "text", text)
        self.db.link_messages(order_id, [pressed_id, reply_id])
        return Reply(text, order_id)

    async def on_file(
        self,
        user_id: int,
        chat_id: int,
        kind: str,
        caption: str | None,
        file_name: str | None,
        file_mime: str | None,
        file_bytes: bytes,
        telegram_message_id=None,
    ) -> Reply:
        customer = self.db.customer_by_telegram_id(user_id)
        if customer is None:
            return Reply(UNKNOWN_SENDER)
        conversation_id = self.db.conversation_id(customer.id, chat_id)
        history = self.db.recent_messages(conversation_id)
        draft = self.db.open_draft(customer.id, conversation_id)
        inbound_id = self.db.save_message(
            conversation_id, "in", "customer", kind, caption, telegram_message_id, file_name, file_mime
        )
        source = file_source(kind, file_name, file_mime)
        if source is None:
            self.db.save_message(conversation_id, "out", "bot", "text", READ_FAILED)
            return Reply(READ_FAILED)
        reading = await self.reader.read(
            caption or "", history, file_bytes=file_bytes, file_mime=file_mime, file_name=file_name, draft=draft
        )
        reply = self.compose(customer, conversation_id, reading, source=source, draft=draft)
        outbound_id = self.db.save_message(conversation_id, "out", "bot", "text", reply.text)
        if reply.order_id:
            self.db.link_messages(reply.order_id, [inbound_id, outbound_id])
        return reply


def file_source(kind: str, file_name: str | None, file_mime: str | None) -> str | None:
    if kind == "photo" or (file_mime or "").startswith("image/") or (file_name or "").lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        return "photo"
    if file_mime == "application/pdf" or (file_name or "").lower().endswith(".pdf"):
        return "pdf"
    if file_mime == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" or (file_name or "").lower().endswith(".xlsx"):
        return "xlsx"
    if file_mime == "application/vnd.ms-excel" or (file_name or "").lower().endswith(".xls"):
        return "xls"
    return None


def join(*parts: str) -> str:
    return "\n\n".join(p for p in parts if p)


def buttons(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("Confirm", callback_data=f"confirm:{order_id}"),
        InlineKeyboardButton("Cancel", callback_data=f"cancel:{order_id}"),
    ]])


def receipt_button(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("Get receipt", callback_data=f"receipt:{order_id}"),
    ]])


async def process_receipts(app: Application, db: Database) -> int:
    sent = 0
    failed: list[str] = []
    try:
        while (order_id := db.claim_due_receipt_order()) is not None:
            try:
                order = db.receipt_data(order_id)
                if order is None:
                    continue
                pdf_bytes = build_receipt_pdf(order)
                file_name = f"receipt-{order_ref(order)}.pdf"
                if order["telegram_chat_id"] > 0:
                    await app.bot.send_document(
                        chat_id=order["telegram_chat_id"],
                        document=io.BytesIO(pdf_bytes),
                        filename=file_name,
                        reply_markup=receipt_button(order_id),
                    )
                msg_id = db.save_message(
                    order["conversation_id"],
                    "out",
                    "bot",
                    "file",
                    None,
                    file_name=file_name,
                    file_mime="application/pdf",
                )
                db.link_messages(order_id, [msg_id])
                sent += 1
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Failed to send receipt for order %s", order_id)
                failed.append(order_id)
    finally:
        for failed_id in failed:
            db.clear_receipt_sent(failed_id)
    return sent


def build_app(token: str, bot: OrderBot, poll_seconds: float = 5.0) -> Application:
    async def text_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        msg = update.effective_message
        reply = await bot.on_text(update.effective_user.id, msg.chat_id, msg.text, msg.message_id)
        await msg.reply_text(reply.text, reply_markup=buttons(reply.order_id) if reply.order_id else None)

    async def button_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        action, order_id = query.data.split(":", 1)
        reply = await bot.on_button(update.effective_user.id, query.message.chat_id, action, order_id)
        if action != "receipt":
            await query.edit_message_reply_markup(reply_markup=None)
        if reply.document is not None:
            if query.message.chat_id > 0:
                await query.message.reply_document(
                    document=io.BytesIO(reply.document),
                    filename=reply.file_name,
                    reply_markup=receipt_button(order_id),
                )
        else:
            await query.message.reply_text(
                reply.text,
                reply_markup=receipt_button(order_id) if reply.show_receipt_button else None,
            )

    async def file_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        msg = update.effective_message
        if msg.document:
            doc = msg.document
            kind = "file"
            tg_file = await doc.get_file()
            file_name = doc.file_name
            file_mime = doc.mime_type
        else:
            kind = "photo"
            tg_file = await msg.photo[-1].get_file()
            file_name = None
            file_mime = "image/jpeg"
        file_bytes = bytes(await tg_file.download_as_bytearray())
        reply = await bot.on_file(
            update.effective_user.id, msg.chat_id, kind, msg.caption, file_name, file_mime, file_bytes, msg.message_id
        )
        await msg.reply_text(reply.text, reply_markup=buttons(reply.order_id) if reply.order_id else None)

    async def poll_loop(application: Application):
        while True:
            try:
                await process_receipts(application, bot.db)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Receipt poll failed")
            await asyncio.sleep(poll_seconds)

    async def post_init(application: Application):
        application.bot_data["receipt_task"] = asyncio.create_task(poll_loop(application))

    async def post_shutdown(application: Application):
        task = application.bot_data.pop("receipt_task", None)
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = Application.builder().token(token).post_init(post_init).post_shutdown(post_shutdown).build()
    app.add_handler(MessageHandler(filters.TEXT, text_handler))
    app.add_handler(CallbackQueryHandler(button_handler, pattern=r"^(confirm|cancel|receipt):"))
    app.add_handler(MessageHandler(filters.Document.ALL | filters.PHOTO, file_handler))
    return app


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    settings = load_settings()
    db = Database(settings.db_url)
    reader = Reader(db.catalog(), db.unit_codes(), settings.model, settings.fallback_model)
    build_app(
        settings.telegram_bot_token,
        OrderBot(
            db,
            reader,
            settings.review_threshold_usd,
            settings.quantity_factor,
            settings.quantity_min_history,
        ),
        poll_seconds=settings.poll_seconds,
    ).run_polling()


if __name__ == "__main__":
    main()
