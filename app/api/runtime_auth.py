"""Optional bearer gate for the SYA function host.

The desktop app and local tests leave FUNCTION_RUNTIME_TOKEN unset, so their
requests stay open. When the parent host spawns this process, it sets the token
and proof key and refuses to call a runtime that accepts anonymous requests.
"""

from __future__ import annotations

import hashlib
import hmac
import os

PROOF_CHALLENGE = b"sya-runtime-v1"
UNAUTHORIZED = (
    b'{"ok":false,"data":null,"error":{"code":"unauthorized","message":"Bearer token required."}}'
)


class RuntimeAuthMiddleware:
    """Require the host bearer token only when that token is configured."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        token = os.environ.get("FUNCTION_RUNTIME_TOKEN", "")
        if not token or scope["method"] == "OPTIONS":
            await self.app(scope, receive, send)
            return

        if _authorization(scope) != f"Bearer {token}":
            await _send_json(send, 401, UNAUTHORIZED)
            return

        proof = _health_proof(scope)

        async def send_with_proof(message) -> None:
            if proof and message["type"] == "http.response.start":
                headers = list(message.get("headers") or [])
                headers.append((b"x-sya-runtime-proof", proof))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_proof)


def _authorization(scope) -> str:
    for key, value in scope.get("headers") or []:
        if key == b"authorization":
            return value.decode()
    return ""


def _health_proof(scope) -> bytes:
    if scope.get("path") != "/health":
        return b""
    key = os.environ.get("FUNCTION_RUNTIME_PROOF_KEY", "")
    if not key:
        return b""
    return hmac.new(key.encode(), PROOF_CHALLENGE, hashlib.sha256).hexdigest().encode()


async def _send_json(send, status: int, body: bytes) -> None:
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
