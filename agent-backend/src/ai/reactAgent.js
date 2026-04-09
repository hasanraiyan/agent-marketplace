import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';

// Simple singleton React agent using an OpenAI chat model and no tools for now.

// Safely resolve base URL so a malformed env var does not crash requests
let resolvedBaseURL;
const rawBaseURL = process.env.OPENAI_BASE_URL;

if (rawBaseURL && rawBaseURL.trim() !== '') {
  const trimmed = rawBaseURL.trim();
  try {
    // Will throw if not a valid absolute URL
    // (e.g. "localhost:8080/v1" without protocol)
    // In that case we log a warning and fall back to the default SDK URL.
    // This prevents ERR_INVALID_URL at request time.
    // eslint-disable-next-line no-new
    new URL(trimmed);
    resolvedBaseURL = trimmed;
  } catch (err) {
    // Use console here to avoid pulling in app logger / circular deps
    console.warn('[AI] Ignoring invalid OPENAI_BASE_URL value', {
      value: rawBaseURL,
      error: err?.message,
    });

    // Ensure downstream SDKs that also read process.env.OPENAI_BASE_URL
    // do not see the invalid value either.
    // This avoids ERR_INVALID_URL thrown inside the OpenAI client itself.
    try {
      // eslint-disable-next-line no-param-reassign
      delete process.env.OPENAI_BASE_URL;
    } catch {
      // ignore – best-effort cleanup
    }
  }
}

const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
      }, 
});

const tools = [];

// createReactAgent returns a LangGraph app we can invoke with { messages }
const agent = createReactAgent({
  llm: model,
  tools,
});

/**
 * Run the React agent for a given conversation.
 * @param {Object} params
 * @param {string} [params.systemPrompt]
 * @param {Array<{ role: 'user' | 'assistant' | 'system', content: string }>} params.messages
 * @returns {Promise<AIMessage>}
 */
export async function runReactAgent({ systemPrompt, messages }) {
  const lcMessages = [];

  if (systemPrompt) {
    lcMessages.push(new SystemMessage(systemPrompt));
  }

  for (const m of messages) {
    if (!m || !m.content) continue;
    if (m.role === 'user') {
      lcMessages.push(new HumanMessage(m.content));
    } else if (m.role === 'assistant') {
      lcMessages.push(new AIMessage(m.content));
    } else if (m.role === 'system') {
      lcMessages.push(new SystemMessage(m.content));
    }
  }

  const result = await agent.invoke({ messages: lcMessages });
  const resultMessages = result?.messages || [];
  const last = resultMessages[resultMessages.length - 1];

  if (!(last instanceof AIMessage)) {
    // Fallback: wrap as AIMessage if needed
    return new AIMessage(String(last?.content ?? ''));
  }

  return last;
}

export default {
  runReactAgent,
};
