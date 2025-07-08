import dotenv from 'dotenv';
dotenv.config();
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate ,MessagesPlaceholder} from '@langchain/core/prompts';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { createSQLQueryTool } from './Tools/SqlQueryTool.js';
import { DynamicTool } from "@langchain/core/tools";
import {TavilySearch} from "@langchain/tavily";
import readlineSync from  'readline-sync';
const model =new ChatGroq({
    model: 'llama-3.3-70b-versatile', 
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0,
});

const prompt = ChatPromptTemplate.fromMessages
([
    ("system",'You are a helpful assistant. You can answer questions about various topics, including SQL queries, Wikipedia information, and basic arithmetic operations.'),
    ("human","{input}"),
    new MessagesPlaceholder("agent_scratchpad"),
]);

const sqltool= await createSQLQueryTool(model);
const wikipediaTool = new DynamicTool({
    name: "wikipedia",
    description: "Search Wikipedia for information",
    func: async (query) => {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        const data = await response.json();
        return data.extract || "No information found";
    }
}); 
const multiplyTool = new DynamicTool({
    name: "multiply",
    description: "Multiply two numbers. Input format: 'num1,num2'",
    func: async (input) => {
        const [a, b] = input.split(',').map(Number);
        return (a * b).toString();
    }
});
const tavilySearchTool = new TavilySearch({
    apiKey: process.env.TAVILY_API_KEY,
    description: "Search the web for information using Tavily",
});

const tools=[sqltool, multiplyTool, wikipediaTool];
const agent = new createToolCallingAgent({
    llm: model,
    prompt: prompt,
    tools: tools,
});

const agentExecutor = new AgentExecutor({
    agent,
    tools,
});

// const response = await agentExecutor.invoke({
//     input: "4*5?",
// });
// // const response = await tavilySearchTool.invoke({
// //     query: "What is the weather in Hyderabad?"
// // });
// console.log(response.output); 

function askQuestion()
{

    let question = readlineSync.question('ask any question!');

    const response = agentExecutor.invoke({
        input:question
    }).then(
        (output)=>
        {
            console.log(output.output);
        },
        (error)=>
        {
            console.log(error);
        }
    )
    if(response)
    {  
        askQuestion();
    }
    // console.log(response);
}
askQuestion();
