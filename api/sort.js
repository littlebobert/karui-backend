import { checkInvite, inviteFromRequest } from '../lib/invites.js';
import { decide, MAX_PROMPT_LENGTH } from '../lib/decide.js';

/// POST /api/sort with `Authorization: Bearer <invite code>` and `{ "prompt": "…" }`.
/// Answers `{ category, probabilities }`. Only the status, the invite's ID, and the
/// time taken are logged, never the notification.
export async function POST(request, { env = process.env, fetch = globalThis.fetch } = {}) {
  const started = Date.now();
  const invite = checkInvite(inviteFromRequest(request), { secret: env.INVITE_SECRET, revoked: env.REVOKED_INVITES });
  if (invite.error) {
    const status = invite.error === 'not-configured' ? 503 : invite.error === 'revoked' ? 403 : 401;
    return reply(status, { error: invite.error }, started);
  }
  if (!env.AI_GATEWAY_API_KEY) return reply(503, { error: 'not-configured' }, started, invite.id);

  let prompt;
  try {
    ({ prompt } = await request.json());
  } catch {
    return reply(400, { error: 'bad-request' }, started, invite.id);
  }
  if (typeof prompt !== 'string' || !prompt.trim()) return reply(400, { error: 'bad-request' }, started, invite.id);
  if (prompt.length > MAX_PROMPT_LENGTH) return reply(413, { error: 'too-long' }, started, invite.id);

  let outcome;
  try {
    outcome = await decide(prompt, { key: env.AI_GATEWAY_API_KEY, fetch });
  } catch {
    return reply(504, { error: 'model-unavailable' }, started, invite.id);
  }
  if (outcome.status === 429) return reply(429, { error: 'busy' }, started, invite.id);
  if (outcome.status) return reply(502, { error: 'model-unavailable' }, started, invite.id);
  if (!outcome.result) return reply(502, { error: 'unreadable' }, started, invite.id);
  if (outcome.result.refused) return reply(200, { refused: true }, started, invite.id);
  return reply(200, outcome.result, started, invite.id);
}

function reply(status, body, started, inviteID = '-') {
  console.log(`sort ${status} invite=${inviteID} ${Date.now() - started}ms`);
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}
