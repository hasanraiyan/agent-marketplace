import { ChatOpenAI } from '@langchain/openai';
import { createReasoningChatOpenAI } from '../src/modules/agents/reasoningChatOpenAI.js';

const rawResponse = { id: 'chunk-1', choices: [{ index: 0 }] };

describe('createReasoningChatOpenAI', () => {
  const llm = createReasoningChatOpenAI({ apiKey: 'test-key', model: 'openrouter/model' });

  const convertDelta = (delta) =>
    llm.completions._convertCompletionsDeltaToBaseMessageChunk(delta, rawResponse, 'assistant');

  test('returns a ChatOpenAI instance', () => {
    expect(llm).toBeInstanceOf(ChatOpenAI);
  });

  test('forwards OpenRouter reasoning deltas onto additional_kwargs', () => {
    const chunk = convertDelta({ role: 'assistant', content: '', reasoning: 'hmm' });
    expect(chunk.additional_kwargs.reasoning).toBe('hmm');
  });

  test('forwards structured reasoning_details blocks', () => {
    const reasoning_details = [{ type: 'reasoning.text', text: 'hmm' }];
    const chunk = convertDelta({ role: 'assistant', content: '', reasoning_details });
    expect(chunk.additional_kwargs.reasoning_details).toEqual(reasoning_details);
  });

  test('keeps the base reasoning_content passthrough', () => {
    const chunk = convertDelta({ role: 'assistant', content: '', reasoning_content: 'deepseek thought' });
    expect(chunk.additional_kwargs.reasoning_content).toBe('deepseek thought');
  });

  test('leaves ordinary chunks untouched', () => {
    const chunk = convertDelta({ role: 'assistant', content: 'plain answer' });
    expect(chunk.content).toBe('plain answer');
    expect(chunk.additional_kwargs.reasoning).toBeUndefined();
    expect(chunk.additional_kwargs.reasoning_details).toBeUndefined();
  });
});
