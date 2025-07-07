// import { DynamicTool } from "@langchain/core/tools";
// import { createSQLQueryTool } from "./SqlQueryTool.js";
// import fetch from "node-fetch";
// import { question } from "readline-sync";

// // Wikipedia Search Tool
// const wikipediaSearchTool = new DynamicTool({
//   name: "WikipediaSearch",
//   description: "Searches Wikipedia for a topic.",
//   func: async (query) => {
//     console.log("Searching Wikipedia for:", query);
//     const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
//     let data = await response.json();
//     return data.extract || "No summary found.";
//   }
// });

// const sqlQueryTool =await createSQLQueryTool();

// // const response =await wikipediaSearchTool.invoke("SQL");
// // console.log("Wikipedia Search Result:", response);
// const result= await sqlQueryTool.invoke({
//   question: "How many customers do we have?"
// });
// console.log("SQL Query Result:", result);

import { ChatGroq } from "@langchain/groq";
import { Stagehand } from "@browserbasehq/stagehand";
import {
  StagehandActTool,
  StagehandNavigateTool,
} from "@langchain/community/agents/toolkits/stagehand";
// import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

async function main() {
  // Initialize Stagehand once and pass it to the tools
  const stagehand = new Stagehand({
    env: "LOCAL",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    enableCaching: true,
  });
  // await stagehand.init();

  const actTool = new StagehandActTool(stagehand);
  const navigateTool = new StagehandNavigateTool(stagehand);

  // Initialize the model
  const model = new ChatGroq({
        model: "llama-3.3-70b-versatile",
        apiKey: process.env.GROQ_API_KEY,
        temperature: 0,
      });

  // Create the agent using langgraph
  const agent = createReactAgent({
    llm: model,
    tools: [actTool, navigateTool],
  });

  // Execute the agent using streams
  const inputs1 = {
    messages: [
      {
        role: "user",
        content: "Navigate to https://www.google.com",
      },
    ],
  };

  const stream1 = await agent.stream(inputs1, {
    streamMode: "values",
  });

  for await (const { messages } of stream1) {
    const msg =
      messages && messages.length > 0
        ? messages[messages.length - 1]
        : undefined;
    if (msg?.content) {
      console.log(msg.content);
    } else if (msg?.tool_calls && msg.tool_calls.length > 0) {
      console.log(msg.tool_calls);
    } else {
      console.log(msg);
    }
  }

  const inputs2 = {
    messages: [
      {
        role: "user",
        content: "Search for 'GroqAI' on Google",
      },
    ],
  };

  const stream2 = await agent.stream(inputs2, {
    streamMode: "values",
  });

  for await (const { messages } of stream2) {
    const msg =
      messages && messages.length > 0
        ? messages[messages.length - 1]
        : undefined;
    if (msg?.content) {
      console.log(msg.content);
    } else if (msg?.tool_calls && msg.tool_calls.length > 0) {
      console.log(msg.tool_calls);
    } else {
      console.log(msg);
    }
  }
}

// main();

export function initializeStagehand()
{
  const stagehand = new Stagehand({
    env: "LOCAL",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    enableCaching: true,
  });
  return stagehand;
}