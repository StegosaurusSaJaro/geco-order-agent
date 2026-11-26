import json
import re
from pathlib import Path

from geco_bot.config import Settings

FLAGGED_REPLY = "Thanks, a member of our team will review your message and reply shortly."


def load_rules() -> dict:
    return json.loads(Path(__file__).with_name("screen_rules.json").read_text(encoding="utf-8"))


def screen(
    text: str,
    recent_inbound_count: int,
    rules: dict,
    flood_max: int | None = None,
    repeat_count: int = 1,
    repeat_max: int | None = None,
) -> tuple[str, str] | None:
    limit = rules.get("flood_max_messages", 8) if flood_max is None else flood_max
    if recent_inbound_count > limit:
        return ("rate_limited", f"{recent_inbound_count} messages in window")
    content = text or ""
    for pattern in rules.get("injection", ()):
        if re.search(pattern, content, re.IGNORECASE):
            return ("injection", f"matched injection pattern: {pattern}")
    for word in rules.get("abuse", ()):
        if re.search(rf"\b{re.escape(word)}\b", content, re.IGNORECASE):
            return ("abuse", f"matched abuse term: {word}")
    for pattern in rules.get("spam", ()):
        if re.search(pattern, content, re.IGNORECASE):
            return ("spam", f"matched spam pattern: {pattern}")
    repeat_limit = rules.get("repeat_max_messages", Settings.REPEAT_MAX_MESSAGES) if repeat_max is None else repeat_max
    if repeat_count >= repeat_limit:
        return ("spam", f"repeated message x{repeat_count}")
    return None
