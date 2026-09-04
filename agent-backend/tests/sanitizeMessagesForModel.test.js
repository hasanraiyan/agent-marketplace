import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import {
  sanitizeMessagesForModel,
  sanitizeMessageForModel,
  inspectMessageContent,
} from '../src/modules/agents/sanitizeMessagesForModel.js';

describe('sanitizeMessagesForModel', () => {
  test('inspects message content and identifies functionCall block', () => {
    const aiMsg = new AIMessage({
      content: [
        { type: 'text', text: 'Inspecting files...' },
        {
          type: 'functionCall',
          functionCall: { name: 'list_directory', args: { path: '/workspace' } },
        },
      ],
      tool_calls: [{ id: 'call_1', name: 'list_directory', args: { path: '/workspace' } }],
    });

    const inspection = inspectMessageContent(aiMsg, 'openai');
    expect(inspection.hasIncompatible).toBe(true);
    expect(inspection.types).toContain('functionCall');
  });

  test('strips functionCall from AIMessage for openai provider', () => {
    const aiMsg = new AIMessage({
      content: [
        {
          type: 'functionCall',
          functionCall: { name: 'list_directory', args: { path: '/workspace' } },
        },
      ],
      tool_calls: [{ id: 'call_1', name: 'list_directory', args: { path: '/workspace' } }],
    });

    const { message, modified, changes } = sanitizeMessageForModel(aiMsg, 'openai');
    expect(modified).toBe(true);
    expect(changes.length).toBeGreaterThan(0);
    expect(message.content).toBe('');
    expect(message.tool_calls).toHaveLength(1);
    expect(message.tool_calls[0].name).toBe('list_directory');
  });

  test('preserves text content while stripping functionCall', () => {
    const aiMsg = new AIMessage({
      content: [
        { type: 'text', text: 'I will list the files for you.' },
        {
          type: 'functionCall',
          functionCall: { name: 'list_directory', args: {} },
        },
      ],
      tool_calls: [{ id: 'call_1', name: 'list_directory', args: {} }],
    });

    const { message, modified } = sanitizeMessageForModel(aiMsg, 'openai');
    expect(modified).toBe(true);
    expect(message.content).toBe('I will list the files for you.');
    expect(message.tool_calls).toHaveLength(1);
  });

  test('recovers tool_calls if AIMessage did not have tool_calls populated', () => {
    const aiMsg = new AIMessage({
      content: [
        {
          type: 'functionCall',
          functionCall: { id: 'call_99', name: 'read_file', args: { file: 'a.txt' } },
        },
      ],
    });

    const { message, modified } = sanitizeMessageForModel(aiMsg, 'openai');
    expect(modified).toBe(true);
    expect(message.tool_calls).toHaveLength(1);
    expect(message.tool_calls[0].name).toBe('read_file');
  });

  test('leaves string content untouched', () => {
    const humanMsg = new HumanMessage('Hello');
    const aiMsg = new AIMessage('I am an assistant');

    const result = sanitizeMessagesForModel([humanMsg, aiMsg], 'openai');
    expect(result.totalModified).toBe(0);
    expect(result.messages[0].content).toBe('Hello');
    expect(result.messages[1].content).toBe('I am an assistant');
  });

  test('stringifies array content in ToolMessage for openai', () => {
    const toolMsg = new ToolMessage({
      content: [{ type: 'text', text: 'Result data' }],
      tool_call_id: 'call_1',
    });

    const { message, modified } = sanitizeMessageForModel(toolMsg, 'openai');
    expect(modified).toBe(true);
    expect(typeof message.content).toBe('string');
    expect(message.content).toContain('Result data');
  });

  test('handles mixed message history correctly', () => {
    const messages = [
      new HumanMessage('Show files'),
      new AIMessage({
        content: [
          {
            type: 'functionCall',
            functionCall: { name: 'list_dir', args: {} },
          },
        ],
        tool_calls: [{ id: 'call_1', name: 'list_dir', args: {} }],
      }),
      new ToolMessage({ content: 'file1.txt\nfile2.txt', tool_call_id: 'call_1' }),
      new AIMessage('Found file1.txt and file2.txt'),
      new HumanMessage('Read file1.txt'),
    ];

    const result = sanitizeMessagesForModel(messages, 'openai');
    expect(result.totalModified).toBe(1);
    expect(result.messages[1].content).toBe('');
    expect(result.messages[1].tool_calls).toHaveLength(1);
    expect(result.messages[3].content).toBe('Found file1.txt and file2.txt');
  });
});
