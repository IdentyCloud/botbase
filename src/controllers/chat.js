const OpenAI = require("openai");
const { PrismaClient } = require("@prisma/client");
const { encoding_for_model } = require("tiktoken");
const getEmbedding = require("../utils/getEmbedding");
const { Pinecone } = require("@pinecone-database/pinecone");

const prisma = new PrismaClient();

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  throw Error("OPENAI_API_KEY is not set");
}
const openai = new OpenAI({ apiKey: openaiApiKey });

const pineconeApiKey = process.env.PINECONE_API_KEY;
if (!pineconeApiKey) {
  throw Error("PINECONE_API_KEY is not set");
}
const pc = new Pinecone({
  apiKey: pineconeApiKey,
});
const index = pc.index("bot-base");

const message = async (req, res, next) => {
  try {
    const messages = req.body.messages;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: "No messages provided" });
    }

    const userMessageContent = messages[messages.length - 1];
    if (!userMessageContent) {
      return res
        .status(400)
        .json({ error: "User message content is missing or empty" });
    }

    const classificationResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an intelligent assistant. Determine whether the following message is a direct question or if it requires further processing for product recommendations. Answer true for product recommendations or false for direct questions.",
        },
        {
          role: "user",
          content: userMessageContent,
        },
      ],
    });

    const classificationMessage =
      classificationResponse.choices[0]?.message?.content.trim().toLowerCase();

    if (classificationMessage === "true") {
      const embedding = await getEmbedding(
        messages.map((message) => message).join("\n")
      );

      const vectorQueryResponse = await index.query({
        vector: embedding,
        topK: 10,
      });

      const relevantProducts = await prisma.products.findMany({
        where: {
          id: {
            in: vectorQueryResponse.matches.map((match) => match.id),
          },
        },
      });

      const systemMessage = {
        role: "system",
        content:
          "You are an intelligent assistant for providing product recommendations. Answer the user's question based on the available products. Ensure to present the product information clearly without any special characters.\n" +
          "The relevant products for this query are:\n" +
          relevantProducts
            .map(
              (product) =>
                `${product.name} - Description: ${product.description} - Price: $${product.price}`
            )
            .join("\n"),
      };

      const userMessage = {
        role: "user",
        content: userMessageContent,
      };

      const enc = encoding_for_model("gpt-4o");
      const tokenSearchCount =
        enc.encode(systemMessage.content).length +
        enc.encode(userMessage.content).length;

      const completionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [systemMessage, userMessage],
      });

      let responseMessage = completionResponse.choices[0]?.message?.content;
      if (!responseMessage) {
        return res.status(500).json({ error: "Failed to generate a response" });
      }

      responseMessage = responseMessage.replace(/\\n/g, "\n");

      const tokenResponseCount = enc.encode(responseMessage).length;

      await prisma.$transaction(async (tx) => {
        await tx.search.create({
          data: {
            search: userMessageContent,
            token_search: tokenSearchCount,
            response: responseMessage,
            token_response: tokenResponseCount,
          },
        });
      });

      res.json({
        status: "success",
        message: responseMessage,
        data: relevantProducts,
      });
    } else {
      const enc = encoding_for_model("gpt-4o");
      const tokenSearchCount = enc.encode(userMessageContent).length;

      const completionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an intelligent assistant for providing product recommendations. Gives clear and simple answers" },
          { role: "user", content: userMessageContent }],
      });

      let responseMessage = completionResponse.choices[0]?.message?.content;
      if (!responseMessage) {
        return res.status(500).json({ error: "Failed to generate a response" });
      }

      responseMessage = responseMessage.replace(/\\n/g, "\n");

      const tokenResponseCount = enc.encode(responseMessage).length;

      await prisma.$transaction(async (tx) => {
        await tx.search.create({
          data: {
            search: userMessageContent,
            token_search: tokenSearchCount,
            response: responseMessage,
            token_response: tokenResponseCount,
          },
        });
      });

      res.json({
        status: "success",
        message: responseMessage,
        data: [],
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  message,
};
