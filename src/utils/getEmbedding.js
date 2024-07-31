const OpenAI = require("openai");

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  throw Error("OPENAI_API_KEY is not set");
}
const openai = new OpenAI({ apiKey: openaiApiKey });

async function getEmbedding(data) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: JSON.stringify(data),
  });

  const embedding = response.data[0].embedding;
  if (!embedding) throw Error("Error generating embedding.");
  return embedding;
}

module.exports = getEmbedding;
