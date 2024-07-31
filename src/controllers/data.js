const fs = require("fs").promises;
const { PrismaClient } = require("@prisma/client");
const getEmbedding = require("../utils/getEmbedding");
const { Pinecone } = require("@pinecone-database/pinecone");

const prisma = new PrismaClient();

const pineconeApiKey = process.env.PINECONE_API_KEY;
if (!pineconeApiKey) {
  throw Error("PINECONE_API_KEY is not set");
}
const pc = new Pinecone({
  apiKey: pineconeApiKey,
});
const index = pc.index("bot-base");

const data = async (req, res, next) => {
  try {
    const file = await fs.readFile(process.cwd() + "/data.json", "utf8");
    const { result } = JSON.parse(file);

    console.log(result)

    for (const item of result) {
      const embedding = await getEmbedding(item);

      await prisma.$transaction(async (tx) => {
        const product = await tx.products.create({
          data: {
            name: item.product.name,
            price: parseFloat(item.product.price),
            description: item.product.description,
          },
        });

        await index.upsert([
          {
            id: product.id,
            values: embedding,
            metadata: { product: item.uuid },
          },
        ]);
      });
    }

    res.json({
      status: "success",
      message: "products imported correctly",
      data: result.length,
    });
  } catch (error) {
    console.error(error);
    return res.json({ error: "Internal server error" }, { status: 500 });
  }
};

module.exports = { data };
