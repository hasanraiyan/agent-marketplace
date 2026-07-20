import { DynamicStructuredTool } from '@langchain/core/tools';
import { interrupt } from '@langchain/langgraph';
import { z } from 'zod';

const questionSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().min(1),
  options: z.array(z.string().min(1)).min(1).optional(),
  required: z.boolean().optional(),
  allowCustom: z.boolean().optional(),
});

function normalizeQuestions(questions) {
  return questions.map((question, index) => ({
    id: question.id || `question_${index + 1}`,
    text: question.text.trim(),
    options: Array.isArray(question.options)
      ? question.options.map((option) => option.trim()).filter(Boolean)
      : [],
    required: question.required !== false,
    allowCustom: question.allowCustom !== false,
  }));
}

export const askClarificationTool = () =>
  new DynamicStructuredTool({
    name: 'ask_clarification',
    description:
      'Pause the agent and ask the user one or more structured clarification questions. Use this when a choice card will help the user answer quickly before continuing.',
    schema: z.object({
      questions: z.array(questionSchema).min(1).max(12),
    }),
    func: async ({ questions }) => {
      const normalizedQuestions = normalizeQuestions(questions);
      const response = interrupt({
        kind: 'clarification',
        questions: normalizedQuestions,
      });

      return JSON.stringify({
        status: 'answered',
        answers: Array.isArray(response?.answers) ? response.answers : [],
        text: typeof response?.text === 'string' ? response.text : '',
      });
    },
  });
