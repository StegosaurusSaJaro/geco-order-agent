import os
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    db_url: str
    model: str
    fallback_model: str
    review_threshold_usd: Decimal
    quantity_factor: Decimal
    quantity_min_history: int
    poll_seconds: float


def load_settings() -> Settings:
    load_dotenv(ENV_FILE)
    return Settings(
        telegram_bot_token=os.environ["TELEGRAM_BOT_TOKEN"],
        db_url=os.environ["SUPABASE_DB_URL"],
        model=os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        fallback_model=os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-3.1-flash-lite"),
        review_threshold_usd=Decimal(os.environ.get("REVIEW_THRESHOLD_USD") or "2000"),
        quantity_factor=Decimal(os.environ.get("QUANTITY_FACTOR") or "3"),
        quantity_min_history=int(os.environ.get("QUANTITY_MIN_HISTORY") or "2"),
        poll_seconds=float(os.environ.get("POLL_SECONDS") or "5"),
    )
