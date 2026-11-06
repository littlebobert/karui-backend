/// Asks OpenAI's decision model, through Vercel's AI Gateway, which category a
/// notification belongs in. The prompt is Karui's Private Cloud Sorting prompt, built
/// on the iPhone; this only adds the one question and passes it on. Nothing here
/// keeps or logs the prompt.
export const MODEL = 'openai/gpt-6-luna-decisions';
export const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/decisions';
/// About four times the longest prompt Karui builds.
export const MAX_PROMPT_LENGTH = 40_000;
export const CATEGORIES = ['Important', 'Neutral', 'Spam'];

export function requestBody(prompt) {
  return {
    model: MODEL,
    input: prompt,
    questions: [{
      type: 'choice',
      name: 'category',
      instructions: 'Following the instructions in the input, which category does this notification belong in?',
      choices: [
        { value: 'Important', description: 'Alert the person now.' },
        { value: 'Neutral', description: 'Keep it for the summary.' },
        { value: 'Spam', description: 'Silence it.' },
      ],
    }],
    // The gateway refuses a request it can't serve without keeping it, rather than
    // sending it on anyway.
    providerOptions: { gateway: { zeroDataRetention: true } },
  };
}

/// `{ category, probabilities }` from the gateway's reply, `{ refused: true }` when
/// the model declined, or null when the reply can't be read.
export function readReply(reply) {
  const answer = reply?.answers?.[0];
  if (!answer) return null;
  if (answer.type === 'refusal') return { refused: true };
  if (!CATEGORIES.includes(answer.choice)) return null;
  const probabilities = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const entry of answer.probabilities ?? []) {
    if (CATEGORIES.includes(entry.value) && typeof entry.probability === 'number') probabilities[entry.value] = entry.probability;
  }
  return { category: answer.choice, probabilities };
}

export async function decide(prompt, { key, fetch = globalThis.fetch, timeout = 10_000 }) {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(requestBody(prompt)),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) return { status: response.status };
  return { result: readReply(await response.json()) };
}
