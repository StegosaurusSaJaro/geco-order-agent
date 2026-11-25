import asyncio
import base64
import zlib
from io import BytesIO

import openpyxl

from conftest import answer, scalar
from geco_bot import main

CAFE, HOTEL = -100001, -100006
CHAT = 555
OAT = "DRY-OAT-1L"

XLS_ZLIB_B64 = (
    "eNrtmE1oE1EQgGc3m2STJmkSq9AKZSn4VytavahQY1u1B20bU0VRQTfJtobEbNhNEBW0WnsURE+Kl2IvXqpe/EERxYsHoaIHQRBaiydPBQUPbeO8yctaaw4GtKjsLDvvZ2a+93bf3yavxkMTI3cbJmGBbAMHzBU94JpXJ+DtKReCgPZikWXLqYx30ZZ/SjwyDqTLCY/8L91sDNl4T4IId6RnqAE+4H0EctCjZzVlEaWD+qAKrA9tqAW4gTUBqKdehUknSC8hfZs8H5PeTjWXSLeh74RwCMYjPc2b+Sw+KDaRLQCMe59i3lFNKyyFF2wWn7sslHyd0G6k1MzfaWiUfDAKOG5dWlYz1MwE1OEAjsKXogLwubxSnyp2/eLWC4D1X3+sd1eovypKAINQPEYTfBi8cEViFhGivTMwjVMb6G4C6FOzSVOJaaZu5JV1ygFNS2dOKX2FXA6TXiOpGbgzU6oYWr8XA9p7dvSt27CldSNuy7GCeXyrktVxqkQNPVlI5GsAOlVTM9fvz6byJrYaVRNpTDp1M49ence1RFpL+gF0NY8txFUjZeZVB1r29fhw6ekJXVVy+klsEN1b0wPoMoAGNXNCzyaV/oxeMNC7o70rABBXM6Z6IpVQBjLqaY1V79uD6FRCSyqJQk7JpJImLr/obi87YWhHCv6wI/lppfpQJ6GW8iFar0E8c2ZuTb/ujkcjR6lmkE6h0lm1gr1eKMJ5FoHBAbJ4STvxbqaItaQvEHU55RtI16EPpiujS3lm1xD5XCTrSmxnE8mbyKp5+dWYH/6090Hj8FRkDebHuiZP1429jYzgIHqw9wJdQ9AitAjXrzF5GCmnAt/X3pOu/2mPk8Ug73uRH8i1MMufJ0T6CQTo2UP8kihGrBAjUgx7S6VS+Y2WSg4sOYgnY0mySFIFkkQkicdKRHJaJRFLLqvEuG6rxLgyfy4WIS0gO4nMvjjOiqzEyE082klkr2Vj5OdnSixXBZaLWDXc30WsZZzlIpbPsjHW4e4Sy12B5SaWn/u7iRXmLDexApaNsabaSiy5AksmVi33l4m1kbNkYgUtG2PdfFhieSqwPMQKcX8PsWKc5SFW2LIxVgMO8UeacyKNucQ3Jgm2iWG4x6YDnqXfxQu22GKLLbbYYsv/IAL93AD62pP4dzH7VnLz/3Vm8Z6z/yb5byUGOl55/GG6E7KYGnCqqvmzDJxCmSX8Ykz5/0ImB7B1A9IQp36kq56/+PUqzH+eXw4M/r4lVG37c9X08w+3/w2kqyOB"
)


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


def oat_lines(quantity=3):
    return [{"sku": OAT, "quantity": quantity, "unit": "CTN12", "raw_text": f"{quantity} ctn oat milk"}]


def build_xlsx_bytes():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws["A1"] = "PO-2026-XLSX"
    ws.merge_cells("A1:C1")
    ws["A2"] = "Product"
    ws["B2"] = "Qty"
    ws["C2"] = "Unit"
    ws["A3"] = "Oat Milk"
    ws["B3"] = 4
    ws["C3"] = "CTN12"
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_pdf_file_order(bot, db, reader, monkeypatch):
    calls = capture_agent(reader, monkeypatch, intent="order", po_number="PO-2026-001", lines=oat_lines(), reply="Got it.")
    reply = run(bot.on_file(CAFE, CHAT, "file", None, "po.pdf", "application/pdf", b"%PDF-1.4 test"))
    assert reply.order_id is not None
    assert len(calls) == 1
    parts = calls[0][1]
    assert any(p.inline_data and p.inline_data.mime_type == "application/pdf" and p.inline_data.data == b"%PDF-1.4 test" for p in parts)
    assert scalar(db, "select source::text from orders where id = %s", reply.order_id) == "pdf"
    assert scalar(db, "select po_number from orders where id = %s", reply.order_id) == "PO-2026-001"
    assert scalar(db, "select count(*) from order_messages where order_id = %s", reply.order_id) == 2


