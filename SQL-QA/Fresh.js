import dotenv from "dotenv";
dotenv.config();
import { DataSource } from "typeorm";
import { SqlDatabase } from "langchain/sql_db";

// first setup the DB using the langchain SqlDatabase standard way
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
                    synchronize: false, // Important: disable schema synchronization
                    logging: false // Disable logging for cleaner output
                }).initialize(),
    includesTables: ['Artist', 'Album', 'Employee', 'Customer', 'Invoice'],
    // ignoreTables: [] // Tables to exclude
});
// console.log("Connected to database. Tables:", Object.keys(await db.getTableInfo()));
// db.run("SELECT * FROM Artist;").then(result => {
//     console.log("Query result:", result)
//     }).catch(err => { console.error("Database query failed:", err); }
// ).finally(() => {
//     db.appDataSource.destroy(); // Close the connection
// });


// next we will use the groq model to generate a query
import { ChatGroq } from "@langchain/groq";

const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0
});

// fetching System prompt template from langchain hub
import { pull } from "langchain/hub";

const queryPromptTemplate = await pull("langchain-ai/sql-query-system-prompt");
// asal ee queryPromptTemplate direct ga pull chesam,
// but issue is we cant able to print the prompt template


// step 3 is that we have to use the langGraph to create a state machine
// what is the use of this means we can handle the input according to the state
// first is question=> query > result > answer 
// these are the states we have to handle
import { Annotation } from "@langchain/langgraph";

const InputStateAnnotation = Annotation.Root({
  question: Annotation("string"),
});

const StateAnnotation = Annotation.Root({
  question: Annotation("string"),
  query: Annotation("string"),
  result: Annotation("string"),
  answer: Annotation("string"),
});


// after formatting the input we have to generate the query
import { z } from "zod";

const queryOutput = z.object({
  query: z.string().describe("Syntactically valid SQL query."),
});

const structuredLlm = llm.withStructuredOutput(queryOutput);

const writeQuery = async (state) => {
  const messages = await queryPromptTemplate.formatMessages({
    dialect: db.appDataSourceOptions.type,
    top_k: 10,
    table_info: await db.getTableInfo(),
    input: state.question,
  });

  const result = await structuredLlm.invoke(messages);
  console.log("Generated query:", result.query);
  return { query: result.query };
};


// writeQuery({ question: "How many Employees are there?" });
// executing query....
import { QuerySqlTool } from "langchain/tools/sql";
const executeQuery = async (state) => {
  const executeQueryTool = new QuerySqlTool(db);
  return { result: await executeQueryTool.invoke(state.query) };
};

await executeQuery({
  question: "",
  query: "SELECT COUNT(*) AS EmployeeCount FROM Employee;",
  result: "",
  answer: "",
});
// actual answer generation
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

// langGraph 

import { StateGraph } from "@langchain/langgraph";

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

// Note: tslab only works inside a jupyter notebook. Don't worry about running this code yourself!
// import * as tslab from "tslab";
// const image = await graph.getGraph().drawMermaidPng();
// const arrayBuffer = await image.arrayBuffer();
// await tslab.display.png(new Uint8Array(arrayBuffer));

// let inputs = { question: "How many Artists are there?" };

// console.log(inputs);
// console.log("\n====\n");
// for await (const step of await graph.stream(inputs, {
//   streamMode: "updates",
// })) {
//   console.log(step);
//   console.log("\n====\n");
// }
import readlineSync from 'readline-sync';
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