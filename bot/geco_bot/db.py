from dataclasses import dataclass
from decimal import Decimal

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

RECENT_MESSAGE_COUNT = 6
LINE_VERSION = 1
_EXCLUDED_FLAGGED_SQL = (
    " and not exists (select 1 from screening_log s"
    " where s.message_id = messages.id and s.status in ('held', 'dismissed'))"
)
_SIGNUP_COLUMNS = (
    "id, telegram_user_id, telegram_chat_id, telegram_name, telegram_username,"
    " status, step, business_name, contact_name, phone, delivery_address"
)
_SIGNUP_ANSWER_FIELDS = frozenset({"business_name", "contact_name", "phone", "delivery_address"})


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
                + _EXCLUDED_FLAGGED_SQL
                + " order by created_at desc limit %s",
                (conversation_id, RECENT_MESSAGE_COUNT),
            ).fetchall()
        return list(reversed(rows))

    def history_before(self, conversation_id: str, before_ts, limit: int = RECENT_MESSAGE_COUNT) -> list[dict]:
        with self.pool.connection() as conn:
            rows = conn.execute(
                "select author, body from messages"
                " where conversation_id = %s and body is not null and created_at < %s"
                + _EXCLUDED_FLAGGED_SQL
                + " order by created_at desc limit %s",
                (conversation_id, before_ts, limit),
            ).fetchall()
        return list(reversed(rows))

    def recent_inbound_count(self, conversation_id: str, window_seconds: int) -> int:
        with self.pool.connection() as conn:
            row = conn.execute(
                "select count(*) as n from messages"
                " where conversation_id = %s and direction = 'in' and kind <> 'button'"
                " and created_at >= now() - make_interval(secs => %s)",
                (conversation_id, window_seconds),
            ).fetchone()
        return row["n"]

    def log_screening(
        self,
        telegram_user_id: int,
        decision: str,
        reason: str,
        latency_ms: int,
        message_id=None,
        conversation_id=None,
        status: str = "held",
    ) -> int:
        with self.pool.connection() as conn:
            row = conn.execute(
                "insert into screening_log"
                " (telegram_user_id, decision, reason, latency_ms, message_id, conversation_id, status)"
                " values (%s, %s, %s, %s, %s, %s, %s) returning id",
                (telegram_user_id, decision, reason, latency_ms, message_id, conversation_id, status),
            ).fetchone()
        return row["id"]

    def claim_released_flag(self) -> dict | None:
        with self.pool.connection() as conn:
            claimed = conn.execute(
                "update screening_log set status = 'processed'"
                " where id = ("
                "     select id from screening_log"
                "     where status = 'released'"
                "     order by reviewed_at"
                "     limit 1"
                "     for update skip locked"
                " ) returning id, message_id::text, conversation_id::text, telegram_user_id"
            ).fetchone()
            if claimed is None:
                return None
            detail = conn.execute(
                "select m.body, m.kind, m.file_name, m.created_at,"
                " conv.telegram_chat_id, conv.customer_id::text,"
                " c.name as customer_name, c.tier_id, c.telegram_user_id as customer_telegram_user_id"
                " from messages m"
                " join conversations conv on conv.id = m.conversation_id"
                " join customers c on c.id = conv.customer_id"
                " where m.id = %s",
                (claimed["message_id"],),
            ).fetchone()
        if detail is None:
            return None
        return {**claimed, **detail}

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

    def claim_due_receipt_order(self) -> str | None:
        with self.pool.connection() as conn:
            row = conn.execute(
                "update orders set receipt_sent_at = now()"
                " where id = ("
                "     select id from orders"
                "     where status = 'confirmed' and receipt_sent_at is null"
                "     order by confirmed_at"
                "     limit 1"
                "     for update skip locked"
                " ) returning id::text"
            ).fetchone()
        return row["id"] if row else None

    def clear_receipt_sent(self, order_id: str) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                "update orders set receipt_sent_at = null where id = %s",
                (order_id,),
            )

    def receipt_data(self, order_id: str) -> dict | None:
        with self.pool.connection() as conn:
            order = conn.execute(
                "select o.id::text, o.customer_id::text, o.conversation_id::text, o.status::text,"
                " o.po_number, o.version, o.currency, o.total, o.confirmed_at, o.created_at,"
                " c.name as customer_name, t.name as tier_name, conv.telegram_chat_id"
                " from orders o"
                " join customers c on c.id = o.customer_id"
                " join tiers t on t.id = c.tier_id"
                " join conversations conv on conv.id = o.conversation_id"
                " where o.id = %s",
                (order_id,),
            ).fetchone()
            if order is None:
                return None
            lines = conn.execute(
                "select ol.sku, p.name as product_name, ol.quantity, ol.unit_code, ol.unit_price, ol.line_total"
                " from order_lines ol"
                " join products p on p.sku = ol.sku"
                " where ol.order_id = %s and ol.version = %s"
                " order by ol.line_no",
                (order_id, order["version"]),
            ).fetchall()
        return {**order, "lines": lines}

    def open_signup(self, telegram_user_id: int) -> dict | None:
        with self.pool.connection() as conn:
            return conn.execute(
                f"select {_SIGNUP_COLUMNS} from signups"
                " where telegram_user_id = %s and status in ('collecting', 'pending')",
                (telegram_user_id,),
            ).fetchone()

    def create_signup(
        self,
        telegram_user_id: int,
        telegram_chat_id: int,
        telegram_name: str | None,
        telegram_username: str | None,
    ) -> dict:
        with self.pool.connection() as conn:
            return conn.execute(
                "insert into signups (telegram_user_id, telegram_chat_id, telegram_name, telegram_username)"
                " values (%s, %s, %s, %s)"
                " on conflict (telegram_user_id) where status in ('collecting', 'pending')"
                " do update set telegram_chat_id = excluded.telegram_chat_id"
                f" returning {_SIGNUP_COLUMNS}",
                (telegram_user_id, telegram_chat_id, telegram_name, telegram_username),
            ).fetchone()

    def save_signup_answer(self, signup_id: int, field: str, value: str, next_step: str) -> None:
        if field not in _SIGNUP_ANSWER_FIELDS:
            raise ValueError(f"invalid signup field: {field}")
        with self.pool.connection() as conn:
            conn.execute(
                f"update signups set {field} = %s, step = %s where id = %s and status = 'collecting'",
                (value, next_step, signup_id),
            )

    def submit_signup(self, signup_id: int) -> bool:
        with self.pool.connection() as conn:
            row = conn.execute(
                "update signups set status = 'pending', submitted_at = now()"
                " where id = %s and status = 'collecting' and step = 'review' returning id",
                (signup_id,),
            ).fetchone()
        return row is not None

    def restart_signup(self, signup_id: int) -> bool:
        with self.pool.connection() as conn:
            row = conn.execute(
                "update signups set step = 'business_name',"
                " business_name = null, contact_name = null, phone = null, delivery_address = null"
                " where id = %s and status = 'collecting' returning id",
                (signup_id,),
            ).fetchone()
        return row is not None

    def claim_due_signup_notice(self) -> dict | None:
        with self.pool.connection() as conn:
            row = conn.execute(
                "update signups set notified_at = now()"
                " where id = ("
                "     select id from signups"
                "     where status in ('approved', 'rejected') and notified_at is null"
                "     order by decided_at"
                "     limit 1"
                "     for update skip locked"
                " ) returning id, telegram_chat_id, status, customer_id::text"
            ).fetchone()
            if row is None:
                return None
            result = dict(row)
            if result["status"] == "approved" and result["customer_id"]:
                customer = conn.execute(
                    "select name from customers where id = %s",
                    (result["customer_id"],),
                ).fetchone()
                if customer is not None:
                    result["customer_name"] = customer["name"]
        return result

    def clear_signup_notice(self, signup_id: int) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                "update signups set notified_at = null where id = %s",
                (signup_id,),
            )

    def claim_due_reject_notice(self) -> dict | None:
        with self.pool.connection() as conn:
            row = conn.execute(
                "update orders o set reject_notice_sent_at = now()"
                " from conversations conv"
                " where o.id = ("
                "     select id from orders"
                "     where status = 'cancelled' and rejected_by_staff_at is not null and reject_notice_sent_at is null"
                "     order by rejected_by_staff_at"
                "     limit 1"
                "     for update skip locked"
                " ) and conv.id = o.conversation_id"
                " returning o.id::text, o.conversation_id::text, o.po_number, conv.telegram_chat_id"
            ).fetchone()
        return dict(row) if row else None

    def clear_reject_notice(self, order_id: str) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                "update orders set reject_notice_sent_at = null where id = %s",
                (order_id,),
            )


class StockShort(Exception):
    pass


class HoldOrder(Exception):
    pass
