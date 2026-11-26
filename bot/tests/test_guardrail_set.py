import json
from pathlib import Path

from geco_bot.screen import load_rules, screen

ENTRIES = json.loads(Path(__file__).with_name("guardrail_set.json").read_text(encoding="utf-8"))
SET_SIZE = 40
ORDER_LABELS = ("order", "follow-up")


def outcome(entry, rules):
    result = screen(entry["text"], entry.get("recent_inbound_count", 1), rules)
    return "pass" if result is None else result[0]


def test_set_has_forty():
    assert len(ENTRIES) == SET_SIZE
    assert len({entry["id"] for entry in ENTRIES}) == SET_SIZE


def test_no_order_is_blocked():
    rules = load_rules()
    blocked = {e["id"]: outcome(e, rules) for e in ENTRIES if e["label"] in ORDER_LABELS and outcome(e, rules) != "pass"}
    assert blocked == {}


def test_expected_outcomes():
    rules = load_rules()
    wrong = {e["id"]: (e["expect"], outcome(e, rules)) for e in ENTRIES if outcome(e, rules) != e["expect"]}
    assert wrong == {}
