const router = require("express").Router();
const Designation = require("../models/Designation");

router.post("/", async (req, res) => {
  res.json(await Designation.create({ name: req.body.name }));
});

router.get("/", async (req, res) => {
  res.json(await Designation.find().sort({ name: 1 }));
});

router.delete("/:id", async (req, res) => {
  await Designation.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;