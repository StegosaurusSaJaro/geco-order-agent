import asyncio
from types import SimpleNamespace

from telegram import InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove

from conftest import answer, scalar
from geco_bot import main
from geco_bot.onboarding import (
    GROUP_SIGNUP_REPLY,
    INVALID_ADDRESS,
    INVALID_BUSINESS_NAME,
    INVALID_CONTACT_NAME,
    INVALID_PHONE,
    INVALID_PHONE_OTHER_CONTACT,
    PENDING_REPLY,
    QUESTIONS,
    REJECTED_NOTICE,
    SUBMITTED_REPLY,
    UNKNOWN_FILE_REPLY,
    WELCOME,
    format_notice,
    handle_button,
    handle_contact,
    handle_text,
    review_summary,
)

STAFF_ID = "00000000-0000-4000-8000-000000000001"


def run(coro):
    return asyncio.run(coro)


def _complete_to_review(bot, user_id: int, chat_id: int):
    run(bot.on_text(user_id, chat_id, "Hi", first_name="Alice", last_name="Tan", username="alicetan"))
    run(bot.on_text(user_id, chat_id, "Kopi Corner"))
    run(bot.on_text(user_id, chat_id, "Alice Tan"))
    run(bot.on_text(user_id, chat_id, "+65 9123 4567"))
    return run(bot.on_text(user_id, chat_id, "123 Orchard Rd #01-02, Singapore"))


def _decide(db, signup_id: int, decision: str, name: str | None = None, kind: str | None = None, tier_id: int | None = None):
    with db.pool.connection() as conn, conn.transaction():
        conn.execute("select set_config('request.jwt.claim.sub', %s, true)", (STAFF_ID,))
        row = conn.execute(
            "select decide_signup(%s, %s, %s, %s, %s::smallint)",
            (signup_id, decision, name, kind, tier_id),
        ).fetchone()
    return next(iter(row.values()))


def test_unit_first_message_starts_signup():
    outcome = handle_text(None, "Hi, I want to order coffee")
    assert outcome.action == "create"
    assert outcome.reply_text == WELCOME
    assert outcome.next_step == "business_name"
    assert outcome.keyboard is None


def test_unit_full_flow_to_review():
    signup = {"status": "collecting", "step": "business_name"}

    o1 = handle_text(signup, "  Kopi Corner  ")
    assert o1.action == "advance"
    assert o1.field == "business_name"
    assert o1.value == "Kopi Corner"
    assert o1.next_step == "contact_name"
    assert o1.reply_text == QUESTIONS["contact_name"]
    assert o1.keyboard is None

    signup.update({"step": o1.next_step, o1.field: o1.value})
    o2 = handle_text(signup, "Alice Tan")
    assert o2.action == "advance"
    assert o2.field == "contact_name"
    assert o2.value == "Alice Tan"
    assert o2.next_step == "phone"
    assert o2.reply_text == QUESTIONS["phone"]
    assert o2.keyboard == "phone"

    signup.update({"step": o2.next_step, o2.field: o2.value})
    o3 = handle_text(signup, "+65 9123 4567")
    assert o3.action == "advance"
    assert o3.field == "phone"
    assert o3.value == "+65 9123 4567"
    assert o3.next_step == "address"
    assert o3.reply_text == QUESTIONS["address"]
    assert o3.keyboard == "remove"

    signup.update({"step": o3.next_step, o3.field: o3.value})
    o4 = handle_text(signup, "123 Orchard Rd #01-02, Singapore")
    assert o4.action == "advance"
    assert o4.field == "delivery_address"
    assert o4.value == "123 Orchard Rd #01-02, Singapore"
    assert o4.next_step == "review"
    assert o4.keyboard == "review"
    assert o4.reply_text == (
        "Please check your details:\n"
        "Business: Kopi Corner\n"
        "Contact: Alice Tan\n"
        "Phone: +65 9123 4567\n"
        "Delivery address: 123 Orchard Rd #01-02, Singapore"
    )


def test_review_text_repeats_summary():
    signup = {
        "status": "collecting",
        "step": "review",
        "business_name": "Kopi Corner",
        "contact_name": "Alice Tan",
        "phone": "+65 9123 4567",
        "delivery_address": "123 Orchard Rd",
    }
    outcome = handle_text(signup, "looks good")
    assert outcome.action == "reprompt"
    assert outcome.reply_text == review_summary(signup)
    assert outcome.keyboard == "review"


