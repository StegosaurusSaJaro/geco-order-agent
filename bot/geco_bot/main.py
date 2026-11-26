import asyncio
import contextlib
import io
import logging
import time
from dataclasses import dataclass
from decimal import Decimal

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    Update,
)
from telegram.ext import Application, CallbackQueryHandler, ContextTypes, MessageHandler, filters

from geco_bot import onboarding, orders
from geco_bot.config import Settings, load_settings
from geco_bot.db import Customer, Database
from geco_bot.reader import Reader, check_lines
from geco_bot.receipt import build_receipt_pdf, order_ref
from geco_bot.screen import FLAGGED_REPLY, load_rules, screen

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
RESEND_FILE_REPLY = "Please send the file again"
RESEND_ORDER_REPLY = "Please send your order again so I can build a fresh draft."
REJECT_NOTICE_TEXT = "Sorry, we couldn't accept order {ref}. A member of the GECO team will contact you shortly."
OPEN_DRAFT_REMINDER = "You still have an open draft:"
DRAFT_REMINDER_INTENTS = ("question", "chit-chat")


@dataclass
class Reply:
    text: str
    order_id: str | None = None
    show_receipt_button: bool = False
    document: bytes | None = None
    file_name: str | None = None
    reply_markup: object | None = None


class OrderBot:
    def __init__(
        self,
        db: Database,
        reader: Reader,
        review_threshold: Decimal = Decimal("2000"),
        quantity_factor: Decimal = Decimal("3"),
        quantity_min_history: int = 2,
        flood_max_messages: int = 8,
        flood_window_seconds: int = 60,
        screen_rules: dict | None = None,
        repeat_max_messages: int | None = None,
    ):
        self.db = db
        self.reader = reader
        self.review_threshold = review_threshold
        self.quantity_factor = quantity_factor
        self.quantity_min_history = quantity_min_history
        self.flood_max_messages = flood_max_messages
        self.flood_window_seconds = flood_window_seconds
        self.screen_rules = screen_rules if screen_rules is not None else load_rules()
        self.repeat_max_messages = Settings.REPEAT_MAX_MESSAGES if repeat_max_messages is None else repeat_max_messages

    async def _reply_to_text(
        self,
        customer: Customer,
        conversation_id: str,
        inbound_id: str,
        text: str,
        history: list[dict],
        draft: dict | None,
    ) -> Reply:
        reading = await self.reader.read(text, history, draft=draft)
        reply = self.compose(customer, conversation_id, reading, draft=draft)
        outbound_id = self.db.save_message(conversation_id, "out", "bot", "text", reply.text)
        if reply.order_id:
            self.db.link_messages(reply.order_id, [inbound_id, outbound_id])
        return reply

    async def on_text(
        self,
        user_id: int,
        chat_id: int,
        text: str,
        telegram_message_id=None,
        first_name: str | None = None,
        last_name: str | None = None,
        username: str | None = None,
    ) -> Reply:
        customer = self.db.customer_by_telegram_id(user_id)
        if customer is None:
            if chat_id < 0:
                return Reply(onboarding.GROUP_SIGNUP_REPLY)
            signup = self.db.open_signup(user_id)
            outcome = onboarding.handle_text(signup, text)
            if outcome.action == "create":
                telegram_name = " ".join(p for p in (first_name, last_name) if p) or None
                self.db.create_signup(user_id, chat_id, telegram_name, username)
            elif outcome.action == "advance":
                self.db.save_signup_answer(signup["id"], outcome.field, outcome.value, outcome.next_step)
            return Reply(outcome.reply_text, reply_markup=_markup_for(outcome))
        conversation_id = self.db.conversation_id(customer.id, chat_id)
        history = self.db.recent_messages(conversation_id)
        draft = self.db.open_draft(customer.id, conversation_id)
        inbound_id = self.db.save_message(conversation_id, "in", "customer", "text", text, telegram_message_id)
        t0 = time.monotonic()
        recent_count = self.db.recent_inbound_count(conversation_id, self.flood_window_seconds)
        repeat_count = self.db.recent_repeat_count(conversation_id, text, self.flood_window_seconds)
        flagged = screen(
            text,
            recent_count,
            self.screen_rules,
            flood_max=self.flood_max_messages,
            repeat_count=repeat_count,
            repeat_max=self.repeat_max_messages,
        )
        latency_ms = int((time.monotonic() - t0) * 1000)
        if flagged is not None:
            decision, reason = flagged
            self.db.log_screening(
                user_id,
                decision,
                reason,
                latency_ms,
                message_id=inbound_id,
                conversation_id=conversation_id,
                status="held",
            )
            self.db.save_message(conversation_id, "out", "bot", "text", FLAGGED_REPLY)
            return Reply(FLAGGED_REPLY)
        return await self._reply_to_text(customer, conversation_id, inbound_id, text, history, draft)

    async def process_released_flags(self, bot) -> int:
        processed = 0
        while (flag := self.db.claim_released_flag()) is not None:
            try:
                conversation_id = flag["conversation_id"]
                chat_id = flag["telegram_chat_id"]
                if flag["kind"] == "text":
                    customer = Customer(
                        id=flag["customer_id"],
                        name=flag["customer_name"],
                        tier_id=flag["tier_id"],
                    )
                    history = self.db.history_before(conversation_id, flag["created_at"])
                    draft = self.db.open_draft(customer.id, conversation_id)
                    reply = await self._reply_to_text(
                        customer,
                        conversation_id,
                        flag["message_id"],
                        flag["body"] or "",
                        history,
                        draft,
                    )
                    markup = buttons(reply.order_id) if reply.order_id else None
                    text = reply.text
                else:
                    text = RESEND_FILE_REPLY
                    markup = None
                    self.db.save_message(conversation_id, "out", "bot", "text", text)
                if chat_id > 0:
                    await bot.send_message(chat_id=chat_id, text=text, reply_markup=markup)
                processed += 1
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Failed to process released flag %s", flag["id"])
        return processed

    def _render_draft(self, customer, draft: dict) -> tuple[str, str | None]:
        products = self.db.price_and_stock(customer.tier_id, [line["sku"] for line in draft["lines"]])
        lines, unpriced, total = orders.price_lines(draft["lines"], products)
        if unpriced:
            return join(orders.dropped_text(unpriced), RESEND_ORDER_REPLY), None
        return orders.draft_text(lines, products, total, []), draft["id"]

    def compose(self, customer, conversation_id, reading, source: str = "text", draft: dict | None = None) -> Reply:
        if reading is None:
            return Reply(READ_FAILED)
        facts = orders.reply_facts(self.db.price_and_stock(customer.tier_id, orders.placeholder_skus(reading.reply)))
        said = orders.fill_placeholders(reading.reply, facts).strip()
        if reading.intent == "price-list":
            return Reply(join(said, orders.price_list_text(self.db.price_list(customer.tier_id))))
        if reading.intent == "follow-up" and not reading.edit_draft and draft and draft.get("lines"):
            body, order_id = self._render_draft(customer, draft)
            return Reply(join(said, body), order_id)
        if reading.intent in DRAFT_REMINDER_INTENTS and not reading.edit_draft and draft and draft.get("lines"):
            body, order_id = self._render_draft(customer, draft)
            return Reply(join(said, OPEN_DRAFT_REMINDER, body), order_id)
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

    async def on_contact(
        self,
        user_id: int,
        chat_id: int,
        phone_number: str,
        contact_user_id: int | None,
    ) -> Reply | None:
        customer = self.db.customer_by_telegram_id(user_id)
        if customer is not None:
            return None
        if chat_id < 0:
            return Reply(onboarding.GROUP_SIGNUP_REPLY)
        signup = self.db.open_signup(user_id)
        outcome = onboarding.handle_contact(signup, user_id, phone_number, contact_user_id)
        if outcome is None:
            return None
        if outcome.action == "advance":
            self.db.save_signup_answer(signup["id"], outcome.field, outcome.value, outcome.next_step)
        return Reply(outcome.reply_text, reply_markup=_markup_for(outcome))

    async def on_signup_button(self, user_id: int, chat_id: int, action: str) -> Reply:
        customer = self.db.customer_by_telegram_id(user_id)
        if customer is not None:
            return Reply(ALREADY_HANDLED)
        if chat_id < 0:
            return Reply(onboarding.GROUP_SIGNUP_REPLY)
        signup = self.db.open_signup(user_id)
        outcome = onboarding.handle_button(signup, action)
        if outcome.action == "submit":
            self.db.submit_signup(signup["id"])
        elif outcome.action == "restart":
            self.db.restart_signup(signup["id"])
        return Reply(outcome.reply_text, reply_markup=_markup_for(outcome))

    def on_unknown_file(self, user_id: int, chat_id: int) -> Reply:
        if chat_id < 0:
            return Reply(onboarding.GROUP_SIGNUP_REPLY)
        return Reply(onboarding.UNKNOWN_FILE_REPLY)

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
            return self.on_unknown_file(user_id, chat_id)
        conversation_id = self.db.conversation_id(customer.id, chat_id)
        history = self.db.recent_messages(conversation_id)
        draft = self.db.open_draft(customer.id, conversation_id)
        inbound_id = self.db.save_message(
            conversation_id, "in", "customer", kind, caption, telegram_message_id, file_name, file_mime
        )
        t0 = time.monotonic()
        recent_count = self.db.recent_inbound_count(conversation_id, self.flood_window_seconds)
        latency_ms = int((time.monotonic() - t0) * 1000)
        if recent_count > self.flood_max_messages:
            self.db.log_screening(
                user_id,
                "rate_limited",
                f"{recent_count} messages in window",
                latency_ms,
                message_id=inbound_id,
                conversation_id=conversation_id,
                status="held",
            )
            self.db.save_message(conversation_id, "out", "bot", "text", FLAGGED_REPLY)
            return Reply(FLAGGED_REPLY)
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


