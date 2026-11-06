import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/// An invite code is `k1.<payload>.<signature>`: the payload names who it's for and
/// when it was made, and the signature, an HMAC with INVITE_SECRET, proves it was
/// minted here. Nothing is stored; an invite is revoked by listing its ID in
/// REVOKED_INVITES.
const PREFIX = 'k1';

function sign(payload, secret) {
  return createHmac('sha256', secret).update(`${PREFIX}.${payload}`).digest('base64url');
}

export function mintInvite({ name, secret, now = new Date(), id = randomBytes(6).toString('base64url') }) {
  if (!secret) throw new Error('INVITE_SECRET is not set.');
  const payload = Buffer.from(JSON.stringify({ i: id, n: name ?? '', t: Math.floor(now.getTime() / 1000) })).toString('base64url');
  return { id, code: `${PREFIX}.${payload}.${sign(payload, secret)}` };
}

/// The invite's ID and name, or an error saying why it doesn't work.
export function checkInvite(code, { secret, revoked = '' }) {
  if (!secret) return { error: 'not-configured' };
  const parts = typeof code === 'string' ? code.trim().split('.') : [];
  if (parts.length !== 3 || parts[0] !== PREFIX) return { error: 'invalid' };
  const [, payload, signature] = parts;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { error: 'invalid' };
  let invite;
  try {
    invite = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { error: 'invalid' };
  }
  const revokedIDs = new Set(revoked.split(',').map((id) => id.trim()).filter(Boolean));
  if (revokedIDs.has(invite.i)) return { error: 'revoked' };
  return { id: invite.i, name: invite.n };
}

/// The invite code from an `Authorization: Bearer …` header.
export function inviteFromRequest(request) {
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}
