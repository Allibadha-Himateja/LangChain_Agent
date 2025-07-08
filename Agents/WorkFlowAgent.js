import dotenv from 'dotenv';
dotenv.config();
import { createSQLQueryTool } from '../Tools/sqlQueryTool.js';
import { ChatGroq } from '@langchain/groq';
import { DynamicTool } from "@langchain/core/tools";
import { StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import fetch from "node-fetch";
// import { TavilySearchTool } from "@langchain/community/tools/tavily_search";
import { HumanMessage } from "@langchain/core/messages";

// Initialize Groq model
const model = new ChatGroq({
  model: 'llama-3.3-70b-versatile', // Updated model name
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
});

// Initialize SQL Tool
const sqltool = await createSQLQueryTool(model);

// Tools configuration
const tools = [
  sqltool,
  new DynamicTool({
    name: "wikipedia",
    description: "Search Wikipedia for information",
    func: async (query) => {
      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
      const data = await response.json();
      return data.extract || "No information found";
    }
  }),
  new DynamicTool({
    name: "multiply",
    description: "Multiply two numbers. Input format: 'num1,num2'",
    func: async (input) => {
      const [a, b] = input.split(',').map(Number);
      return (a * b).toString();
    }
  }),
//   new TavilySearchTool({
//     apiKey: process.env.TAVILY_API_KEY,
//   })
];

// Create the workflow
const workflow = new StateGraph({
  channels: {
    messages: { value: [] },
    tool_results: { value: [] }
  }
});

// Decision node
workflow.addNode("decide", async (state) => {
  const response = await model.invoke([
    new HumanMessage(
      `Available tools: ${tools.map(t => t.name).join(', ')}\n` +
      `User question: ${state.messages[0].content}\n` +
      `Respond with JSON: {"tool": "tool_name", "input": "tool_input"}`
    )
  ]);
  
  try {
    return JSON.parse(response.content);
  } catch {
    return { tool: null, response: "Couldn't process request" };
  }
});

// Tool execution node
workflow.addNode("execute_tool", new ToolNode({ tools }));

// Response node
workflow.addNode("respond", async (state) => {
  if (state.tool_results?.length) {
    const result = state.tool_results[0];
    const response = await model.invoke([
      new HumanMessage(
        `Tool result: ${result}\n` +
        `Original question: ${state.messages[0].content}\n` +
        `Provide a helpful answer:`
      )
    ]);
    return { messages: [new HumanMessage(response.content)] };
  }
  return state;
});

// Define workflow edges
workflow.addEdge("decide", "execute_tool");
workflow.addConditionalEdges("execute_tool", (state) => 
  state.tool_results?.length ? "respond" : "__end__"
);
workflow.addEdge("respond", "__end__");
workflow.setEntryPoint("decide");

const app = workflow.compile();

// Run function
async function ask(question) {
  const result = await app.invoke({
    messages: [new HumanMessage(question)]
  });
  return result.messages[0].content;
}

// Test the agent
(async () => {
  console.log(await ask("Multiply 5 and 6"));
  console.log(await ask("Tell me about the Eiffel Tower"));
//   console.log(await ask("What's the latest news about AI?"));
  console.log(await ask("How many customers are in our database?"));
})();