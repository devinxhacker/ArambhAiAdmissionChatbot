from app.agents.json_utils import extract_json


def test_pure_json():
    assert extract_json('{"a":1}') == {"a": 1}


def test_fenced_json():
    s = "Sure!\n```json\n{\"x\":[1,2]}\n```"
    assert extract_json(s) == {"x": [1, 2]}


def test_inline_json():
    s = "Output: [1,2,3] thanks"
    assert extract_json(s) == [1, 2, 3]
