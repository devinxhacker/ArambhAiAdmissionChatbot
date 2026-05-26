"""Ollama LLM access (chat + streaming) via langchain-ollama."""
from __future__ import annotations
from typing import AsyncIterator, Iterable

from langchain_ollama import ChatOllama
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage

from ..core.config import get_settings


def _llm(streaming: bool = False, temperature: float | None = None) -> ChatOllama:
    s = get_settings()
    return ChatOllama(
        base_url=s.ollama_base_url,
        model=s.ollama_model,
        temperature=temperature if temperature is not None else s.ollama_temperature,
        streaming=streaming,
        num_ctx=4096,
    )


def to_lc_messages(history: Iterable[dict]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for m in history:
        role = m["role"]
        c = m["content"]
        if role == "user":
            out.append(HumanMessage(content=c))
        elif role == "assistant":
            out.append(AIMessage(content=c))
        else:
            out.append(SystemMessage(content=c))
    return out


async def chat(messages: list[BaseMessage], temperature: float | None = None) -> str:
    res = await _llm(streaming=False, temperature=temperature).ainvoke(messages)
    return res.content if hasattr(res, "content") else str(res)


async def chat_stream(messages: list[BaseMessage], temperature: float | None = None) -> AsyncIterator[str]:
    async for chunk in _llm(streaming=True, temperature=temperature).astream(messages):
        token = getattr(chunk, "content", None)
        if token:
            yield token
