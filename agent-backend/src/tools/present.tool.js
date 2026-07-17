import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * present_file - A lightweight metadata tool that notifies the frontend
 * to display/open a file in its workspace files panel on the right.
 */
export const presentFileTool = () =>
  new DynamicStructuredTool({
    name: 'present_file',
    description:
      'Presents a file to the user. Use this tool when you want to highlight a file in the user\'s workspace panel on the right side of the screen.',
    schema: z.object({
      filePath: z.string().describe('The path of the file to present (e.g., "/workspace/outputs/report.md").'),
      title: z.string().optional().describe('A title for the file.'),
      description: z.string().optional().describe('A brief explanation of why you are opening this file.'),
    }),
    func: async ({ filePath, title, description }) => {
      return JSON.stringify({
        status: 'success',
        filePath,
        title: title || filePath.split('/').pop(),
        description: description || '',
      });
    },
  });