def test_unit_submit_then_waiting():
    signup = {
        "status": "collecting",
        "step": "review",
        "business_name": "Kopi Corner",
        "contact_name": "Alice Tan",
        "phone": "+65 9123 4567",
        "delivery_address": "123 Orchard Rd",
    }
    sub = handle_button(signup, "submit")
    assert sub.action == "submit"
    assert sub.reply_text == SUBMITTED_REPLY

    pending_signup = {**signup, "status": "pending"}
    wait_text = handle_text(pending_signup, "hello?")
    assert wait_text.action == "noop"
    assert wait_text.reply_text == PENDING_REPLY

    wait_btn = handle_button(pending_signup, "submit")
    assert wait_btn.action == "noop"
    assert wait_btn.reply_text == PENDING_REPLY


def test_unit_invalid_answers_reprompt():
    o_biz = handle_text({"status": "collecting", "step": "business_name"}, "A")
    assert o_biz.action == "reprompt"
    assert o_biz.reply_text == f"{INVALID_BUSINESS_NAME}\n{QUESTIONS['business_name']}"

    o_biz_long = handle_text({"status": "collecting", "step": "business_name"}, "x" * 121)
    assert o_biz_long.action == "reprompt"

    o_contact = handle_text({"status": "collecting", "step": "contact_name"}, "B")
    assert o_contact.action == "reprompt"
    assert o_contact.reply_text == f"{INVALID_CONTACT_NAME}\n{QUESTIONS['contact_name']}"

    o_phone = handle_text({"status": "collecting", "step": "phone"}, "abc")
    assert o_phone.action == "reprompt"
    assert o_phone.reply_text == f"{INVALID_PHONE}\n{QUESTIONS['phone']}"
    assert o_phone.keyboard == "phone"

    o_phone_long = handle_text({"status": "collecting", "step": "phone"}, "+12345678901234567890")
    assert o_phone_long.action == "reprompt"

    o_addr = handle_text({"status": "collecting", "step": "address"}, "123")
    assert o_addr.action == "reprompt"
    assert o_addr.reply_text == f"{INVALID_ADDRESS}\n{QUESTIONS['address']}"


def test_unit_phone_contact_must_be_sender():
    signup = {"status": "collecting", "step": "phone"}

    other = handle_contact(signup, sender_user_id=100, phone_number="+6591234567", contact_user_id=200)
    assert other is not None
    assert other.action == "reprompt"
    assert other.reply_text == f"{INVALID_PHONE_OTHER_CONTACT}\n{QUESTIONS['phone']}"
    assert other.keyboard == "phone"

    missing_uid = handle_contact(signup, sender_user_id=100, phone_number="+6591234567", contact_user_id=None)
    assert missing_uid is not None
    assert missing_uid.action == "reprompt"
    assert missing_uid.reply_text == f"{INVALID_PHONE_OTHER_CONTACT}\n{QUESTIONS['phone']}"

    own = handle_contact(signup, sender_user_id=100, phone_number="+6591234567", contact_user_id=100)
    assert own is not None
    assert own.action == "advance"
    assert own.field == "phone"
    assert own.value == "+6591234567"
    assert own.next_step == "address"
    assert own.keyboard == "remove"

    assert handle_contact(None, sender_user_id=100, phone_number="+6591234567", contact_user_id=100) is None
    assert (
        handle_contact(
            {"status": "collecting", "step": "business_name"},
            sender_user_id=100,
            phone_number="+6591234567",
            contact_user_id=100,
        )
        is None
    )


def test_unit_restart():
    signup = {
        "status": "collecting",
        "step": "review",
        "business_name": "Kopi Corner",
        "contact_name": "Alice Tan",
        "phone": "+65 9123 4567",
        "delivery_address": "123 Orchard Rd",
    }
    outcome = handle_button(signup, "restart")
    assert outcome.action == "restart"
    assert outcome.next_step == "business_name"
    assert outcome.reply_text == QUESTIONS["business_name"]


def test_format_notice():
    approved = format_notice({"status": "approved", "customer_name": "Kopi Corner"})
    assert approved == (
        'You\'re all set, Kopi Corner! You can now order here. '
        'Just type what you need, for example "10 bags of Arabica".'
    )
    rejected = format_notice({"status": "rejected"})
    assert rejected == REJECTED_NOTICE


def test_first_message_starts_signup(bot, db):
    reply = run(bot.on_text(7001, 7001, "Hi there", first_name="Alice", last_name="Tan", username="alicetan"))
    assert reply.text == WELCOME
    assert reply.reply_markup is None
    signup = db.open_signup(7001)
    assert signup is not None
    assert signup["status"] == "collecting"
    assert signup["step"] == "business_name"
    assert signup["telegram_chat_id"] == 7001
    assert signup["telegram_name"] == "Alice Tan"
    assert signup["telegram_username"] == "alicetan"


