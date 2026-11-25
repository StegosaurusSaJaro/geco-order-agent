import re
from decimal import Decimal

PLACEHOLDER = re.compile(r"\$?\{(price|stock):([A-Z0-9-]+)\}")
CENT = Decimal("0.01")


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


def draft_text(lines: list[dict], products: dict[str, dict], total: Decimal, dropped: list[str]) -> str:
    rows = ["Draft order:"]
    for n, line in enumerate(lines, start=1):
        p = products[line["sku"]]
        rows.append(
            f"{n}. {amount(line['quantity'])} x {p['name']} ({p['unit_name']}) @ {money(line['unit_price'])}"
            f" = {money(line['line_total'])}"
        )
        if line["quantity"] > p["stock_qty"]:
            rows.append(f"   only {amount(p['stock_qty'])} available, staff will check this line")
    rows.append(f"Total: {money(total)}")
    if dropped:
        rows.append("I couldn't match: " + ", ".join(dropped))
    rows.append("Tap Confirm to place it or Cancel to drop it.")
    return "\n".join(rows)


def dropped_text(dropped: list[str]) -> str:
    return "I couldn't match: " + ", ".join(dropped) + ". Please check the product names and try again."


def price_list_text(rows: list[dict]) -> str:
    lines = ["Your price list:"]
    lines += [f"{r['name']} ({r['unit_name']}): {money(r['unit_price'])}" for r in rows]
    return "\n".join(lines)
