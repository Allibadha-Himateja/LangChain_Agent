// local-mistral.js
const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: "not-needed", // Required by SDK, but ignored locally
  baseURL: "http://192.168.29.114:1234/v1",
});

async function askMistral(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "mistralai/mistral-7b-instruct-v0.3", // Use exactly this name
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    if (response.choices?.length > 0) {
      console.log("\n🤖 Mistral says:\n" + response.choices[0].message.content);
    } else {
      console.error("❌ No choices returned. The model may not be responding.");
    }
  } catch (error) {
    console.error("❌ Error communicating with Mistral:", error);
  }
}

askMistral("tell me 3 pineapple recepies");
