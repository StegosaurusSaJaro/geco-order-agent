import re
from dataclasses import dataclass

WELCOME = (
    "Welcome to GECO! You're not registered yet, so let's set up your account. "
    "It takes four quick questions. What is your business name?"
)

QUESTIONS = {
    "business_name": "What is your business name?",
    "contact_name": "Thanks. What is your name? (the person who will place orders)",
    "phone": "What phone number can GECO reach you on? Tap the button below, or type it.",
    "address": "Where should orders be delivered? (street, building, city)",
}

INVALID_BUSINESS_NAME = "Please type a business name between 2 and 120 characters."
INVALID_CONTACT_NAME = "Please type a contact name between 2 and 80 characters."
INVALID_PHONE = "Please tap Share my number below, or type a valid phone number."
INVALID_PHONE_OTHER_CONTACT = "Please share your own phone number, or type it."
INVALID_ADDRESS = "Please type a delivery address between 5 and 300 characters."
SUBMITTED_REPLY = (
    "Thanks! GECO will review your details and message you here once your account is approved."
)
PENDING_REPLY = (
    "Your details are with GECO for review. We'll message you here once you're approved."
)
UNKNOWN_FILE_REPLY = "Please answer with a text message."
GROUP_SIGNUP_REPLY = "Please message me directly to sign up with GECO."
REJECTED_NOTICE = (
    "Sorry, we couldn't approve your GECO account. Please contact GECO for help. "
    "You can message here again to sign up with different details."
)

PHONE_RE = re.compile(r"^\+?[0-9][0-9 ()-]{6,19}$")


@dataclass(frozen=True)
class StepOutcome:
    action: str
    reply_text: str
    field: str | None = None
    value: str | None = None
    next_step: str | None = None
    keyboard: str | None = None


def review_summary(signup: dict) -> str:
    return (
        "Please check your details:\n"
        f"Business: {signup.get('business_name', '')}\n"
        f"Contact: {signup.get('contact_name', '')}\n"
        f"Phone: {signup.get('phone', '')}\n"
        f"Delivery address: {signup.get('delivery_address', '')}"
    )


def _valid_phone(phone: str) -> bool:
    return len(phone) <= 20 and bool(PHONE_RE.match(phone))


def _reprompt(step: str, message: str, keyboard: str | None = None) -> StepOutcome:
    return StepOutcome(
        action="reprompt",
        reply_text=f"{message}\n{QUESTIONS[step]}",
        keyboard=keyboard,
    )


def handle_text(signup: dict | None, text: str) -> StepOutcome:
    if signup is None:
        return StepOutcome(
            action="create",
            reply_text=WELCOME,
            next_step="business_name",
        )
    if signup.get("status") == "pending":
        return StepOutcome(action="noop", reply_text=PENDING_REPLY)

    step = signup.get("step")
    trimmed = (text or "").strip()

    if step == "business_name":
        if 2 <= len(trimmed) <= 120:
            return StepOutcome(
                action="advance",
                reply_text=QUESTIONS["contact_name"],
                field="business_name",
                value=trimmed,
                next_step="contact_name",
            )
        return _reprompt("business_name", INVALID_BUSINESS_NAME)

    if step == "contact_name":
        if 2 <= len(trimmed) <= 80:
            return StepOutcome(
                action="advance",
                reply_text=QUESTIONS["phone"],
                field="contact_name",
                value=trimmed,
                next_step="phone",
                keyboard="phone",
            )
        return _reprompt("contact_name", INVALID_CONTACT_NAME)

    if step == "phone":
        if _valid_phone(trimmed):
            return StepOutcome(
                action="advance",
                reply_text=QUESTIONS["address"],
                field="phone",
                value=trimmed,
                next_step="address",
                keyboard="remove",
            )
        return _reprompt("phone", INVALID_PHONE, keyboard="phone")

    if step == "address":
        if 5 <= len(trimmed) <= 300:
            updated = {**signup, "delivery_address": trimmed}
            return StepOutcome(
                action="advance",
                reply_text=review_summary(updated),
                field="delivery_address",
                value=trimmed,
                next_step="review",
                keyboard="review",
            )
        return _reprompt("address", INVALID_ADDRESS)

    return StepOutcome(
        action="reprompt",
        reply_text=review_summary(signup),
        keyboard="review",
    )


def handle_contact(
    signup: dict | None,
    sender_user_id: int,
    phone_number: str,
    contact_user_id: int | None,
) -> StepOutcome | None:
    if signup is None:
        return None
    if signup.get("status") == "pending":
        return StepOutcome(action="noop", reply_text=PENDING_REPLY)
    if signup.get("status") != "collecting" or signup.get("step") != "phone":
        return None
    if contact_user_id != sender_user_id:
        return _reprompt("phone", INVALID_PHONE_OTHER_CONTACT, keyboard="phone")
    trimmed = (phone_number or "").strip()
    if not _valid_phone(trimmed):
        return _reprompt("phone", INVALID_PHONE, keyboard="phone")
    return StepOutcome(
        action="advance",
        reply_text=QUESTIONS["address"],
        field="phone",
        value=trimmed,
        next_step="address",
        keyboard="remove",
    )


def handle_button(signup: dict | None, action: str) -> StepOutcome:
    if signup is None:
        return StepOutcome(action="noop", reply_text=WELCOME)
    if signup.get("status") == "pending":
        return StepOutcome(action="noop", reply_text=PENDING_REPLY)

    step = signup.get("step")
    if action == "restart":
        return StepOutcome(
            action="restart",
            reply_text=QUESTIONS["business_name"],
            next_step="business_name",
        )
    if action == "submit" and step == "review":
        return StepOutcome(action="submit", reply_text=SUBMITTED_REPLY)
    if step == "review":
        return StepOutcome(
            action="reprompt",
            reply_text=review_summary(signup),
            keyboard="review",
        )
    return StepOutcome(
        action="reprompt",
        reply_text=QUESTIONS[step],
        keyboard="phone" if step == "phone" else None,
    )


def format_notice(notice: dict) -> str:
    if notice.get("status") == "approved":
        return (
            f'You\'re all set, {notice["customer_name"]}! '
            'You can now order here. Just type what you need, for example "10 bags of Arabica".'
        )
    return REJECTED_NOTICE