def test_unknown_sender_never_reaches_model(bot, reader, monkeypatch):
    async def fail_read(*_args, **_kwargs):
        raise AssertionError("reader.read must not be called for unknown sender")

    monkeypatch.setattr(reader, "read", fail_read)
    assert run(bot.on_text(7002, 7002, "Hello")).text == WELCOME
    assert run(bot.on_text(7002, 7002, "Kopi Corner")).text == QUESTIONS["contact_name"]
    assert run(bot.on_text(7002, 7002, "Alice Tan")).text == QUESTIONS["phone"]
    assert run(bot.on_text(7002, 7002, "+65 9123 4567")).text == QUESTIONS["address"]
    assert "Please check your details:" in run(bot.on_text(7002, 7002, "123 Orchard Rd")).text
    assert run(bot.on_signup_button(7002, 7002, "submit")).text == SUBMITTED_REPLY
    assert run(bot.on_text(7002, 7002, "10 bags of Arabica")).text == PENDING_REPLY


def test_full_flow_to_review(bot, db):
    r0 = run(bot.on_text(7003, 7003, "Start", first_name="Bob", username="bob_g"))
    assert r0.text == WELCOME

    r1 = run(bot.on_text(7003, 7003, "  Kopi Corner  "))
    assert r1.text == QUESTIONS["contact_name"]
    assert r1.reply_markup is None

    r2 = run(bot.on_text(7003, 7003, "Alice Tan"))
    assert r2.text == QUESTIONS["phone"]
    assert isinstance(r2.reply_markup, ReplyKeyboardMarkup)
    assert r2.reply_markup.keyboard[0][0].request_contact is True

    r3 = run(bot.on_text(7003, 7003, "+65 9123 4567"))
    assert r3.text == QUESTIONS["address"]
    assert isinstance(r3.reply_markup, ReplyKeyboardRemove)

    r4 = run(bot.on_text(7003, 7003, "123 Orchard Rd #01-02, Singapore"))
    assert r4.text == (
        "Please check your details:\n"
        "Business: Kopi Corner\n"
        "Contact: Alice Tan\n"
        "Phone: +65 9123 4567\n"
        "Delivery address: 123 Orchard Rd #01-02, Singapore"
    )
    assert isinstance(r4.reply_markup, InlineKeyboardMarkup)
    callbacks = [btn.callback_data for btn in r4.reply_markup.inline_keyboard[0]]
    assert callbacks == ["signup:submit", "signup:restart"]

    signup = db.open_signup(7003)
    assert signup["status"] == "collecting"
    assert signup["step"] == "review"
    assert signup["business_name"] == "Kopi Corner"
    assert signup["contact_name"] == "Alice Tan"
    assert signup["phone"] == "+65 9123 4567"
    assert signup["delivery_address"] == "123 Orchard Rd #01-02, Singapore"


def test_submit_then_waiting(bot, db):
    _complete_to_review(bot, 7004, 7004)
    r_submit = run(bot.on_signup_button(7004, 7004, "submit"))
    assert r_submit.text == SUBMITTED_REPLY

    signup = db.open_signup(7004)
    assert signup["status"] == "pending"
    assert scalar(db, "select submitted_at is not null from signups where id = %s", signup["id"]) is True

    r_wait = run(bot.on_text(7004, 7004, "Are you there?"))
    assert r_wait.text == PENDING_REPLY
    r_btn = run(bot.on_signup_button(7004, 7004, "restart"))
    assert r_btn.text == PENDING_REPLY
    assert db.open_signup(7004)["step"] == "review"


def test_invalid_answers_reprompt(bot, db):
    run(bot.on_text(7005, 7005, "hi"))

    r_biz = run(bot.on_text(7005, 7005, "A"))
    assert r_biz.text == f"{INVALID_BUSINESS_NAME}\n{QUESTIONS['business_name']}"
    assert db.open_signup(7005)["step"] == "business_name"

    run(bot.on_text(7005, 7005, "Kopi Corner"))
    r_contact = run(bot.on_text(7005, 7005, "B"))
    assert r_contact.text == f"{INVALID_CONTACT_NAME}\n{QUESTIONS['contact_name']}"
    assert db.open_signup(7005)["step"] == "contact_name"

    run(bot.on_text(7005, 7005, "Alice Tan"))
    r_phone = run(bot.on_text(7005, 7005, "abc"))
    assert r_phone.text == f"{INVALID_PHONE}\n{QUESTIONS['phone']}"
    assert isinstance(r_phone.reply_markup, ReplyKeyboardMarkup)
    assert db.open_signup(7005)["step"] == "phone"

    run(bot.on_text(7005, 7005, "+65 9123 4567"))
    r_addr = run(bot.on_text(7005, 7005, "123"))
    assert r_addr.text == f"{INVALID_ADDRESS}\n{QUESTIONS['address']}"
    assert db.open_signup(7005)["step"] == "address"


