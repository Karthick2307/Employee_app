const router = require("express").Router();
const Company = require("../models/Company");
const Site = require("../models/Site");
const Employee = require("../models/Employee");
const { auth, isAdmin } = require("../middleware/auth");

const normalizeName = (value) => String(value || "").trim();
const parseNameList = (value) => {
  const raw =
    Array.isArray(value)
      ? value
      : String(value || "")
          .split(/[\n,]+/)
          .map((item) => item.trim());

  const unique = [];
  const seen = new Set();

  raw
    .map((item) => normalizeName(item))
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });

  return unique;
};

const formatEmployeeDirectorLabel = (employee) => {
  const code = normalizeName(employee?.employeeCode);
  const name = normalizeName(employee?.employeeName);
  if (code && name) return `${code} - ${name}`;
  return code || name;
};

const parseEmployeeIds = (value) => {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return raw
    .map((item) => normalizeName(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const resolveDirectorNames = async ({ directorEmployeeIds, fallbackDirectorNames }) => {
  const employeeIds = parseEmployeeIds(directorEmployeeIds);
  const fallbackNames = parseNameList(fallbackDirectorNames);

  if (!employeeIds.length) {
    return { directorNames: fallbackNames };
  }

  const employees = await Employee.find(
    { _id: { $in: employeeIds } },
    "employeeCode employeeName"
  );

  if (employees.length !== employeeIds.length) {
    return { error: "One or more selected company directors are invalid" };
  }

  const byId = new Map(employees.map((employee) => [String(employee._id), employee]));
  const employeeDirectorNames = employeeIds
    .map((id) => formatEmployeeDirectorLabel(byId.get(String(id))))
    .filter(Boolean);
  const directorNames = [...employeeDirectorNames];
  const seen = new Set(directorNames.map((item) => item.toLowerCase()));

  fallbackNames.forEach((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    directorNames.push(item);
  });

  return { directorNames };
};

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
    const { directorNames, error: directorError } = await resolveDirectorNames({
      directorEmployeeIds: req.body.directorEmployeeIds,
      fallbackDirectorNames: req.body.directorNames,
    });
    if (!name) return res.status(400).json({ message: "Company name is required" });
    if (directorError) return res.status(400).json({ message: directorError });

    const data = await Company.create({ name, directorNames });
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
    const { directorNames, error: directorError } = await resolveDirectorNames({
      directorEmployeeIds: req.body.directorEmployeeIds,
      fallbackDirectorNames: req.body.directorNames,
    });
    if (!name) return res.status(400).json({ message: "Company name is required" });
    if (directorError) return res.status(400).json({ message: directorError });

    const existing = await Company.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Company not found" });

    const previousName = existing.name;
    existing.name = name;
    existing.directorNames = directorNames;
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
