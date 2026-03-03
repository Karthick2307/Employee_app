const router = require("express").Router();
const Site = require("../models/Site");

router.post("/", async (req, res) => {
  res.json(await Site.create({ name: req.body.name }));
});

router.get("/", async (req, res) => {
  res.json(await Site.find().sort({ name: 1 }));
});

router.delete("/:id", async (req, res) => {
  await Site.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;