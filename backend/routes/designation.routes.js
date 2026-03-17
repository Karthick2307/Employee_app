const router = require("express").Router();
const Designation = require("../models/Designation");
const { auth, isAdmin } = require("../middleware/auth");

router.get("/", auth, async (req, res) => {
  try {
    const rows = await Designation.find().sort({ name: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load designations" });
  }
});

router.post("/", auth, isAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Designation name is required" });

    const data = await Designation.create({ name });
    res.status(201).json(data);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Designation already exists" });
    }
    res.status(500).json({ message: "Failed to create designation" });
  }
});

router.put("/:id", auth, isAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Designation name is required" });

    const updated = await Designation.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Designation not found" });
    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Designation already exists" });
    }
    res.status(500).json({ message: "Failed to update designation" });
  }
});

router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const deleted = await Designation.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Designation not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete designation" });
  }
});

module.exports = router;
