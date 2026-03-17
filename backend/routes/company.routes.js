const router = require("express").Router();
const Company = require("../models/Company");
const Site = require("../models/Site");
const { auth, isAdmin } = require("../middleware/auth");

const normalizeName = (value) => String(value || "").trim();

router.get("/", auth, async (req, res) => {
  try {
    const rows = await Company.find().sort({ name: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load companies" });
  }
});

router.post("/", auth, isAdmin, async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    if (!name) return res.status(400).json({ message: "Company name is required" });

    const data = await Company.create({ name });
    res.status(201).json(data);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Company already exists" });
    }
    res.status(500).json({ message: "Failed to create company" });
  }
});

router.put("/:id", auth, isAdmin, async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    if (!name) return res.status(400).json({ message: "Company name is required" });

    const existing = await Company.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Company not found" });

    const previousName = existing.name;
    existing.name = name;
    await existing.save();

    if (previousName !== name) {
      await Site.updateMany({ companyName: previousName }, { $set: { companyName: name } });
    }

    res.json(existing);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Company already exists" });
    }
    res.status(500).json({ message: "Failed to update company" });
  }
});

router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const existing = await Company.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Company not found" });

    const inUse = await Site.exists({ companyName: existing.name });
    if (inUse) {
      return res.status(400).json({
        message: "Cannot delete company while it is used in Site Master",
      });
    }

    await existing.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete company" });
  }
});

module.exports = router;
