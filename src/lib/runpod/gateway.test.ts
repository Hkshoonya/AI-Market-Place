import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { RUNPOD_GATEWAY_SOURCE, runpodBootstrap } from "./gateway";

describe("Pod gateway (real Python ASGI execution, no GPU)", () => {
  it("requires authentication, blocks admin and SSRF inputs, and bounds generated work", () => {
    const harness = `
import asyncio, json, os
os.environ['VLLM_API_KEY'] = 'k' * 32
os.environ['AIMC_MODEL_KEY'] = 'model1'
exec(${JSON.stringify(RUNPOD_GATEWAY_SOURCE)})
calls = []
async def app(scope, receive, send):
    body = await receive() if scope['method'] == 'POST' else {}
    calls.append(body)
    await send({'type': 'http.response.start', 'status': 200})
gateway = Gateway(app)
async def check(path, method='GET', token='k'*32, payload=None, raw=None):
    sent=[]
    async def receive():
        return {'type':'http.request','body':raw if raw is not None else json.dumps(payload).encode(),'more_body':False}
    async def send(event): sent.append(event)
    await gateway({'type':'http','path':path,'method':method,'headers':[(b'authorization',('Bearer '+token).encode())]},receive,send)
    return sent[0]['status']
async def main():
    good={'model':'model1','messages':[{'role':'user','content':'Hello'}]}
    assert await check('/v1/models', token='wrong') == 401
    assert await check('/v1/models') == 200
    for path in ['/metrics','/pause','/invocations','/v1/load_lora_adapter','/docs','/health','/v1/models/../pause']:
        assert await check(path) == 404
    assert await check('/v1/chat/completions','POST',payload=good) == 200
    assert json.loads(calls[-1]['body'])['max_tokens'] == 512
    bads=[{**good,'n':100}, {**good,'max_tokens':999999}, {**good,'max_tokens':True}, {**good,'model':'other'}, {**good,'temperature':float('nan')}, {**good,'messages':[{'role':'user','content':[{'type':'image_url','image_url':{'url':'http://169.254.169.254/'}}]}]}]
    for bad in bads: assert await check('/v1/chat/completions','POST',payload=bad) == 400
    assert await check('/v1/chat/completions','POST',raw=b'x'*65537) == 413
    assert await check('/v1/chat/completions','POST',raw=b'{') == 400
    gateway.active=4
    assert await check('/v1/chat/completions','POST',payload=good) == 429
    print('gateway checks passed')
asyncio.run(main())
`;
    const result = spawnSync("python3", ["-c", harness], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("gateway checks passed");
  });
  it("bootstrap compiles without downloading startup code or embedding a credential", () => {
    const result = spawnSync(
      "python3",
      [
        "-c",
        `compile(${JSON.stringify(runpodBootstrap())}, '<bootstrap>', 'exec')`,
      ],
      { encoding: "utf8" },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(runpodBootstrap()).not.toMatch(/curl|wget|https:\/\//);
  });
});