def test_phone_contact_must_be_sender(bot, db):
    run(bot.on_text(7006, 7006, "hi"))
    run(bot.on_text(7006, 7006, "Kopi Corner"))
    run(bot.on_text(7006, 7006, "Alice Tan"))

    r_other = run(bot.on_contact(7006, 7006, "+6591234567", contact_user_id=9999))
    assert r_other is not None
    assert r_other.text == f"{INVALID_PHONE_OTHER_CONTACT}\n{QUESTIONS['phone']}"
    assert isinstance(r_other.reply_markup, ReplyKeyboardMarkup)
    assert db.open_signup(7006)["step"] == "phone"

    r_own = run(bot.on_contact(7006, 7006, "+6591234567", contact_user_id=7006))
    assert r_own is not None
    assert r_own.text == QUESTIONS["address"]
    assert isinstance(r_own.reply_markup, ReplyKeyboardRemove)
    assert db.open_signup(7006)["phone"] == "+6591234567"
    assert db.open_signup(7006)["step"] == "address"

    run(bot.on_text(7007, 7007, "hi"))
    run(bot.on_text(7007, 7007, "Bean Co"))
    run(bot.on_text(7007, 7007, "Bob Lee"))
    r_typed = run(bot.on_text(7007, 7007, "+65 8111 2222"))
    assert r_typed.text == QUESTIONS["address"]
    assert isinstance(r_typed.reply_markup, ReplyKeyboardRemove)
    assert db.open_signup(7007)["phone"] == "+65 8111 2222"


def test_restart(bot, db):
    _complete_to_review(bot, 7008, 7008)
    r_restart = run(bot.on_signup_button(7008, 7008, "restart"))
    assert r_restart.text == QUESTIONS["business_name"]

    signup = db.open_signup(7008)
    assert signup["status"] == "collecting"
    assert signup["step"] == "business_name"
    assert signup["business_name"] is None
    assert signup["contact_name"] is None
    assert signup["phone"] is None
    assert signup["delivery_address"] is None


def test_group_chat_no_write(bot, db):
    before = scalar(db, "select count(*) from signups")
    assert run(bot.on_text(7009, -1001, "hi")).text == GROUP_SIGNUP_REPLY
    assert run(bot.on_contact(7009, -1001, "+6591234567", 7009)).text == GROUP_SIGNUP_REPLY
    assert run(bot.on_signup_button(7009, -1001, "submit")).text == GROUP_SIGNUP_REPLY
    assert bot.on_unknown_file(7009, -1001).text == GROUP_SIGNUP_REPLY
    assert scalar(db, "select count(*) from signups") == before


def test_unknown_file_not_downloaded(bot, db):
    app = main.build_app("123456:TESTTOKEN", bot)
    file_handler = app.handlers[0][-1]

    replies = []

    async def fake_reply_text(text, reply_markup=None):
        replies.append((text, reply_markup))

    async def fail_get_file():
        raise AssertionError("get_file must not be called for unknown sender")

    doc_msg = SimpleNamespace(
        chat_id=7010,
        message_id=1,
        caption=None,
        document=SimpleNamespace(get_file=fail_get_file, file_name="order.pdf", mime_type="application/pdf"),
        photo=[],
        reply_text=fake_reply_text,
    )
    doc_update = SimpleNamespace(
        effective_message=doc_msg,
        effective_user=SimpleNamespace(id=7010),
    )
    run(file_handler.callback(doc_update, None))

    photo_msg = SimpleNamespace(
        chat_id=7010,
        message_id=2,
        caption=None,
        document=None,
        photo=[SimpleNamespace(get_file=fail_get_file)],
        reply_text=fake_reply_text,
    )
    photo_update = SimpleNamespace(
        effective_message=photo_msg,
        effective_user=SimpleNamespace(id=7010),
    )
    run(file_handler.callback(photo_update, None))

    assert replies == [(UNKNOWN_FILE_REPLY, None), (UNKNOWN_FILE_REPLY, None)]
    assert scalar(db, "select count(*) from signups") == 0


