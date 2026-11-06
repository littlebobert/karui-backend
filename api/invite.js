import { checkInvite, inviteFromRequest } from '../lib/invites.js';

/// POST /api/invite with `Authorization: Bearer <invite code>`: whether the code
/// works, before Karui turns Cloud Sorting on.
export async function POST(request, { env = process.env } = {}) {
  const invite = checkInvite(inviteFromRequest(request), { secret: env.INVITE_SECRET, revoked: env.REVOKED_INVITES });
  const status = invite.error ? (invite.error === 'not-configured' ? 503 : invite.error === 'revoked' ? 403 : 401) : 200;
  console.log(`invite ${status} invite=${invite.id ?? '-'}`);
  return Response.json(invite.error ? { error: invite.error } : { ok: true, name: invite.name }, { status, headers: { 'cache-control': 'no-store' } });
}
