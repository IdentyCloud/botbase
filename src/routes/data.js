const express = require("express");
const { data } = require("../controllers/data");

const router = express.Router();

router.post("/data", data);

module.exports = router;
