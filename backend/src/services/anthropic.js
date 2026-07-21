import Anthropic from '@anthropic-ai/sdk';
import { config, flags } from '../config.js';

/**
 * Claude wrapper.
 *
 * Two entry points, matching the two shapes of AI work in this app:
 *
 *  • `completeJSON` — schema-constrained output for the health screening and
 *    plan generation. It uses `output_config.format`, which makes the API
 *    *guarantee* schema-valid JSON rather than asking nicely in the prompt. That
 *    matters more here than anywhere else in the codebase: if the screening
 *    response were malformed, the `clearance === 'defer'` safety branch could be
 *    skipped and we would show workouts to someone who was told not to train.
 *    Prompt-and-parse is not good enough for that path.
 *
 *  • `streamText` — token-by-token streaming for the coach chat.
 *
 * Both throw `AIUnavailable` when no API key is set, so callers can fall back to
 * the deterministic engine instead of failing the request.
 */

export class AIUnavailable extends Error {
  constructor(message = 'AI is not configured') {
    super(message);
    this.name = 'AIUnavailable';
  }
}

export class AIRefused extends Error {
  constructor(category) {
    super('The assistant declined to answer this request.');
    this.name = 'AIRefused';
    this.category = category ?? null;
  }
}

const client = flags.anthropicEnabled ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;

export const aiEnabled = () => flags.anthropicEnabled;

/**
 * Schema-constrained completion.
 *
 * @param {object}  opts
 * @param {string}  opts.system   System prompt.
 * @param {string}  opts.user     User turn.
 * @param {object}  opts.schema   JSON Schema the response must satisfy.
 * @param {string} [opts.model]   Defaults to the screening model.
 * @param {'low'|'medium'|'high'|'xhigh'|'max'} [opts.effort]
 */
export async function completeJSON({ system, user, schema, model, effort = 'high' }) {
  if (!client) throw new AIUnavailable();

  const response = await client.messages.create({
    model: model || config.anthropic.screeningModel,
    max_tokens: 16000,
    // Adaptive thinking: we want the model reasoning through contraindications
    // before it commits to a clearance decision.
    thinking: { type: 'adaptive' },
    output_config: {
      effort,
      format: { type: 'json_schema', schema },
    },
    system,
    messages: [{ role: 'user', content: user }],
  });

  // Always check stop_reason before reading content — a refusal returns HTTP 200
  // with empty or partial content, and blindly indexing content[0] would throw.
  if (response.stop_reason === 'refusal') {
    throw new AIRefused(response.stop_details?.category);
  }

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Model returned no text content');

  return JSON.parse(text);
}

/**
 * Streaming chat for the coach.
 *
 * @param {object}   opts
 * @param {string}   opts.system
 * @param {Array}    opts.messages  Anthropic message array.
 * @param {Function} opts.onDelta   Called with each text chunk.
 * @returns {Promise<{text: string, stopReason: string}>}
 */
export async function streamText({ system, messages, onDelta, model }) {
  if (!client) throw new AIUnavailable();

  const stream = client.messages.stream({
    model: model || config.anthropic.coachModel,
    max_tokens: 4096,
    system,
    messages,
  });

  let text = '';
  stream.on('text', (delta) => {
    text += delta;
    onDelta?.(delta);
  });

  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') {
    throw new AIRefused(final.stop_details?.category);
  }
  return { text, stopReason: final.stop_reason };
}
