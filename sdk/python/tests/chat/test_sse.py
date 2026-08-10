from personaai.chat._sse import decode_frame, split_buffer


def test_split_buffer_splits_on_double_newline():
    frames, leftover = split_buffer("data: a\n\ndata: b\n\n")
    assert frames == ["data: a", "data: b"]
    assert leftover == ""


def test_split_buffer_keeps_partial_frame_as_leftover():
    frames, leftover = split_buffer("data: a\n\ndata: partial")
    assert frames == ["data: a"]
    assert leftover == "data: partial"


def test_split_buffer_empty_string():
    frames, leftover = split_buffer("")
    assert frames == []
    assert leftover == ""


def test_decode_frame_parses_json_data_line():
    event = decode_frame('data: {"type": "RUN_STARTED"}')
    assert event == {"type": "RUN_STARTED"}


def test_decode_frame_joins_multiple_data_lines():
    event = decode_frame('data: {"type":\ndata: "RUN_STARTED"}')
    assert event == {"type": "RUN_STARTED"}


def test_decode_frame_returns_none_for_no_data_lines():
    assert decode_frame("event: ping") is None


def test_decode_frame_returns_none_for_empty_data():
    assert decode_frame("data:") is None


def test_decode_frame_returns_none_for_malformed_json():
    assert decode_frame("data: {not json") is None


def test_decode_frame_returns_none_for_non_object_json():
    assert decode_frame("data: [1, 2, 3]") is None
