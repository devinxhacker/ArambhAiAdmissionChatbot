"""PDF extraction with OCR fallback."""
from __future__ import annotations
import os
import io
import pdfplumber
import pypdf
import ftfy


def extract_pdf_text(path: str) -> str:
    text_parts: list[str] = []
    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                t = page.extract_text() or ""
                text_parts.append(t)
                for table in page.extract_tables() or []:
                    rows = ["\t".join([c or "" for c in row]) for row in table]
                    if rows:
                        text_parts.append("\n".join(rows))
    except Exception:
        pass

    if not "".join(text_parts).strip():
        try:
            reader = pypdf.PdfReader(path)
            text_parts = [p.extract_text() or "" for p in reader.pages]
        except Exception:
            pass

    text = "\n\n".join(text_parts)

    # OCR fallback for empty results (image PDFs)
    if not text.strip():
        try:
            text = _ocr_pdf(path)
        except Exception:
            text = ""

    return ftfy.fix_text(text)


def _ocr_pdf(path: str) -> str:
    """Best-effort OCR via pdf2image (poppler) + tesseract."""
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except Exception:
        return ""
    chunks: list[str] = []
    images = convert_from_path(path, dpi=200)
    for img in images:
        try:
            chunks.append(pytesseract.image_to_string(img))
        except Exception:
            continue
    return "\n\n".join(chunks)
