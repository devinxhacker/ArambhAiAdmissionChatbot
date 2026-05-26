from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    log_level: str = "INFO"

    ai_service_host: str = "0.0.0.0"
    ai_service_port: int = 8100

    mongo_uri: str = ""
    mongo_db: str = "arambh"

    qdrant_url: str = "http://qdrant:6333"
    qdrant_collection: str = "arambh_chunks"

    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3"
    ollama_temperature: float = 0.2

    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    supported_langs: str = "en,hi,mr"

    retrieval_top_k: int = 20
    rerank_top_k: int = 6
    hybrid_alpha: float = 0.5
    min_confidence: float = 0.35

    # Live web search (Perplexity-style fallback / augmentation)
    live_search_enabled_default: bool = True
    live_search_provider: str = "duckduckgo"
    live_search_top_k: int = 5
    live_search_fetch_timeout: float = 10.0
    # If local retrieval scores below this, auto-trigger web search even when
    # the user didn't explicitly ask for it.
    live_search_auto_threshold: float = 0.30
    # Phase-2 PDF crawling: follow PDF links found inside HTML hits.
    live_search_follow_pdfs: bool = True
    live_search_pdf_max: int = 10  # hard cap on how many PDFs we follow per query

    data_dir: str = "/data"
    raw_html_dir: str = "/data/raw/html"
    raw_pdf_dir: str = "/data/raw/pdf"
    processed_dir: str = "/data/processed"
    upload_dir: str = "/data/uploads"

    @property
    def langs(self) -> list[str]:
        return [x.strip() for x in self.supported_langs.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
