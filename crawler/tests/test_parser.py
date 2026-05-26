from app.parser import extract_links, extract_pdf_links, clean

HTML = """
<html><head><title>Sample College</title></head>
<body>
  <a href="/about">About</a>
  <a href="https://example.com/admissions">Admissions</a>
  <a href="https://example.com/files/brochure.pdf">Brochure</a>
  <a href="javascript:void(0)">x</a>
  <main><p>Welcome to Sample College. Fees are 1.2 lakh per year.</p></main>
</body></html>
"""


def test_extract_links_filters_domain():
    links = extract_links("https://example.com", HTML, allowed_domains=["example.com"])
    assert "https://example.com/about" in links
    assert "https://example.com/admissions" in links


def test_extract_pdf_links():
    pdfs = extract_pdf_links("https://example.com", HTML)
    assert pdfs == ["https://example.com/files/brochure.pdf"]


def test_clean_returns_text_and_title():
    text, meta = clean(HTML)
    assert "Sample College" in text or "Welcome" in text
    assert meta["title"] == "Sample College"
