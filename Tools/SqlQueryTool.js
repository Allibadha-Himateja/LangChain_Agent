import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { SqlDatabase } from "langchain/sql_db";
import { ChatGroq } from "@langchain/groq";
import { pull } from "langchain/hub";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { QuerySqlTool } from "langchain/tools/sql";
import { StructuredTool } from "@langchain/core/tools";

dotenv.config();

export class SQLQueryTool extends StructuredTool {
  static lc_name() {
    return "SQLQueryTool";
  }

  name = "sql_query_tool";

  description = `
    A tool for querying MSSQL databases using natural language.
    Input should be a question about the data in the database.
    The tool will generate and execute the appropriate SQL query,
    then return a natural language answer.
    Available tables: Artist, Album, Employee, Customer, Invoice.
  `;

  schema = z.object({
    question: z.string().min(3).max(500).describe("Natural language question about the database"),
  });

  db = null;
  llm = null;
  graph = null;
  isInitialized = false;

  constructor(llm) {
    super();
    this.llm=llm;
  }

  /**
   * Initialize the tool (must be called before use)
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      await this._setupDatabase();
      // await this._setupLLM();
      await this._setupGraph();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Tool initialization failed: ${error.message}`);
    }
  }

  async _setupDatabase() {
    try {
      this.db = await SqlDatabase.fromDataSourceParams({
        appDataSource: await new DataSource({
          type: "mssql",
          host: process.env.SQL_SERVER,
          port: parseInt(process.env.SQL_PORT || "1433"),
          username: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DATABASE,
          options: {
            encrypt: true,
            trustServerCertificate: true,
          },
          synchronize: false,
          logging: false,
        }).initialize(),
        includesTables: ['Artist', 'Album', 'Employee', 'Customer', 'Invoice'],
      });
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  // async _setupLLM() {
  //   try {
  //     this.llm = new ChatGroq({
  //       model: "llama-3.3-70b-versatile",
  //       apiKey: process.env.GROQ_API_KEY,
  //       temperature: 0,
  //     });
  //   } catch (error) {
  //     throw new Error(`LLM setup failed: ${error.message}`);
  //   }
  // }

  async _setupGraph() {
    if (!this.db || !this.llm) {
      throw new Error("Database and LLM must be initialized first");
    }

    try {
      const queryPromptTemplate = await pull("langchain-ai/sql-query-system-prompt");
      const queryOutputSchema = z.object({
        query: z.string().refine(q => q.trim().toUpperCase().startsWith("SELECT"), {
          message: "Only SELECT queries are allowed",
        }),
      });

      const structuredLlm = this.llm.withStructuredOutput(queryOutputSchema);

      // Define graph nodes
      const writeQuery = async (state) => {
        const messages = await queryPromptTemplate.formatMessages({
          dialect: this.db.appDataSourceOptions.type,
          top_k: 10,
          table_info: await this.db.getTableInfo(),
          input: state.question,
        });
        const result = await structuredLlm.invoke(messages);
        return { query: result.query };
      };

      const executeQuery = async (state) => {
        const executeQueryTool = new QuerySqlTool(this.db);
        return { result: await executeQueryTool.invoke(state.query) };
      };

      const generateAnswer = async (state) => {
        const prompt = `Given this question, SQL query, and result, answer the question:
          Question: ${state.question}
          SQL Query: ${state.query}
          SQL Result: ${state.result}`;
        const response = await this.llm.invoke(prompt);
        return { answer: response.content };
      };

      // Build the graph
      const graphBuilder = new StateGraph({
        stateSchema: Annotation.Root({
          question: Annotation(z.string()),
          query: Annotation(z.string()),
          result: Annotation(z.string()),
          answer: Annotation(z.string()),
        }),
      })
        .addNode("writeQuery", writeQuery)
        .addNode("executeQuery", executeQuery)
        .addNode("generateAnswer", generateAnswer)
        .addEdge("__start__", "writeQuery")
        .addEdge("writeQuery", "executeQuery")
        .addEdge("executeQuery", "generateAnswer")
        .addEdge("generateAnswer", "__end__");

      this.graph = graphBuilder.compile();
    } catch (error) {
      throw new Error(`Graph setup failed: ${error.message}`);
    }
  }

  async _call(input) {
    if (!this.isInitialized) {
      throw new Error("Tool not initialized. Call initialize() first.");
    }

    try {
      const parsedInput = this.schema.parse(input);
      const inputsObj = { question: parsedInput.question };

      let finalAnswer = "";
      for await (const step of await this.graph.stream(inputsObj, {
        streamMode: "values",
      })) {
        // console.log("Step:", step);
        if (step.answer) {
          finalAnswer = step.answer;
          // console.log("Final Answer:", finalAnswer);
        }
      }
      
      return finalAnswer;
    } catch (error) {
      console.error("Query processing error:", error);
      return `Error processing your question: ${error.message}`;
    }
  }
}

// Helper function to create and initialize the tool
export async function createSQLQueryTool(llm) {
  const tool = new SQLQueryTool(llm);
  await tool.initialize();
  return tool;
}