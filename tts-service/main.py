"""
Piper TTS Service — Free, unlimited, local text-to-speech for all Indian languages.

Uses piper-tts (MIT license) with pre-trained voice models from HuggingFace.
Models are auto-downloaded on first use and cached in /app/models.

Endpoint: POST /tts
  Body: { "text": "...", "language": "hi" }
  Returns: audio/wav
"""

import io
import os
import wave
import json
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Arambh TTS Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = Path("/app/models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# ─── Voice model mapping ───────────────────────────────────────────────────────
# Model short names that piper CLI uses for auto-download
# Full list: https://huggingface.co/rhasspy/piper-voices/tree/main

VOICE_MODELS = {
    "hi": "hi_IN-pratham-medium",
    "ml": "ml_IN-arjun-medium",
    "ne": "ne_NP-google-medium",
}

# All other languages fall back to Hindi (best available Indian voice)
FALLBACKS = {
    "en": "hi",
    "mr": "hi",
    "ur": "hi",
    "bn": "hi",
    "gu": "hi",
    "kn": "hi",
    "ta": "hi",
    "te": "hi",
    "pa": "hi",
    "as": "hi",
    "or": "hi",
}


def get_model_path(lang: str) -> Optional[Path]:
    """Get the .onnx model file path, downloading if needed."""
    model_name = VOICE_MODELS.get(lang)
    if not model_name:
        fallback = FALLBACKS.get(lang)
        if fallback:
            return get_model_path(fallback)
        return None

    # Check if model already exists
    onnx_path = MODELS_DIR / f"{model_name}.onnx"
    json_path = MODELS_DIR / f"{model_name}.onnx.json"

    if onnx_path.exists() and json_path.exists():
        return onnx_path

    # Download using piper CLI (it handles HuggingFace download)
    print(f"Downloading voice model: {model_name}...")
    try:
        result = subprocess.run(
            [
                "piper", "--model", model_name,
                "--data-dir", str(MODELS_DIR),
                "--download-dir", str(MODELS_DIR),
                "--update-voices",
            ],
            input=b"test",
            capture_output=True,
            timeout=120,
        )
        # Check if files were downloaded
        if onnx_path.exists():
            print(f"Model downloaded: {model_name}")
            return onnx_path

        # Try alternate path structure (piper sometimes nests in subdirs)
        for p in MODELS_DIR.rglob(f"*{model_name}*.onnx"):
            return p

        print(f"Download output: {result.stdout[:200].decode(errors='ignore')} {result.stderr[:200].decode(errors='ignore')}")
    except subprocess.TimeoutExpired:
        print(f"Download timed out for {model_name}")
    except Exception as e:
        print(f"Download failed for {model_name}: {e}")

    return None


def synthesize_with_piper(text: str, lang: str) -> Optional[bytes]:
    """Synthesize text to WAV bytes using piper CLI."""
    model_name = VOICE_MODELS.get(lang)
    if not model_name:
        fallback = FALLBACKS.get(lang)
        if fallback:
            model_name = VOICE_MODELS.get(fallback)
    if not model_name:
        return None

    try:
        result = subprocess.run(
            [
                "piper",
                "--model", model_name,
                "--data-dir", str(MODELS_DIR),
                "--download-dir", str(MODELS_DIR),
                "--output-raw",
            ],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=180,
        )

        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="ignore")[:300]
            print(f"Piper CLI error for {lang}: {stderr}")
            return None

        raw_audio = result.stdout
        if not raw_audio:
            return None

        # Convert raw PCM to WAV (piper outputs 16-bit 22050Hz mono PCM with --output-raw)
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(22050)
            wav_file.writeframes(raw_audio)

        return wav_buffer.getvalue()

    except subprocess.TimeoutExpired:
        print(f"Piper synthesis timed out for {lang}")
        return None
    except Exception as e:
        print(f"Piper synthesis failed for {lang}: {e}")
        return None


class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    speed: float = 1.0


@app.post("/tts")
async def tts_endpoint(body: TTSRequest):
    """Convert text to speech. Returns WAV audio."""
    if not body.text or not body.text.strip():
        raise HTTPException(400, "text is required")

    if len(body.text) > 5000:
        raise HTTPException(400, "text too long (max 5000 chars)")

    lang = body.language
    # Resolve fallback
    if lang not in VOICE_MODELS:
        lang = FALLBACKS.get(lang, "en")

    wav_bytes = synthesize_with_piper(body.text, lang)

    if not wav_bytes:
        raise HTTPException(
            503,
            f"TTS synthesis failed for language '{body.language}'. "
            f"The model may still be downloading. Try again in a minute."
        )

    return StreamingResponse(
        io.BytesIO(wav_bytes),
        media_type="audio/wav",
        headers={
            "Content-Disposition": "inline; filename=speech.wav",
            "Cache-Control": "public, max-age=3600",
        },
    )


@app.get("/voices")
async def list_voices():
    """List available voice models and their download status."""
    status = {}
    for lang, model in VOICE_MODELS.items():
        onnx = MODELS_DIR / f"{model}.onnx"
        # Also check nested paths
        found = onnx.exists() or any(MODELS_DIR.rglob(f"*{model}*.onnx"))
        status[lang] = {"model": model, "downloaded": found}

    return {
        "voices": status,
        "fallbacks": FALLBACKS,
        "models_dir": str(MODELS_DIR),
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "piper-tts"}
