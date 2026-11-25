import unicodedata
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from fpdf import FPDF

MANILA = ZoneInfo("Asia/Manila")


def order_ref(order: dict) -> str:
    po = order.get("po_number")
    if po and str(po).strip():
        return str(po).strip()
    return str(order["id"])[:8]


def _clean(value: object) -> str:
    text = "".join(ch for ch in unicodedata.normalize("NFKD", str(value)) if not unicodedata.combining(ch))
    return text.encode("latin-1", "replace").decode("latin-1")


def _manila_date(order: dict) -> str:
    dt = order.get("confirmed_at") or order.get("created_at")
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    if dt is None:
        dt = datetime.now(MANILA)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=MANILA)
    return dt.astimezone(MANILA).strftime("%Y-%m-%d %H:%M PHT")


def _money(value: object) -> str:
    return f"{Decimal(str(value)):,.2f}"


def _qty(value: object) -> str:
    return f"{Decimal(str(value)).normalize():f}"


def build_receipt_pdf(order: dict, compress: bool = True) -> bytes:
    pdf = FPDF()
    if not compress:
        pdf.set_compression(False)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, "GECO Asia", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 13)
    pdf.cell(0, 8, "Order confirmation", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    ref = _clean(order_ref(order))
    currency = _clean(order.get("currency") or "USD")

    meta = [
        ("Order ref", ref),
        ("Date", _manila_date(order)),
        ("Customer", _clean(order["customer_name"])),
        ("Tier", _clean(order["tier_name"])),
    ]
    for label, val in meta:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(30, 6, f"{label}:")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, val, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    cols = [
        ("SKU", 32, "L"),
        ("Product", 66, "L"),
        ("Qty", 18, "R"),
        ("Unit", 22, "L"),
        ("Unit Price", 26, "R"),
        ("Total", 26, "R"),
    ]
    pdf.set_font("Helvetica", "B", 9)
    for title, width, align in cols:
        pdf.cell(width, 7, title, border=1, align=align)
    pdf.ln()

    pdf.set_font("Helvetica", "", 9)
    for line in order.get("lines", []):
        name = _clean(line.get("product_name") or line.get("name") or "")
        if len(name) > 34:
            name = name[:31] + "..."
        values = [
            (_clean(line["sku"]), 32, "L"),
            (name, 66, "L"),
            (_qty(line["quantity"]), 18, "R"),
            (_clean(line["unit_code"]), 22, "L"),
            (_money(line["unit_price"]), 26, "R"),
            (_money(line["line_total"]), 26, "R"),
        ]
        for text, width, align in values:
            pdf.cell(width, 6, text, border=1, align=align)
        pdf.ln()

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, f"Total ({currency}): {_money(order['total'])}", align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(0, 6, "This is an order confirmation, not a tax invoice", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())
