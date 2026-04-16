import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * ask_clarification - A standard capability for Agents to handle ambiguity.
 * Instead of guessing, the agent can pause and present the user with multiple-choice questions.
 */
export const clarificationTool = new DynamicStructuredTool({
  name: 'ask_clarification',
  description: 'Use this tool when a user request is ambiguous, lacks specific details, or requires multiple choices to proceed. This will pause execution and ask the user for clarification in a structured way.',
  schema: z.object({
    questions: z.array(z.object({
      id: z.string().describe('Unique identifier for this question (e.g., "output_format")'),
      text: z.string().describe('The clarifying question to ask the user'),
      options: z.array(z.string()).describe('A list of possible answers (Multiple Choice)'),
      allowCustom: z.boolean().default(false).describe('Whether the user can provide a custom text response (default: false)')
    })).min(1)
  }),
  func: async () => {
    // This is a placeholder as the real logic is handled by the LangGraph interrupt.
    // In deepagents, tools marked for interrupt don't execute their logic;
    // they pause and wait for a resume command.
    return "Question(s) sent to user. Waiting for response...";
  },
});

export default clarificationTool;
