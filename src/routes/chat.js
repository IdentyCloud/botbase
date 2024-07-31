const express = require("express");
const { message } = require("../controllers/chat");

const router = express.Router();

router.post("/message", message);

module.exports = router;
