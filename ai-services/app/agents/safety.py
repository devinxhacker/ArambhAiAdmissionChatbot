"""Lightweight prompt-injection / jailbreak filter applied to user input."""
from __future__ import annotations
import re

INJECTION_PATTERNS = [
    r"ignore (all|previous) (instructions|rules)",
    r"disregard (the )?system",
    r"reveal (the )?system prompt",
    r"you are now [a-z ]+ mode",
    r"developer mode",
    r"act as (?:dan|jailbroken)",
]

_compiled = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


def looks_like_injection(text: str) -> bool:
    return any(p.search(text or "") for p in _compiled)


def sanitize_question(text: str) -> str:
    # truncate hard upper bound to limit prompt-bomb attacks
    if len(text) > 4000:
        text = text[:4000]
    return text
