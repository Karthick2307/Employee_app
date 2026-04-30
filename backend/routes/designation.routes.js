const router = require("express").Router();
const Designation = require("../models/Designation");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

router.get("/", auth, requirePermission("designation_master", "view"), async (req, res) => {
  try {
    const rows = await Designation.find({ isActive: { $ne: false } }).sort({ name: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load designations" });
  }
});

router.post("/", auth, requirePermission("designation_master", "add"), async (req, res) => {
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

router.put("/:id", auth, requirePermission("designation_master", "edit"), async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Designation name is required" });

    const updated = await Designation.findOneAndUpdate(
      { _id: req.params.id, isActive: { $ne: false } },
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

router.delete("/:id", auth, requirePermission("designation_master", "delete"), async (req, res) => {
  try {
    const designation = await Designation.findOne({
      _id: req.params.id,
      isActive: { $ne: false },
    });
    if (!designation) return res.status(404).json({ message: "Designation not found" });

    designation.isActive = false;
    await designation.save();
    res.json({ success: true, isActive: false });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete designation" });
  }
});

module.exports = router;
