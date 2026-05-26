"""HTML / PDF / text cleaning with metadata preservation."""
from __future__ import annotations
import os
import hashlib
import ftfy
import trafilatura
from bs4 import BeautifulSoup


def clean_html(raw_html: str) -> str:
    extracted = trafilatura.extract(
        raw_html, include_tables=True, include_comments=False, no_fallback=False
    )
    if extracted and len(extracted.strip()) > 50:
        return ftfy.fix_text(extracted)
    soup = BeautifulSoup(raw_html, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    return ftfy.fix_text(soup.get_text(separator="\n"))


def extract_pdf(path: str) -> str:
    import pdfplumber, pypdf  # local imports to keep startup light

    text_parts: list[str] = []
    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                t = page.extract_text() or ""
                text_parts.append(t)
                # tables -> tab separated text
                for table in page.extract_tables() or []:
                    rows = ["\t".join([c or "" for c in row]) for row in table]
                    if rows:
                        text_parts.append("\n".join(rows))
    except Exception:
        pass

    if not text_parts:
        try:
            reader = pypdf.PdfReader(path)
            text_parts = [p.extract_text() or "" for p in reader.pages]
        except Exception:
            pass

    text = "\n\n".join(text_parts)
    return ftfy.fix_text(text)


def clean_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return ftfy.fix_text(f.read())


def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def detect_extension(path: str) -> str:
    return os.path.splitext(path)[1].lower()
