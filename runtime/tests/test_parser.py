from handkerchief_engine import Action
from handkerchief_runtime import parse_action


def test_parse_plain_word():
    assert parse_action("DROP", "attacker") == (Action.DROP, "DROP")
    assert parse_action("check", "defender") == (Action.CHECK, "CHECK")


def test_parse_last_valid_token_wins_when_model_explains():
    text = "I considered WAIT, but the bleeding suggests otherwise. Final answer: CHECK"
    assert parse_action(text, "defender") == (Action.CHECK, "CHECK")


def test_role_filtering_attacker_cannot_check():
    assert parse_action("CHECK", "attacker") == (Action.WAIT, None)


def test_garbage_degrades_to_wait():
    assert parse_action("嗯……让我想想", "attacker") == (Action.WAIT, None)
    assert parse_action(None, "defender") == (Action.WAIT, None)


def test_jsonish_output():
    assert parse_action('{"action": "DROP"}', "attacker") == (Action.DROP, "DROP")
