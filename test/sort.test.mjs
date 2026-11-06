import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as sort } from '../api/sort.js';
import { POST as checkInviteRoute } from '../api/invite.js';
import { GATEWAY_URL, MODEL } from '../lib/decide.js';
import { mintInvite } from '../lib/invites.js';

const env = { INVITE_SECRET: 's', AI_GATEWAY_API_KEY: 'gateway-key', REVOKED_INVITES: '' };
const { code } = mintInvite({ name: 'Sam', secret: env.INVITE_SECRET });

function request(body, invite = code) {
  return new Request('https://example.test/api/sort', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(invite ? { authorization: `Bearer ${invite}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function gateway(reply, status = 200) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(reply), { status });
  };
  return { calls, fetch };
}

const choice = {
  answers: [{ type: 'choice', name: 'category', choice: 'Important', confidence: 0.82,
    probabilities: [{ value: 'Important', probability: 0.88 }, { value: 'Neutral', probability: 0.12 }, { value: 'Spam', probability: 0 }] }],
};

test('sorts with the decision model, asking for zero data retention', async () => {
  const { calls, fetch } = gateway(choice);
  const response = await sort(request({ prompt: 'Classify one notification…' }), { env, fetch });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { category: 'Important', probabilities: { Important: 0.88, Neutral: 0.12, Spam: 0 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, GATEWAY_URL);
  assert.equal(calls[0].init.headers.authorization, 'Bearer gateway-key');
  assert.equal(calls[0].body.model, MODEL);
  assert.equal(calls[0].body.input, 'Classify one notification…');
  assert.deepEqual(calls[0].body.questions[0].choices.map((c) => c.value), ['Important', 'Neutral', 'Spam']);
  assert.equal(calls[0].body.providerOptions.gateway.zeroDataRetention, true);
});

test('refuses without a working invite, and never asks the model', async () => {
  const { calls, fetch } = gateway(choice);
  assert.equal((await sort(request({ prompt: 'p' }, null), { env, fetch })).status, 401);
  assert.equal((await sort(request({ prompt: 'p' }, 'k1.a.b'), { env, fetch })).status, 401);
  const revoked = mintInvite({ name: 'Ex', secret: env.INVITE_SECRET });
  assert.equal((await sort(request({ prompt: 'p' }, revoked.code), { env: { ...env, REVOKED_INVITES: revoked.id }, fetch })).status, 403);
  assert.equal(calls.length, 0);
});

test('turns away empty, malformed, and overlong prompts', async () => {
  const { calls, fetch } = gateway(choice);
  assert.equal((await sort(request('not json'), { env, fetch })).status, 400);
  assert.equal((await sort(request({ prompt: '  ' }), { env, fetch })).status, 400);
  assert.equal((await sort(request({ prompt: 'x'.repeat(40_001) }), { env, fetch })).status, 413);
  assert.equal(calls.length, 0);
});

test('passes on a refusal, a busy gateway, and a failure', async () => {
  const refused = await sort(request({ prompt: 'p' }), { env, fetch: gateway({ answers: [{ type: 'refusal', name: 'category' }] }).fetch });
  assert.deepEqual(await refused.json(), { refused: true });
  assert.equal((await sort(request({ prompt: 'p' }), { env, fetch: gateway({}, 429).fetch })).status, 429);
  assert.equal((await sort(request({ prompt: 'p' }), { env, fetch: gateway({ error: 'no zdr' }, 400).fetch })).status, 502);
  assert.equal((await sort(request({ prompt: 'p' }), { env, fetch: gateway({ answers: [] }).fetch })).status, 502);
  const thrown = await sort(request({ prompt: 'p' }), { env, fetch: async () => { throw new Error('network'); } });
  assert.equal(thrown.status, 504);
});

test('without the gateway key it says so instead of failing upstream', async () => {
  const response = await sort(request({ prompt: 'p' }), { env: { ...env, AI_GATEWAY_API_KEY: '' }, fetch: gateway(choice).fetch });
  assert.equal(response.status, 503);
});

test('the invite check answers with the name', async () => {
  const response = await checkInviteRoute(request({}), { env });
  assert.deepEqual(await response.json(), { ok: true, name: 'Sam' });
  assert.equal((await checkInviteRoute(request({}, 'nope'), { env })).status, 401);
});
