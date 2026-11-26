import json
import re
from pathlib import Path

FLAGGED_REPLY = "Thanks, a member of our team will review your message and reply shortly."


def load_rules() -> dict:
    return json.loads(Path(__file__).with_name("screen_rules.json").read_text(encoding="utf-8"))


def screen(
    text: str,
    recent_inbound_count: int,
    rules: dict,
    flood_max: int | None = None,
) -> tuple[str, str] | None:
    limit = rules.get("flood_max_messages", 8) if flood_max is None else flood_max
    if recent_inbound_count > limit:
        return ("rate_limited", f"{recent_inbound_count} messages in window")
    content = text or ""
    lowered = content.lower()
    for phrase in rules.get("injection", ()):
        if phrase.lower() in lowered:
            return ("injection", f"matched injection phrase: {phrase}")
    for word in rules.get("abuse", ()):
        if re.search(rf"\b{re.escape(word)}\b", content, re.IGNORECASE):
            return ("abuse", f"matched abuse term: {word}")
    for pattern in rules.get("spam", ()):
        if re.search(pattern, content, re.IGNORECASE):
            return ("spam", f"matched spam pattern: {pattern}")
    return None
