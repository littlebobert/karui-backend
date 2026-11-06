import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkInvite, mintInvite } from '../lib/invites.js';

const secret = 'test-secret';

test('a minted invite checks out with its ID and name', () => {
  const { id, code } = mintInvite({ name: 'Sam', secret });
  assert.deepEqual(checkInvite(code, { secret }), { id, name: 'Sam' });
});

test('an invite signed with another secret, or altered, is invalid', () => {
  const { code } = mintInvite({ name: 'Sam', secret: 'other' });
  assert.deepEqual(checkInvite(code, { secret }), { error: 'invalid' });
  const genuine = mintInvite({ name: 'Sam', secret }).code.split('.');
  const forged = Buffer.from(JSON.stringify({ i: 'x', n: 'Mallory', t: 0 })).toString('base64url');
  assert.deepEqual(checkInvite(`k1.${forged}.${genuine[2]}`, { secret }), { error: 'invalid' });
  for (const junk of [undefined, '', 'k1', 'k1.a', 'k2.a.b', 'k1.a.b']) assert.equal(checkInvite(junk, { secret }).error, 'invalid');
});

test('a revoked invite is refused', () => {
  const { id, code } = mintInvite({ name: 'Sam', secret });
  assert.deepEqual(checkInvite(code, { secret, revoked: `abc, ${id}` }), { error: 'revoked' });
});

test('without a secret nothing checks out', () => {
  const { code } = mintInvite({ name: 'Sam', secret });
  assert.deepEqual(checkInvite(code, { secret: undefined }), { error: 'not-configured' });
  assert.throws(() => mintInvite({ name: 'Sam', secret: '' }));
});
