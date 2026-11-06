# karui-backend

Karui Cloud Sorting: an invite-only service that sorts a notification for [Karui](https://karui.jp) with OpenAI's decision model, GPT-6 Luna Decisions, through Vercel's AI Gateway.

Karui normally sorts with Apple's on-device model and, with Private Cloud Sorting on, Apple's Private Cloud Compute. On the author's own graded notifications the decision model was more accurate than either ([KN006](https://karui.jp/technotes/kn006)), so invited users can turn this on in Karui's settings.

## What it does with a notification

- Karui builds the same prompt it sends Private Cloud Compute (the notification and the person's sorting settings) and posts it here with an invite code.
- This service adds one question, "Important, Neutral, or Spam?", and passes it to the AI Gateway with zero data retention asked for on every request. The gateway refuses a request it can't serve that way rather than sending it on.
- It answers with the category and each category's probability. Karui decides with those.
- Nothing is stored. The logs have the status, the invite's ID, and the time taken, never the prompt or the answer.

## Endpoints

`POST /api/sort` with `Authorization: Bearer <invite code>` and `{ "prompt": "…" }`

```json
{ "category": "Important", "probabilities": { "Important": 0.88, "Neutral": 0.12, "Spam": 0 } }
```

`{ "refused": true }` when the model declines. Errors are `{ "error": "…" }`: 401 `invalid`, 403 `revoked`, 400 `bad-request`, 413 `too-long`, 429 `busy`, 502 `model-unavailable` or `unreadable`, 503 `not-configured`, 504 `model-unavailable`.

`POST /api/invite` with the same header answers `{ "ok": true, "name": "…" }` when the invite works.

## Invites

An invite code is signed with `INVITE_SECRET`; nothing is stored. Mint one:

```bash
INVITE_SECRET=… npm run invite -- "Sam"
```

It prints the invite's ID and a `karui://cloud-invite?code=…` link to send. Opening the link on an iPhone with Karui offers to turn on Cloud Sorting. To revoke an invite, add its ID to `REVOKED_INVITES` (comma-separated) and redeploy.

## Deploying on Vercel

1. Import this repository as a Vercel project. No build step or framework is needed.
2. Set the environment variables from `.env.example`: `AI_GATEWAY_API_KEY`, `INVITE_SECRET`, and `REVOKED_INVITES` (may be empty).
3. In AI Gateway, set a budget to cap spending, and buy credits: zero data retention needs a paid account.
4. Keep function logs at the defaults; this service never logs notification text.

## Development

```bash
npm test
```

Node 20 or later. There are no dependencies.
