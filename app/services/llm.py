import httpx
from typing import AsyncGenerator
from app.config import settings

OPENWEBUI_BASE_URL = settings.OPENWEBUI_BASE_URL
OPENWEBUI_API_KEY = settings.OPENWEBUI_API_KEY
DEFAULT_MODEL = settings.OPENWEBUI_MODEL

async def chat_complete(
    messages: list[dict],
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> str:
    headers = {
        "Content-Type": "application/json",
        **({"Authorization": f"Bearer {OPENWEBUI_API_KEY}"} if OPENWEBUI_API_KEY else {}),
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{OPENWEBUI_BASE_URL}/api/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


async def chat_complete_stream(
    messages: list[dict],
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> AsyncGenerator[str, None]:
    headers = {
        "Content-Type": "application/json",
        **({"Authorization": f"Bearer {OPENWEBUI_API_KEY}"} if OPENWEBUI_API_KEY else {}),
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{OPENWEBUI_BASE_URL}/api/chat/completions",
            headers=headers,
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    import json
                    chunk = json.loads(line[6:])
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield delta


def build_messages(system: str, user: str) -> list[dict]:
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
