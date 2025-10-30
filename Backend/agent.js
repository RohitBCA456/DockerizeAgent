// agent.js

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import dotenv from "dotenv";

dotenv.config();

export const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0.3,
  apiKey: process.env.GOOGLE_API_KEY,
});

export async function createDeployAgent(vectorStore) {
  const searchTool = new TavilySearchResults();
  const tools = [searchTool];
  if (vectorStore) {
    tools.push(new DocsRetrieverTool(vectorStore));
  }

  const prompt = await pull("hwchase17/react-chat");

  const agent = await createReactAgent({
    llm: model,
    tools,
    prompt,
    stopSequences: ["Observation"],
  });

  return new AgentExecutor({
    agent,
    tools,
    verbose: true,
  });
}