import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { interrupt } from '@langchain/langgraph';

/**
 * ask_clarification - Pauses the agent and shows structured questions to the user.
 * Uses LangGraph's interrupt() directly so the resume value is a plain string,
 * keeping the copilotkit route's resume logic simple.
 */
export const clarificationTool = new DynamicStructuredTool({
  name: 'ask_clarification',
  description:
    'Use this tool when a user request is ambiguous, lacks specific details, or requires multiple choices to proceed. This will pause execution and ask the user for clarification in a structured way.',
  schema: z.object({
    questions: z
      .array(
        z.object({
          id: z.string().describe('Unique identifier for this question (e.g., "output_format")'),
          text: z.string().describe('The clarifying question to ask the user'),
          options: z.array(z.string()).describe('A list of possible answers (Multiple Choice)'),
          allowCustom: z
            .boolean()
            .default(false)
            .describe('Whether the user can provide a custom text response (default: false)'),
        })
      )
      .min(1),
  }),
  func: async ({ questions }) => {
    // Pause graph execution here. The interrupt value carries the questions so the
    // copilotkit route can format and display them.  When the user replies, LangGraph
    // resumes and interrupt() returns their answer string.
    const answer = await interrupt({ questions });
    return typeof answer === 'string' ? answer : JSON.stringify(answer);
  },
});

export default clarificationTool;
