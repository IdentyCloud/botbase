const express = require("express");
const cors = require("cors");
const logs = require("./middlewares/logger");

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get("/api/v1/verify", logs, (_, res) => {
  res.send("API is working fine!");
});

app.use("/api/v1", require("./routes/data"));
app.use("/api/v1", require("./routes/chat"));

app.listen(port, () => {
  console.log(`HTTP OK`);
});
