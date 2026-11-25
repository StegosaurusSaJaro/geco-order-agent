from dataclasses import dataclass
from decimal import Decimal

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

RECENT_MESSAGE_COUNT = 6
LINE_VERSION = 1


@dataclass(frozen=True)
class Customer:
    id: str
    name: str
    tier_id: int


class Database:
    def __init__(self, url: str):
        self.pool = ConnectionPool(
            url,
            min_size=1,
            max_size=4,
            kwargs={"row_factory": dict_row, "prepare_threshold": None},
            check=ConnectionPool.check_connection,
            open=True,
        )

    def close(self):
        self.pool.close()

    def customer_by_telegram_id(self, telegram_user_id: int) -> Customer | None:
        with self.pool.connection() as conn:
            row = conn.execute(
                "select id::text, name, tier_id from customers where telegram_user_id = %s",
                (telegram_user_id,),
            ).fetchone()
        return Customer(**row) if row else None

    def conversation_id(self, customer_id: str, chat_id: int) -> str:
        with self.pool.connection() as conn:
            row = conn.execute(
                "select id::text from conversations where customer_id = %s and telegram_chat_id = %s"
                " order by created_at limit 1",
                (customer_id, chat_id),
            ).fetchone()
            if row is None:
                row = conn.execute(
                    "insert into conversations (customer_id, telegram_chat_id) values (%s, %s) returning id::text",
                    (customer_id, chat_id),
                ).fetchone()
        return row["id"]

    def save_message(self, conversation_id, direction, author, kind, body,
                     telegram_message_id=None, file_name=None, file_mime=None) -> str:
        with self.pool.connection() as conn:
            row = conn.execute(
                "insert into messages (conversation_id, direction, author, kind, body, telegram_message_id,"
                " file_name, file_mime) values (%s, %s, %s, %s, %s, %s, %s, %s) returning id::text",
                (conversation_id, direction, author, kind, body, telegram_message_id, file_name, file_mime),
            ).fetchone()
        return row["id"]

    def link_messages(self, order_id: str, message_ids: list[str]):
        with self.pool.connection() as conn:
            for message_id in message_ids:
                conn.execute(
                    "insert into order_messages (order_id, message_id) values (%s, %s) on conflict do nothing",
                    (order_id, message_id),
                )

    def recent_messages(self, conversation_id: str) -> list[dict]:
        with self.pool.connection() as conn:
            rows = conn.execute(
                "select author, body from messages where conversation_id = %s and body is not null"
                " order by created_at desc limit %s",
                (conversation_id, RECENT_MESSAGE_COUNT),
            ).fetchall()
        return list(reversed(rows))

    def catalog(self) -> list[dict]:
        with self.pool.connection() as conn:
            return conn.execute(
                "select p.sku, p.name, p.unit_code, u.name as unit_name, p.aliases"
                " from products p join units_of_measure u on u.code = p.unit_code"
                " where p.active order by p.sku"
            ).fetchall()

    def unit_codes(self) -> list[str]:
        with self.pool.connection() as conn:
            return [r["code"] for r in conn.execute("select code from units_of_measure order by code")]

    def price_and_stock(self, tier_id: int, skus: list[str]) -> dict[str, dict]:
        with self.pool.connection() as conn:
            rows = conn.execute(
                "select p.sku, p.name, p.unit_code, u.name as unit_name, tp.unit_price, p.stock_qty"
                " from products p"
                " join units_of_measure u on u.code = p.unit_code"
                " join tier_prices tp on tp.sku = p.sku and tp.tier_id = %s"
                " where p.active and p.sku = any(%s) order by p.category, p.sku",
                (tier_id, skus),
            ).fetchall()
        return {r["sku"]: r for r in rows}

    def price_list(self, tier_id: int) -> list[dict]:
        with self.pool.connection() as conn:
            return conn.execute(
                "select p.sku, p.name, u.name as unit_name, tp.unit_price"
                " from products p"
                " join units_of_measure u on u.code = p.unit_code"
                " join tier_prices tp on tp.sku = p.sku and tp.tier_id = %s"
                " where p.active order by p.category, p.name",
                (tier_id,),
            ).fetchall()

    def create_draft(
        self,
        customer_id,
        conversation_id,
        lines: list[dict],
        total: Decimal,
        source: str = "text",
        po_number: str | None = None,
    ) -> str:
        with self.pool.connection() as conn, conn.transaction():
            order_id = conn.execute(
                "insert into orders (customer_id, conversation_id, status, source, po_number, total)"
                " values (%s, %s, 'draft', %s, %s, %s) returning id::text",
                (customer_id, conversation_id, source, po_number, total),
            ).fetchone()["id"]
            for line_no, line in enumerate(lines, start=1):
                conn.execute(
                    "insert into order_lines (order_id, version, line_no, sku, quantity, unit_code, unit_price, line_total)"
                    " values (%s, %s, %s, %s, %s, %s, %s, %s)",
                    (order_id, LINE_VERSION, line_no, line["sku"], line["quantity"], line["unit_code"],
                     line["unit_price"], line["line_total"]),
                )
        return order_id

    def open_draft(self, customer_id: str, conversation_id: str) -> dict | None:
        with self.pool.connection() as conn:
            order = conn.execute(
                "select id::text, po_number from orders"
                " where customer_id = %s and conversation_id = %s and status = 'draft'"
                " order by created_at desc limit 1",
                (customer_id, conversation_id),
            ).fetchone()
            if order is None:
                return None
            lines = conn.execute(
                "select sku, quantity, unit_code from order_lines"
                " where order_id = %s and version = %s order by line_no",
                (order["id"], LINE_VERSION),
            ).fetchall()
        return {"id": order["id"], "po_number": order["po_number"], "lines": lines}

    def replace_draft_lines(
        self,
        order_id: str,
        customer_id: str,
        lines: list[dict],
        total: Decimal,
        po_number: str | None = None,
    ) -> bool:
        with self.pool.connection() as conn, conn.transaction():
            updated = conn.execute(
                "update orders set total = %s, po_number = coalesce(%s, po_number), updated_at = now()"
                " where id = %s and customer_id = %s and status = 'draft' returning id",
                (total, po_number, order_id, customer_id),
            ).fetchone()
            if updated is None:
                return False
            conn.execute(
                "delete from order_lines where order_id = %s and version = %s",
                (order_id, LINE_VERSION),
            )
            for line_no, line in enumerate(lines, start=1):
                conn.execute(
                    "insert into order_lines (order_id, version, line_no, sku, quantity, unit_code, unit_price, line_total)"
                    " values (%s, %s, %s, %s, %s, %s, %s, %s)",
                    (order_id, LINE_VERSION, line_no, line["sku"], line["quantity"], line["unit_code"],
                     line["unit_price"], line["line_total"]),
                )
        return True

    def order_belongs_to(self, order_id: str, customer_id: str, conversation_id: str) -> bool:
        with self.pool.connection() as conn:
            row = conn.execute(
                "select 1 from orders where id = %s and customer_id = %s and conversation_id = %s",
                (order_id, customer_id, conversation_id),
            ).fetchone()
        return row is not None

    def confirm(
        self,
        order_id: str,
        customer_id: str,
        review_threshold: Decimal = Decimal("2000"),
        quantity_factor: Decimal = Decimal("3"),
        quantity_min_history: int = 2,
    ) -> str:
        with self.pool.connection() as conn, conn.transaction():
            updated = conn.execute(
                "update orders set status = 'confirmed', confirmed_at = now(), updated_at = now()"
                " where id = %s and customer_id = %s and status = 'draft' returning id, total",
                (order_id, customer_id),
            ).fetchone()
            if updated is None:
                return "handled"
            reasons = []
            if updated["total"] > review_threshold:
                reasons.append("total")
            unusual = conn.execute(
                "with current_lines as ("
                "    select sku, sum(quantity) as qty"
                "    from order_lines"
                "    where order_id = %s and version = %s"
                "    group by sku"
                "), history as ("
                "    select o.id, ol.sku, sum(ol.quantity) as order_qty"
                "    from orders o"
                "    join order_lines ol on ol.order_id = o.id and ol.version = %s"
                "    where o.customer_id = %s"
                "      and o.status in ('confirmed', 'fulfilled')"
                "      and o.id <> %s"
                "    group by o.id, ol.sku"
                "), medians as ("
                "    select sku, percentile_cont(0.5) within group (order by order_qty)::numeric as median_qty"
                "    from history"
                "    group by sku"
                "    having count(*) >= %s"
                ")"
                " select c.qty, m.median_qty"
                " from current_lines c"
                " join medians m on m.sku = c.sku",
                (order_id, LINE_VERSION, LINE_VERSION, customer_id, order_id, quantity_min_history),
            ).fetchall()
            if any(row["qty"] > quantity_factor * row["median_qty"] for row in unusual):
                reasons.append("quantity")
            try:
                with conn.transaction():
                    needed = conn.execute(
                        "select count(distinct sku) as n from order_lines where order_id = %s and version = %s",
                        (order_id, LINE_VERSION),
                    ).fetchone()["n"]
                    deducted = conn.execute(
                        "update products p set stock_qty = p.stock_qty - l.qty"
                        " from (select sku, sum(quantity) as qty from order_lines"
                        "       where order_id = %s and version = %s group by sku) l"
                        " where p.sku = l.sku and p.stock_qty >= l.qty",
                        (order_id, LINE_VERSION),
                    ).rowcount
                    if deducted < needed:
                        raise StockShort
                    if reasons:
                        raise HoldOrder
            except (StockShort, HoldOrder) as exc:
                if isinstance(exc, StockShort):
                    reasons.append("stock")
                conn.execute(
                    "update orders set status = 'needs_review', confirmed_at = null,"
                    " review_reasons = %s, updated_at = now() where id = %s",
                    (reasons, order_id),
                )
                return "held"
        return "confirmed"

    def cancel(self, order_id: str, customer_id: str) -> bool:
        with self.pool.connection() as conn:
            row = conn.execute(
                "update orders set status = 'cancelled', updated_at = now()"
                " where id = %s and customer_id = %s and status = 'draft' returning id",
                (order_id, customer_id),
            ).fetchone()
        return row is not None


class StockShort(Exception):
    pass


class HoldOrder(Exception):
    pass
