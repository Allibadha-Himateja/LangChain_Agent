// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Import dependencies
import { DataSource } from "typeorm";
import { SqlDatabase } from "langchain/sql_db";
import { ChatGroq } from "@langchain/groq";
import { pull } from "langchain/hub";
import { Annotation } from "@langchain/langgraph";
import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import readlineSync from 'readline-sync';
import { QuerySqlTool } from "langchain/tools/sql";

// Step 1: Setup MSSQL Database Connection
const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: await new DataSource({
        type: "mssql",
        host: process.env.SQL_SERVER,
        port: parseInt(process.env.SQL_PORT || 1433),
        username: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DATABASE,
        options: {
            encrypt: true,
            trustServerCertificate: true
        },
        extra: {
            options: {
                encrypt: true,
                trustServerCertificate: true
            }
        },
        synchronize: false,
        logging: false
    }).initialize(),
    includesTables: ['Artist', 'Album', 'Employee', 'Customer', 'Invoice']
});

// Step 2: Setup Groq LLM
const llm = new ChatGroq({
    model: "llama-3.3-70b-versatile",
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0
});

// Step 3: Prepare the Prompt Template
// Pull system prompt string from LangChain Hub
// Pull the ChatPromptTemplate directly
const queryPromptTemplate = await pull("langchain-ai/sql-query-system-prompt");

// Step 4: Setup LangGraph State Annotations
const InputStateAnnotation = Annotation.Root({
    question: Annotation("string"),
});

const StateAnnotation = Annotation.Root({
    question: Annotation("string"),
    query: Annotation("string"),
    result: Annotation("string"),
    answer: Annotation("string"),
});

// Step 5: Setup Output Validation Schema
const queryOutput = z.object({
    query: z.string().describe("Syntactically valid SQL query."),
});

const structuredLlm = llm.withStructuredOutput(queryOutput);

// Step 6: Function to Write SQL Query using Groq and Prompt
const writeQuery = async (state) => {
    const messages = await queryPromptTemplate.formatMessages({
        dialect: db.appDataSourceOptions.type,
        top_k: 10,
        table_info: await db.getTableInfo(),
        input: state.question,
    });

    const result = await structuredLlm.invoke(messages);
    // console.log("Generated SQL Query: ", result.query);
    return { query: result.query };
};
// Step 7: Query Execution function
const executeQuery = async (state) => {
  const executeQueryTool = new QuerySqlTool(db);
  return { result: await executeQueryTool.invoke(state.query) };
};

// Step 8: actual answer generating function
const generateAnswer = async (state) => {
  const promptValue =
    "Given the following user question, corresponding SQL query, " +
    "and SQL result, answer the user question.\n\n" +
    `Question: ${state.question}\n` +
    `SQL Query: ${state.query}\n` +
    `SQL Result: ${state.result}\n`;
  const response = await llm.invoke(promptValue);
  return { answer: response.content };
};

// Step 9: Define the State Graph
// used to define the flow of the state machine
const graphBuilder = new StateGraph({
  stateSchema: StateAnnotation,
})
  .addNode("writeQuery", writeQuery)
  .addNode("executeQuery", executeQuery)
  .addNode("generateAnswer", generateAnswer)
  .addEdge("__start__", "writeQuery")
  .addEdge("writeQuery", "executeQuery")
  .addEdge("executeQuery", "generateAnswer")
  .addEdge("generateAnswer", "__end__");

const graph = graphBuilder.compile();

//step 10
while (true) {
  const inputs = readlineSync.question("Enter your question: ");
  if (inputs.toLowerCase() === "exit") {
    console.log("Exiting...");
    break;
  }
  else{
    console.log(`Processing question: ${inputs}`);
    const inputsObj = { question: inputs };
    for await (const step of await graph.stream(inputsObj, {
      streamMode: "updates",
    })) {
      console.log(step);
      console.log("\n====\n");
    } 
  }
}
