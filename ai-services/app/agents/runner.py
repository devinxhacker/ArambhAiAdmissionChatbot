"""High-level streaming runner.

Key improvements over previous version:
1. CONVERSATION-AWARE RETRIEVAL: resolves "this college" / "that" using chat history
   before searching. The working query always contains the full entity name.
2. PARALLEL DB + WEB: runs local retrieval and web search simultaneously when both
   are needed, then merges + reranks. No more "stuck on DB only" or "stuck on web only".
3. DIRECT LANGUAGE GENERATION: if the user selected Hindi/Marathi, the LLM generates
   directly in that language (no post-translation step = faster + more natural).
"""
from __future__ import annotations
import asyncio
from typing import AsyncIterator

from langchain_core.messages import SystemMessage, HumanMessage

from .nodes import (
    query_understanding,
    retrieval,
    live_search,
    _format_context,
    _top_score,
)
from .state import AgentState
from ..rag.llm import chat, chat_stream
from ..rag.prompts import SYSTEM_GROUNDED, USER_TEMPLATE, HISTORY_TEMPLATE
from ..rag.reranker import rerank
from ..core.config import get_settings
from ..core.logging import get_logger

log = get_logger("runner")


# ─────────────────── Coreference resolution ───────────────────
async def _resolve_query(user_message: str, history: list[dict]) -> str:
    """Use the last few turns to resolve pronouns / 'this college' / 'that person'
    into a self-contained search query. Fast — single LLM call with low temperature."""
    if not history:
        return user_message

    lowered = user_message.lower().strip()

    # Skip resolution for long, self-contained queries (they likely don't need context)
    if len(lowered.split()) > 10:
        return user_message

    # Detect if the message needs resolution (pronouns, references, short follow-ups)
    needs_resolution = (
        len(lowered.split()) <= 6  # short messages often need context
        or any(w in lowered for w in (
            "this college", "that college", "this university", "the same",
            "its ", "their ", "it's ", "above", "previous",
            "this institute", "that institute", "the college",
            "this person", "that person", "them", "him", "her",
            "his ", "he ", "she ", "they ",
            "tell me more", "more about", "what about",
            "the same", "same one", "that one", "this one",
            "also", "and what", "how about",
        ))
        or (any(w in lowered for w in ("who", "what", "when", "where", "how", "which"))
            and len(lowered.split()) <= 8)
    )
    if not needs_resolution:
        return user_message

    recent = history[-4:]  # Only last 4 turns for speed
    ctx = "\n".join(f"{m['role']}: {m['content'][:150]}" for m in recent)

    prompt = (
        f"Conversation so far:\n{ctx}\n\n"
        f"User's new message: \"{user_message}\"\n\n"
        "Task: Rewrite the user's message as a STANDALONE web search query that would "
        "find the answer. Replace ALL pronouns (his, her, it, them, this, that, he, she) "
        "and references ('this college', 'that person', 'the same') with the ACTUAL "
        "entity names from the conversation history.\n\n"
        "Examples:\n"
        "- History mentions 'Amar More', user says 'Tell me his DOB' → 'Amar More date of birth'\n"
        "- History mentions 'MITAOE', user says 'What about placements?' → 'MITAOE placements statistics'\n"
        "- History mentions 'COEP Pune', user says 'fees?' → 'COEP Pune fees structure'\n\n"
        "Output ONLY the rewritten search query. No explanation. No quotes."
    )
    try:
        resolved = await chat(
            [SystemMessage(content="You rewrite queries to be self-contained. Output only the rewritten query."),
             HumanMessage(content=prompt)],
            temperature=0.0,
        )
        resolved = resolved.strip().strip('"').strip("'").strip()
        if resolved and len(resolved) > 3 and len(resolved) < 500:
            log.info("query_resolved", original=user_message[:60], resolved=resolved[:80])
            return resolved
    except Exception as exc:
        log.info("resolve_failed", error=str(exc)[:80])
    return user_message


