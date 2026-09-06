// Installed inside the pinned serving image, not downloaded at Pod startup.
// vLLM's built-in API key leaves non-/v1 routes open; deny them before routing.
export const RUNPOD_GATEWAY_SOURCE = String.raw`
import asyncio
import hmac
import json
import math
import os

class Gateway:
    def __init__(self, app):
        self.app = app
        self.key = os.environ["VLLM_API_KEY"].encode()
        self.model = os.environ["AIMC_MODEL_KEY"]
        self.active = 0
        if len(self.key) < 32:
            raise RuntimeError("A dedicated API key is required")

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            return await self.app(scope, receive, send)
        if scope["type"] != "http":
            return await send({"type": "websocket.close", "code": 1008})
        async def reject(status):
            await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json"), (b"cache-control", b"no-store")]})
            await send({"type": "http.response.body", "body": b'{"error":"Request not permitted by the Pod gateway"}'})
        headers = dict(scope.get("headers", []))
        if not hmac.compare_digest(headers.get(b"authorization", b""), b"Bearer " + self.key):
            return await reject(401)
        path, method = scope.get("path"), scope.get("method")
        if path == "/v1/models" and method == "GET":
            return await self.app(scope, receive, send)
        if path != "/v1/chat/completions" or method != "POST":
            return await reject(404)
        if self.active >= 4:
            return await reject(429)
        self.active += 1
        try:
            chunks = bytearray()
            deadline = asyncio.get_running_loop().time() + 10
            while True:
                message = await asyncio.wait_for(receive(), max(0.01, deadline - asyncio.get_running_loop().time()))
                if message["type"] == "http.disconnect":
                    return
                chunks.extend(message.get("body", b""))
                if len(chunks) > 65536:
                    return await reject(413)
                if not message.get("more_body", False):
                    break
            payload = json.loads(chunks)
            allowed = {"model", "messages", "max_tokens", "temperature", "top_p", "stream"}
            if not isinstance(payload, dict) or set(payload) - allowed or payload.get("model") != self.model:
                return await reject(400)
            messages = payload.get("messages")
            if not isinstance(messages, list) or not 1 <= len(messages) <= 64:
                return await reject(400)
            for message in messages:
                if not isinstance(message, dict) or set(message) != {"role", "content"} or message["role"] not in ("system", "user", "assistant") or not isinstance(message["content"], str):
                    return await reject(400)
            tokens = payload.get("max_tokens", 512)
            if type(tokens) is not int or not 1 <= tokens <= 2048:
                return await reject(400)
            payload["max_tokens"] = tokens
            for key, upper in (("temperature", 2), ("top_p", 1)):
                value = payload.get(key, 1)
                if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= upper:
                    return await reject(400)
            if type(payload.get("stream", False)) is not bool:
                return await reject(400)
            body = json.dumps(payload).encode()
            delivered = False
            async def replay():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()
            scope = dict(scope)
            scope["headers"] = [(k, v) for k, v in scope.get("headers", []) if k != b"content-length"] + [(b"content-length", str(len(body)).encode())]
            await self.app(scope, replay, send)
        except (ValueError, TypeError, asyncio.TimeoutError):
            return await reject(400)
        finally:
            self.active -= 1
`;

export function runpodBootstrap() {
  return `import os,pathlib,sys\npathlib.Path('/tmp/aimc_guard.py').write_text(${JSON.stringify(RUNPOD_GATEWAY_SOURCE)})\nos.execv(sys.executable,[sys.executable,'-m','vllm.entrypoints.openai.api_server',*sys.argv[1:]])`;
}
