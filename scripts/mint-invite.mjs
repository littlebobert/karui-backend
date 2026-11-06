#!/usr/bin/env node
// Prints an invite link for Karui Cloud Sorting.
//   INVITE_SECRET=… npm run invite -- "Sam"
// Revoke it later by adding the printed ID to REVOKED_INVITES in Vercel.
import { mintInvite } from '../lib/invites.js';

const name = process.argv[2] ?? '';
const { id, code } = mintInvite({ name, secret: process.env.INVITE_SECRET });
console.log(`ID:   ${id}${name ? ` (${name})` : ''}`);
console.log(`Link: karui://cloud-invite?code=${encodeURIComponent(code)}`);