def phone_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton("Share my number", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def signup_review_buttons() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("Submit", callback_data="signup:submit"),
        InlineKeyboardButton("Start over", callback_data="signup:restart"),
    ]])


def _markup_for(outcome: onboarding.StepOutcome) -> object | None:
    if outcome.keyboard == "phone":
        return phone_keyboard()
    if outcome.keyboard == "remove":
        return ReplyKeyboardRemove()
    if outcome.keyboard == "review":
        return signup_review_buttons()
    return None


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


async def process_signup_notices(app: Application, db: Database) -> int:
    sent = 0
    failed: list[int] = []
    try:
        while (notice := db.claim_due_signup_notice()) is not None:
            try:
                text = onboarding.format_notice(notice)
                if notice["telegram_chat_id"] > 0:
                    await app.bot.send_message(chat_id=notice["telegram_chat_id"], text=text)
                sent += 1
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Failed to send signup notice %s", notice["id"])
                failed.append(notice["id"])
    finally:
        for failed_id in failed:
            db.clear_signup_notice(failed_id)
    return sent


async def process_reject_notices(app: Application, db: Database) -> int:
    sent = 0
    failed: list[str] = []
    try:
        while (notice := db.claim_due_reject_notice()) is not None:
            try:
                text = REJECT_NOTICE_TEXT.format(ref=order_ref(notice))
                if notice["telegram_chat_id"] > 0:
                    await app.bot.send_message(chat_id=notice["telegram_chat_id"], text=text)
                msg_id = db.save_message(notice["conversation_id"], "out", "bot", "text", text)
                db.link_messages(notice["id"], [msg_id])
                sent += 1
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Failed to send reject notice for order %s", notice["id"])
                failed.append(notice["id"])
    finally:
        for failed_id in failed:
            db.clear_reject_notice(failed_id)
    return sent