# ─────────────────── Language-aware system prompt ───────────────────
def _system_prompt_for_language(lang: str) -> str:
    """Append a language instruction so the LLM generates directly in the target language."""
    base = SYSTEM_GROUNDED
    lang_instructions = {
        "hi": "\n\n**IMPORTANT: Respond entirely in Hindi (हिन्दी). Use Devanagari script. Do NOT respond in English.**",
        "mr": "\n\n**IMPORTANT: Respond entirely in Marathi (मराठी). Use Devanagari script. Do NOT respond in English.**",
        "ur": "\n\n**IMPORTANT: Respond entirely in Urdu (اردو). Use Nastaliq/Arabic script. Do NOT respond in English.**",
        "ta": "\n\n**IMPORTANT: Respond entirely in Tamil (தமிழ்). Use Tamil script. Do NOT respond in English.**",
        "te": "\n\n**IMPORTANT: Respond entirely in Telugu (తెలుగు). Use Telugu script. Do NOT respond in English.**",
        "kn": "\n\n**IMPORTANT: Respond entirely in Kannada (ಕನ್ನಡ). Use Kannada script. Do NOT respond in English.**",
        "ml": "\n\n**IMPORTANT: Respond entirely in Malayalam (മലയാളം). Use Malayalam script. Do NOT respond in English.**",
        "bn": "\n\n**IMPORTANT: Respond entirely in Bengali (বাংলা). Use Bengali script. Do NOT respond in English.**",
        "gu": "\n\n**IMPORTANT: Respond entirely in Gujarati (ગુજરાતી). Use Gujarati script. Do NOT respond in English.**",
        "pa": "\n\n**IMPORTANT: Respond entirely in Punjabi (ਪੰਜਾਬੀ). Use Gurmukhi script. Do NOT respond in English.**",
        "or": "\n\n**IMPORTANT: Respond entirely in Odia (ଓଡ଼ିଆ). Use Odia script. Do NOT respond in English.**",
        "as": "\n\n**IMPORTANT: Respond entirely in Assamese (অসমীয়া). Use Bengali script. Do NOT respond in English.**",
    }
    if lang in lang_instructions:
        base += lang_instructions[lang]
    return base


