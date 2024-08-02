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
    const result = JSON.parse(file);

    for (const item of result) {
      const embedding = await getEmbedding(item);

      await prisma.$transaction(async (tx) => {
        const product = await tx.products.create({
          data: {
            name: item.name,
            price: parseFloat(item.price),
            category: item.category,
            dimensions: item.dimensions,
            color: item.color,
            weight: item.weight,
            brand: item.brand,
            stock: parseInt(item.stock),
            rating: parseFloat(item.rating),
            description: item.description,
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

const report = async (req, res, next) => {
  try {
    const search = await prisma.search.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json({
      status: "success",
      message: "search data",
      data: search,
    });
  } catch (error) {
    console.error(error);
    return res.json({ error: "Internal server error" }, { status: 500 });
  }
};

module.exports = { data, report };