def test_photo_order(bot, db, reader, monkeypatch):
    calls = capture_agent(reader, monkeypatch, intent="order", lines=oat_lines(), reply="Got it.")
    reply = run(bot.on_file(CAFE, CHAT, "photo", None, None, "image/jpeg", b"\xff\xd8\xff\xe0test"))
    assert reply.order_id is not None
    assert len(calls) == 1
    parts = calls[0][1]
    assert any(p.inline_data and p.inline_data.mime_type == "image/jpeg" and p.inline_data.data == b"\xff\xd8\xff\xe0test" for p in parts)
    assert scalar(db, "select source::text from orders where id = %s", reply.order_id) == "photo"


def test_xlsx_order(bot, db, reader, monkeypatch):
    calls = capture_agent(reader, monkeypatch, intent="order", po_number="PO-2026-XLSX", lines=oat_lines(4), reply="Got it.")
    data = build_xlsx_bytes()
    reply = run(
        bot.on_file(
            CAFE,
            CHAT,
            "file",
            None,
            "order.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            data,
        )
    )
    assert reply.order_id is not None
    assert len(calls) == 1
    parts = calls[0][1]
    assert all(p.inline_data is None for p in parts)
    text = "\n".join(p.text for p in parts if p.text)
    assert "row 1: PO-2026-XLSX | PO-2026-XLSX | PO-2026-XLSX" in text
    assert "Oat Milk | 4 | CTN12" in text
    assert scalar(db, "select source::text from orders where id = %s", reply.order_id) == "xlsx"
    assert scalar(db, "select po_number from orders where id = %s", reply.order_id) == "PO-2026-XLSX"


def test_xls_order(bot, db, reader, monkeypatch):
    calls = capture_agent(reader, monkeypatch, intent="order", po_number="SANDS-0912", lines=oat_lines(8), reply="Got it.")
    data = zlib.decompress(base64.b64decode(XLS_ZLIB_B64))
    reply = run(bot.on_file(CAFE, CHAT, "file", None, "po_legacy.xls", "application/vnd.ms-excel", data))
    assert reply.order_id is not None
    assert len(calls) == 1
    parts = calls[0][1]
    assert all(p.inline_data is None for p in parts)
    text = "\n".join(p.text for p in parts if p.text)
    assert "Sands Resort - Weekly Supply Order | Sands Resort - Weekly Supply Order" in text
    assert "SANDS-0912" in text
    assert scalar(db, "select source::text from orders where id = %s", reply.order_id) == "xls"
    assert scalar(db, "select po_number from orders where id = %s", reply.order_id) == "SANDS-0912"


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


def test_broken_spreadsheet_replies_read_failed(bot, db, reader, monkeypatch):
    calls = capture_agent(reader, monkeypatch, intent="order", lines=oat_lines(), reply="Got it.")
    before_orders = scalar(db, "select count(*) from orders")
    cases = [
        ("corrupt.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b"not a valid zip"),
        ("corrupt.xls", "application/vnd.ms-excel", b"not a valid xls"),
    ]
    for idx, (file_name, file_mime, data) in enumerate(cases, start=1):
        reply = run(bot.on_file(CAFE, CHAT, "file", None, file_name, file_mime, data))
        assert reply.text == main.READ_FAILED
        assert reply.order_id is None
        assert len(calls) == 0
        assert scalar(db, "select count(*) from orders") == before_orders
        assert scalar(db, "select count(*) from messages where direction = 'out' and body = %s", main.READ_FAILED) == idx


def test_image_document_mime_from_extension(bot, db, reader, monkeypatch):
    cases = [
        ("order_photo.jpg", "application/octet-stream", "image/jpeg"),
        ("scan.JPEG", None, "image/jpeg"),
        ("ORDER_SCAN.PNG", "application/octet-stream", "image/png"),
        ("ORDER_SCAN.PNG", None, "image/png"),
        ("order.webp", None, "image/webp"),
        ("photo.webp", "IMAGE/WEBP", "image/webp"),
    ]
    for file_name, file_mime, expected_mime in cases:
        calls = capture_agent(reader, monkeypatch, intent="order", lines=oat_lines(), reply="Got it.")
        reply = run(bot.on_file(CAFE, CHAT, "file", None, file_name, file_mime, b"fake-image-bytes"))
        assert reply.order_id is not None
        assert len(calls) == 1
        parts = calls[0][1]
        assert any(p.inline_data and p.inline_data.mime_type == expected_mime for p in parts)
        assert scalar(db, "select source::text from orders where id = %s", reply.order_id) == "photo"
