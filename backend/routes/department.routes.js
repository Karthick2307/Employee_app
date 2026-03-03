const router = require("express").Router();
const Department = require("../models/Department");

router.post("/", async (req, res) => {
  const data = await Department.create({ name: req.body.name });
  res.json(data);
});

router.get("/", async (req, res) => {
  res.json(await Department.find().sort({ name: 1 }));
});

router.delete("/:id", async (req, res) => {
  await Department.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;