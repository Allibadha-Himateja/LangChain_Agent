import { tool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

const multiply = tool(
  async (args, Config) => {
    // multiply two numbers
    return a * b;
  },
  {
    name: "multiply",
    description: "Multiply two numbers",
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  }
);

// Example usage
const result= multiply.invoke({configurable :{a: 5, b: 10}});
console.log("Multiplication Result:", result); 

// how to use this tool dynamically with RunnableConfig
// used for passing args to the tool dynamically


