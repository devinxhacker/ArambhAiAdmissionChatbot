from app.rag.chunker import chunk_text


def test_chunker_splits_long_text():
    text = ". ".join([f"sentence number {i}" for i in range(200)])
    chunks = chunk_text(text, chunk_size=200, chunk_overlap=40)
    assert len(chunks) > 3
    assert all(len(c) <= 260 for c in chunks)


def test_chunker_handles_empty():
    assert chunk_text("") == []
    assert chunk_text("   ") == []
