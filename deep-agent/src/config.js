import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Single Responsibility: Manage environment variables and model configuration.
 */
export const config = {
  model: new ChatOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-5.4-nano",
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL,
    },
  }),
  threadId: process.env.DEFAULT_THREAD_ID || "default-user",
};
