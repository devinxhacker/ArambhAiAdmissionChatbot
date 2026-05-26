import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.database import get_db
from ..core.deps import current_user
from ..core.rate_limit import rate_limit
from ..models.conversation import AskRequest
from ..repositories.conversation_repo import ConversationRepo
from ..services.ai_client import get_ai_client

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("")
async def list_conversations(user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = ConversationRepo(db)
    convs = await repo.list_for_user(user["_id"])
    return [
        {
            "id": str(c["_id"]),
            "title": c["title"],
            "created_at": c["created_at"],
            "updated_at": c["updated_at"],
        }
        for c in convs
    ]


@router.post("")
async def create_conversation(user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = ConversationRepo(db)
    conv = await repo.create_conversation(user_id=user["_id"])
    return {"id": str(conv["_id"]), "title": conv["title"]}


@router.get("/{conv_id}")
async def get_conversation(conv_id: str, user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = ConversationRepo(db)
    conv = await repo.get_conversation(conv_id, user["_id"])
    if not conv:
        raise HTTPException(404, "conversation not found")
    msgs = await repo.list_messages(conv_id)
    return {
        "id": str(conv["_id"]),
        "title": conv["title"],
        "messages": [
            {
                "id": str(m["_id"]),
                "role": m["role"],
                "content": m["content"],
                "citations": m.get("citations", []),
                "confidence": m.get("confidence"),
                "language": m.get("language"),
                "created_at": m["created_at"],
            }
            for m in msgs
        ],
    }


@router.delete("/{conv_id}")
async def delete_conversation(conv_id: str, user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = ConversationRepo(db)
    n = await repo.delete(conv_id, user["_id"])
    return {"deleted": n}


@router.post("/{conv_id}/ask")
async def ask(
    conv_id: str,
    body: AskRequest,
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: None = Depends(rate_limit),
):
    repo = ConversationRepo(db)
    conv = await repo.get_conversation(conv_id, user["_id"])
    if not conv:
        raise HTTPException(404, "conversation not found")

    # persist user msg up-front
    await repo.add_message(conversation_id=conv_id, role="user", content=body.message, language=body.language)

    # Auto-rename conversation based on first user message
    if conv.get("title") in ("New chat", None, ""):
        # Generate a short title from the user's first message
        title = body.message.strip()[:60]
        # Clean up: remove trailing punctuation fragments
        if len(title) < len(body.message.strip()):
            # Truncated — find last space to avoid cutting mid-word
            last_space = title.rfind(' ')
            if last_space > 20:
                title = title[:last_space] + "..."
            else:
                title = title + "..."
        await repo.update_title(conv_id, title)

    history = await repo.list_messages(conv_id)
    history_payload = [{"role": m["role"], "content": m["content"]} for m in history]

    ai = get_ai_client()

    if not body.stream:
        result = await ai.ask(
            message=body.message, history=history_payload,
            language=body.language, web_search=body.web_search,
        )
        await repo.add_message(
            conversation_id=conv_id,
            role="assistant",
            content=result.get("answer", ""),
            citations=result.get("citations", []),
            confidence=result.get("confidence"),
            language=result.get("language"),
        )
        return result

    # NDJSON streaming (one JSON event per line). Simpler + more reliable than SSE.
    async def event_stream():
        accumulated = ""
        citations: list = []
        confidence: float | None = None
        language: str | None = None
        errored = False

        try:
            async for chunk in ai.ask_stream(
                message=body.message, history=history_payload,
                language=body.language, web_search=body.web_search,
            ):
                kind = chunk.get("type")
                if kind == "token":
                    accumulated += chunk.get("text", "")
                elif kind == "citations":
                    citations = chunk.get("citations", [])
                elif kind == "meta":
                    confidence = chunk.get("confidence")
                    language = chunk.get("language")
                elif kind == "error":
                    errored = True
                yield (json.dumps(chunk) + "\n").encode("utf-8")
        except Exception as exc:  # noqa: BLE001
            errored = True
            yield (json.dumps({"type": "error", "message": str(exc)}) + "\n").encode("utf-8")
        finally:
            if accumulated and not errored:
                try:
                    await repo.add_message(
                        conversation_id=conv_id,
                        role="assistant",
                        content=accumulated,
                        citations=citations,
                        confidence=confidence,
                        language=language,
                    )
                except Exception:
                    pass

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # disable proxy buffering when behind nginx
        },
    )