def test_approved_user_can_order(bot, db, reader, monkeypatch):
    _complete_to_review(bot, 7011, 7011)
    run(bot.on_signup_button(7011, 7011, "submit"))
    signup = db.open_signup(7011)
    tier_id = scalar(db, "select id from tiers order by id limit 1")
    assert _decide(db, signup["id"], "approve", "Kopi Corner", "cafe", tier_id) == "approved"

    called = []

    async def fake_run(_model, _prompt):
        called.append(True)
        return reader.schema.model_validate({
            "intent": "order",
            "po_number": None,
            "lines": [{"sku": "COF-ARB-1K", "quantity": 10, "unit": "BAG1KG", "raw_text": "10 bags of Arabica"}],
            "reply": "Got it.",
        })

    monkeypatch.setattr(reader, "run_agent", fake_run)
    reply = run(bot.on_text(7011, 7011, "10 bags of Arabica"))
    assert called == [True]
    assert reply.order_id is not None


def test_notice_sent_once(bot, db):
    _complete_to_review(bot, 7012, 7012)
    run(bot.on_signup_button(7012, 7012, "submit"))
    signup = db.open_signup(7012)
    tier_id = scalar(db, "select id from tiers order by id limit 1")
    assert _decide(db, signup["id"], "approve", "Kopi Corner", "cafe", tier_id) == "approved"

    sent_messages = []

    async def fake_send_message(chat_id, text):
        sent_messages.append((chat_id, text))

    fake_app = SimpleNamespace(bot=SimpleNamespace(send_message=fake_send_message))
    assert run(main.process_signup_notices(fake_app, db)) == 1
    assert run(main.process_signup_notices(fake_app, db)) == 0
    assert len(sent_messages) == 1
    assert sent_messages[0][0] == 7012
    assert "Kopi Corner" in sent_messages[0][1]


def test_failed_notice_does_not_block(bot, db):
    _complete_to_review(bot, 7013, 7013)
    run(bot.on_signup_button(7013, 7013, "submit"))
    s1 = db.open_signup(7013)
    assert _decide(db, s1["id"], "reject") == "rejected"

    _complete_to_review(bot, 7014, 7014)
    run(bot.on_signup_button(7014, 7014, "submit"))
    s2 = db.open_signup(7014)
    tier_id = scalar(db, "select id from tiers order by id limit 1")
    assert _decide(db, s2["id"], "approve", "Second Cafe", "cafe", tier_id) == "approved"

    attempts = {7013: 0, 7014: 0}
    delivered = []

    async def flaky_send_message(chat_id, text):
        attempts[chat_id] += 1
        if chat_id == 7013 and attempts[chat_id] == 1:
            raise RuntimeError("temporary telegram error")
        delivered.append((chat_id, text))

    fake_app = SimpleNamespace(bot=SimpleNamespace(send_message=flaky_send_message))
    assert run(main.process_signup_notices(fake_app, db)) == 1
    assert run(main.process_signup_notices(fake_app, db)) == 1
    assert run(main.process_signup_notices(fake_app, db)) == 0
    assert attempts == {7013: 2, 7014: 1}
    assert [chat_id for chat_id, _ in delivered] == [7014, 7013]


def test_reapply_after_reject(bot, db):
    _complete_to_review(bot, 7015, 7015)
    run(bot.on_signup_button(7015, 7015, "submit"))
    first = db.open_signup(7015)
    assert _decide(db, first["id"], "reject") == "rejected"
    assert db.open_signup(7015) is None

    reply = run(bot.on_text(7015, 7015, "Can I try again?"))
    assert reply.text == WELCOME
    second = db.open_signup(7015)
    assert second is not None
    assert second["id"] != first["id"]
    assert second["status"] == "collecting"
    assert second["step"] == "business_name"


def test_command_is_not_an_answer(bot, db):
    run(bot.on_text(7016, 7016, "hi"))

    r_cmd = run(bot.on_text(7016, 7016, "/start"))
    assert QUESTIONS["business_name"] in r_cmd.text
    signup = db.open_signup(7016)
    assert signup["step"] == "business_name"
    assert signup["business_name"] is None

    run(bot.on_text(7016, 7016, "Kopi Corner"))
    run(bot.on_text(7016, 7016, "Alice Tan"))

    r_phone_cmd = run(bot.on_text(7016, 7016, "/start"))
    assert QUESTIONS["phone"] in r_phone_cmd.text
    assert isinstance(r_phone_cmd.reply_markup, ReplyKeyboardMarkup)
    assert r_phone_cmd.reply_markup.keyboard[0][0].request_contact is True
    signup = db.open_signup(7016)
    assert signup["step"] == "phone"
    assert signup["phone"] is None