def build_app(token: str, bot: OrderBot, poll_seconds: float = 5.0) -> Application:
    async def text_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        msg = update.effective_message
        user = update.effective_user
        reply = await bot.on_text(
            user.id,
            msg.chat_id,
            msg.text,
            msg.message_id,
            first_name=user.first_name if user else None,
            last_name=user.last_name if user else None,
            username=user.username if user else None,
        )
        markup = reply.reply_markup if reply.reply_markup is not None else (buttons(reply.order_id) if reply.order_id else None)
        await msg.reply_text(reply.text, reply_markup=markup)

    async def contact_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        msg = update.effective_message
        contact = msg.contact
        reply = await bot.on_contact(
            update.effective_user.id,
            msg.chat_id,
            contact.phone_number,
            contact.user_id,
        )
        if reply is not None:
            await msg.reply_text(reply.text, reply_markup=reply.reply_markup)

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

    async def signup_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        action = query.data.split(":", 1)[1]
        reply = await bot.on_signup_button(update.effective_user.id, query.message.chat_id, action)
        await query.edit_message_reply_markup(reply_markup=None)
        await query.message.reply_text(reply.text, reply_markup=reply.reply_markup)

    async def file_handler(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
        msg = update.effective_message
        user_id = update.effective_user.id
        if bot.db.customer_by_telegram_id(user_id) is None:
            reply = bot.on_unknown_file(user_id, msg.chat_id)
            await msg.reply_text(reply.text, reply_markup=reply.reply_markup)
            return
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
            user_id, msg.chat_id, kind, msg.caption, file_name, file_mime, file_bytes, msg.message_id
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
            try:
                await bot.process_released_flags(application.bot)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Released flag poll failed")
            try:
                await process_signup_notices(application, bot.db)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Signup notice poll failed")
            try:
                await process_reject_notices(application, bot.db)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Reject notice poll failed")
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
    app.add_handler(MessageHandler(filters.CONTACT, contact_handler))
    app.add_handler(CallbackQueryHandler(button_handler, pattern=r"^(confirm|cancel|receipt):"))
    app.add_handler(CallbackQueryHandler(signup_handler, pattern=r"^signup:(submit|restart)$"))
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
            settings.FLOOD_MAX_MESSAGES,
            settings.FLOOD_WINDOW_SECONDS,
            repeat_max_messages=settings.REPEAT_MAX_MESSAGES,
        ),
        poll_seconds=settings.poll_seconds,
    ).run_polling()


if __name__ == "__main__":
    main()