# ─────────────────── Main streaming runner ───────────────────
async def run_streaming(
    user_message: str,
    history: list[dict],
    language: str | None,
    web_search: bool | None = None,
) -> AsyncIterator[dict]:
    s = get_settings()

    state: AgentState = {
        "user_message": user_message,
        "history": history or [],
        "requested_language": language,
        "web_search": None,
    }

    # 1) Query understanding
    yield {"type": "status", "step": "understanding"}
    state.update(await query_understanding(state))

    detected_lang = state.get("detected_language", "en")
    if language and language in ("hi", "mr", "en"):
        detected_lang = language

    lowered_msg = user_message.strip().lower()

    # SAFETY: Only skip retrieval for explicit single-word greetings.
    # Everything else — including follow-ups, names, short questions — gets searched.
    GREETINGS = {"hi", "hello", "hey", "thanks", "thank you", "bye", "goodbye", "ok", "okay", "hii", "hiii", "namaste", "namaskar"}
    is_greeting = lowered_msg in GREETINGS or (lowered_msg.startswith("hi ") and len(lowered_msg) < 12)

    if is_greeting:
        greeting = "Hey! I'm Arambh, your admission assistant. Ask me anything about engineering colleges — fees, cutoffs, placements, scholarships, hostels, or anything else. How can I help you today?"
        greetings_by_lang = {
            "hi": "नमस्ते! मैं आरम्भ हूँ, आपका एडमिशन असिस्टेंट। इंजीनियरिंग कॉलेजों के बारे में कुछ भी पूछें — फीस, कटऑफ, प्लेसमेंट, स्कॉलरशिप। आज मैं आपकी कैसे मदद कर सकता हूँ?",
            "mr": "नमस्कार! मी आरम्भ आहे, तुमचा ॲडमिशन असिस्टंट. इंजिनिअरिंग कॉलेजबद्दल काहीही विचारा — फी, कटऑफ, प्लेसमेंट, स्कॉलरशिप. आज मी तुम्हाला कशी मदत करू शकतो?",
            "ur": "السلام علیکم! میں آرمبھ ہوں، آپ کا ایڈمیشن اسسٹنٹ۔ انجینئرنگ کالجوں کے بارے میں کچھ بھی پوچھیں — فیس، کٹ آف، پلیسمنٹ، اسکالرشپ۔ آج میں آپ کی کیسے مدد کر سکتا ہوں؟",
            "ta": "வணக்கம்! நான் ஆரம்ப், உங்கள் அட்மிஷன் உதவியாளர். பொறியியல் கல்லூரிகள் பற்றி எதையும் கேளுங்கள் — கட்டணம், கட்ஆஃப், பிளேஸ்மென்ட், ஸ்காலர்ஷிப். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
            "te": "నమస్కారం! నేను ఆరంభ్, మీ అడ్మిషన్ అసిస్టెంట్. ఇంజనీరింగ్ కాలేజీల గురించి ఏదైనా అడగండి — ఫీజులు, కటాఫ్, ప్లేస్‌మెంట్లు, స్కాలర్‌షిప్‌లు. ఈరోజు నేను మీకు ఎలా సహాయం చేయగలను?",
            "kn": "ನಮಸ್ಕಾರ! ನಾನು ಆರಂಭ್, ನಿಮ್ಮ ಅಡ್ಮಿಷನ್ ಅಸಿಸ್ಟೆಂಟ್. ಎಂಜಿನಿಯರಿಂಗ್ ಕಾಲೇಜುಗಳ ಬಗ್ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಿ — ಶುಲ್ಕ, ಕಟಾಫ್, ಪ್ಲೇಸ್‌ಮೆಂಟ್, ಸ್ಕಾಲರ್‌ಶಿಪ್. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
            "ml": "നമസ്കാരം! ഞാൻ ആരംഭ്, നിങ്ങളുടെ അഡ്മിഷൻ അസിസ്റ്റന്റ്. എഞ്ചിനീയറിംഗ് കോളേജുകളെ കുറിച്ച് എന്തും ചോദിക്കൂ — ഫീസ്, കട്ട്ഓഫ്, പ്ലേസ്‌മെന്റ്, സ്കോളർഷിപ്പ്. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?",
            "bn": "নমস্কার! আমি আরম্ভ, আপনার অ্যাডমিশন অ্যাসিস্ট্যান্ট। ইঞ্জিনিয়ারিং কলেজ সম্পর্কে যেকোনো কিছু জিজ্ঞাসা করুন — ফি, কাটঅফ, প্লেসমেন্ট, স্কলারশিপ। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
            "gu": "નમસ્તે! હું આરંભ છું, તમારો એડમિશન આસિસ્ટન્ટ. એન્જિનિયરિંગ કોલેજો વિશે કંઈપણ પૂછો — ફી, કટઓફ, પ્લેસમેન્ટ, સ્કોલરશિપ. આજે હું તમને કેવી રીતે મદદ કરી શકું?",
            "pa": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਆਰੰਭ ਹਾਂ, ਤੁਹਾਡਾ ਐਡਮਿਸ਼ਨ ਅਸਿਸਟੈਂਟ। ਇੰਜੀਨੀਅਰਿੰਗ ਕਾਲਜਾਂ ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛੋ — ਫੀਸ, ਕੱਟਆਫ, ਪਲੇਸਮੈਂਟ, ਸਕਾਲਰਸ਼ਿਪ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
        }
        if detected_lang in greetings_by_lang:
            greeting = greetings_by_lang[detected_lang]
        yield {"type": "token", "text": greeting}
        yield {"type": "meta", "confidence": 1.0, "language": detected_lang, "web_used": False}
        yield {"type": "done"}
        return

    # 2) Resolve coreferences + search IN PARALLEL for speed
    # Local retrieval starts immediately with the working_query from query_understanding.
    # Coreference resolution runs in parallel — its result is used for web search.
    yield {"type": "status", "step": "searching"}

    async def _local():
        return await retrieval(state)

    async def _resolve():
        return await _resolve_query(user_message, history)

    async def _web(query):
        from ..rag.web_search import live_web_chunks
        try:
            chunks = await live_web_chunks(query, k=s.live_search_top_k)
            return chunks or []
        except Exception as exc:
            log.info("parallel_web_failed", error=str(exc)[:80])
            return []

    # Start local retrieval immediately (doesn't need resolved query — uses working_query from step 1)
    local_task = asyncio.create_task(_local())
    resolve_task = asyncio.create_task(_resolve())

    # Wait for resolution first (fast — single LLM call), then start web search with resolved query
    resolved_query = await resolve_task
    search_query = resolved_query if resolved_query != user_message else state["working_query"]
    state["working_query"] = search_query

    web_task = asyncio.create_task(_web(search_query))

    local_result = await local_task
    state.update(local_result)
    local_chunks = state.get("reranked", []) or []

    web_chunks = await web_task
    web_used = len(web_chunks) > 0

    # 4) Merge + rerank all chunks together (best evidence wins regardless of source)
    all_chunks = list(local_chunks) + web_chunks
    if all_chunks:
        try:
            # Use higher top_k to preserve more diverse sources for citations
            effective_top_k = max(s.rerank_top_k, min(len(all_chunks), 12))
            merged = rerank(state["working_query"], all_chunks, top_k=effective_top_k)
        except Exception:
            merged = all_chunks[:12]
    else:
        merged = []

    if web_used:
        yield {"type": "web_search_result", "count": len(web_chunks)}

    context, citations = _format_context(merged)
    yield {"type": "citations", "citations": citations}

    # No grounding at all
    if not merged:
        msg = (
            "I searched both my database and the web but couldn't find reliable "
            "information about this. This might be because:\n"
            "- The topic isn't related to engineering/polytechnic admissions\n"
            "- The name or term might be misspelled\n"
            "- The information isn't publicly available online\n\n"
            "Could you rephrase or provide more details?"
        )
        yield {"type": "token", "text": msg}
        yield {"type": "meta", "confidence": 0.0, "language": detected_lang, "web_used": web_used}
        yield {"type": "done"}
        return

    # 5) Stream generation — directly in the target language
    yield {"type": "status", "step": "generating"}

    # Build conversation history block (last 8 turns for continuity)
    history_block = ""
    if history:
        recent = history[-8:]
        lines = []
        for m in recent:
            role_label = "Student" if m["role"] == "user" else "Arambh"
            content = m["content"][:300]  # truncate long messages to save context window
            lines.append(f"{role_label}: {content}")
        history_block = HISTORY_TEMPLATE.format(history="\n".join(lines))

    system_prompt = _system_prompt_for_language(detected_lang)
    user_prompt = USER_TEMPLATE.format(
        history_block=history_block,
        context=context if context else "(No source information available for this query)",
        question=user_message,  # use original message, not resolved query, for natural conversation
    )

    msgs = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    accumulated = ""
    async for token in chat_stream(msgs, temperature=s.ollama_temperature):
        accumulated += token
        yield {"type": "token", "text": token}

    # Confidence from rerank scores
    confidence = min(1.0, max(0.0, _top_score(merged)))

    yield {
        "type": "meta",
        "confidence": confidence,
        "supported": confidence >= s.min_confidence,
        "language": detected_lang,
        "intent": state.get("intent"),
        "follow_ups": [],
        "web_used": web_used,
        "web_count": len(web_chunks),
    }
    yield {"type": "done"}


# ─────────────────── Non-streaming (for API consumers) ───────────────────
async def run_full(user_message: str, history: list[dict], language: str | None, web_search: bool | None = None) -> dict:
    result: dict = {}
    async for evt in run_streaming(user_message, history, language, web_search):
        if evt.get("type") == "token":
            result.setdefault("answer", "")
            result["answer"] += evt.get("text", "")
        elif evt.get("type") == "citations":
            result["citations"] = evt.get("citations", [])
        elif evt.get("type") == "meta":
            result.update({k: v for k, v in evt.items() if k != "type"})
    result.setdefault("answer", "")
    result.setdefault("citations", [])
    result.setdefault("confidence", 0.0)
    return result
