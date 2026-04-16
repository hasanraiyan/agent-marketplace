import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Single Responsibility: Manage environment variables and model configuration.
 */
export const config = {
  model: new ChatOpenAI({
    model: "gpt-5.4-nano",
    apiKey: process.env.OPENAI_API_KEY,
  }),
  threadId: process.env.DEFAULT_THREAD_ID || "default-user",
};
