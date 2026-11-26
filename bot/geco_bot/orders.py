import hashlib
import re
from decimal import Decimal

PLACEHOLDER = re.compile(r"\$?\{(price|stock):([A-Z0-9-]+)\}")
CENT = Decimal("0.01")
DRAFT_HEADING = "Draft order"
DRAFT_DIVIDER = "──────────"
REMOVED_PREFIX = "Removed from your draft: "
CATEGORY_LABELS = {
    "dairy": "DAIRY",
    "coffee_tea": "COFFEE & TEA",
    "dry_goods": "DRY GOODS",
    "sauces": "SAUCES",
    "packaging": "PACKAGING",
}


def money(value: Decimal) -> str:
    return f"${value:,.2f}"


def amount(value: Decimal) -> str:
    return f"{Decimal(value).normalize():f}"


def placeholder_skus(reply: str) -> list[str]:
    return sorted({sku for _kind, sku in PLACEHOLDER.findall(reply)})


def reply_facts(products: dict[str, dict]) -> dict[tuple[str, str], str]:
    facts = {}
    for sku, p in products.items():
        facts[("price", sku)] = f"{money(p['unit_price'])} per {p['unit_name']}"
        facts[("stock", sku)] = f"{amount(p['stock_qty'])} x {p['unit_name']}"
    return facts


def fill_placeholders(reply: str, facts: dict[tuple[str, str], str]) -> str:
    def swap(match):
        kind, sku = match.group(1), match.group(2)
        return facts.get((kind, sku), "")

    filled = PLACEHOLDER.sub(swap, reply)
    return re.sub(r"\s+([.,!?])", r"\1", filled)


def price_lines(kept: list[dict], products: dict[str, dict]):
    lines, unpriced = [], []
    for line in kept:
        product = products.get(line["sku"])
        if product is None:
            unpriced.append(line["sku"])
            continue
        unit_price = product["unit_price"]
        lines.append({**line, "unit_price": unit_price, "line_total": (unit_price * line["quantity"]).quantize(CENT)})
    total = sum((line["line_total"] for line in lines), Decimal("0.00"))
    return lines, unpriced, total


def draft_text(
    lines: list[dict], products: dict[str, dict], total: Decimal, dropped: list[str], heading: str = DRAFT_HEADING
) -> str:
    rows = [heading, ""]
    for n, line in enumerate(lines, start=1):
        p = products[line["sku"]]
        rows.append(f"{n}. {p['name']}")
        rows.append(
            f"   {amount(line['quantity'])} × {p['unit_name']} @ {money(line['unit_price'])}"
            f" = {money(line['line_total'])}"
        )
        if line["quantity"] > p["stock_qty"]:
            rows.append(f"   ⚠️ Only {amount(p['stock_qty'])} available, staff will check this line")
    rows.extend([DRAFT_DIVIDER, f"Total: {money(total)}"])
    if dropped:
        rows.append("I couldn't match: " + ", ".join(dropped))
    rows.extend(["", "Tap Confirm to place it or Cancel to drop it."])
    return "\n".join(rows)


def dropped_text(dropped: list[str]) -> str:
    return "I couldn't match: " + ", ".join(dropped) + ". Please check the product names and try again."


def draft_token(lines: list[dict]) -> str:
    canonical = sorted(
        (line["sku"], amount(line["quantity"]), line["unit_code"])
        for line in lines
    )
    payload = "\n".join(f"{sku}|{qty}|{unit}" for sku, qty, unit in canonical)
    return hashlib.sha256(payload.encode()).hexdigest()[:8]


def removed_note(old_lines: list[dict], new_lines: list[dict], catalog_by_sku: dict[str, dict]) -> str:
    kept_skus = {line["sku"] for line in new_lines}
    seen: set[str] = set()
    names: list[str] = []
    for line in old_lines:
        sku = line["sku"]
        if sku in kept_skus or sku in seen:
            continue
        seen.add(sku)
        product = catalog_by_sku.get(sku)
        names.append(product["name"] if product else sku)
    if not names:
        return ""
    return f"{REMOVED_PREFIX}{', '.join(names)}"


def price_list_text(rows: list[dict]) -> str:
    categories = {category: [] for category in CATEGORY_LABELS}
    for row in rows:
        categories.setdefault(row["category"], []).append(
            f"{row['name']} — {money(row['unit_price'])} / {row['unit_name']}"
        )
    lines = ["Your price list"]
    for category, products in categories.items():
        if products:
            label = CATEGORY_LABELS.get(category, category.replace("_", " ").upper())
            lines.extend(["", label, *products])
    lines.extend(["", 'Reply with what you need, e.g. "2 cartons oat milk".'])
    return "\n".join(lines)
