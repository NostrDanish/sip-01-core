/**
 * Prompts for the AI Answer Layer.
 *
 * The contract: answers are synthesized ONLY from the supplied evidence,
 * statements carry [n] citations, and the model must say so when the
 * evidence doesn't cover the question. This turns the LLM from a generic
 * chatbot into an evidence synthesizer sitting on the federated index.
 *
 * The system prompt is engine policy: the host application injects it via
 * the engine config seam (src/lib/engineConfig.ts) at startup. Until
 * configured, a neutral brand-free default applies. The same prompt is
 * injected server-side on the engine tier (worker) so clients cannot
 * override it there.
 */
import { getEngineConfig } from '@/lib/engineConfig';
import type { AIEvidenceItem } from './types';

/** The active engine system prompt (host-injected; neutral default until configured). */
export function getAnswerSystemPrompt(): string {
  return getEngineConfig().ai.systemPrompt;
}

/** Build the user-turn evidence prompt: the query plus numbered evidence. */
export function buildEvidencePrompt(query: string, evidence: AIEvidenceItem[]): string {
  const block = evidence
    .map((e) => `[${e.n}]\ntitle: ${e.title}\nurl: ${e.url}\nsnippet: ${e.snippet}`)
    .join('\n\n');
  return `QUERY:
${query}

EVIDENCE:
${block}

Answer the query. End with a "Sources:" section listing the [n] references you actually used, one per line, exactly like "[1] <title>".`;
}
