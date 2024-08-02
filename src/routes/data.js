const express = require("express");
const { data, report } = require("../controllers/data");

const router = express.Router();

router.post("/data", data);
router.get("/report", report);

module.exports = router;
