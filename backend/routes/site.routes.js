const router = require("express").Router();
const Site = require("../models/Site");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const { auth, isAdmin } = require("../middleware/auth");

const MAX_SUB_LEVELS = 4;
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

const formatEmployeeHeadLabel = (employee) => {
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

const resolveHeadNames = async ({
  headEmployeeIds,
  fallbackHeadNames,
  requireAtLeastOne = false,
}) => {
  const employeeIds = parseEmployeeIds(headEmployeeIds);
  const fallbackNames = parseNameList(fallbackHeadNames);

  if (!employeeIds.length) {
    const headNames = fallbackNames;
    if (requireAtLeastOne && !headNames.length) {
      return { error: "Sub site head name is required" };
    }
    return { headNames };
  }

  const employees = await Employee.find(
    { _id: { $in: employeeIds } },
    "employeeCode employeeName"
  );

  if (employees.length !== employeeIds.length) {
    return { error: "One or more selected site heads are invalid" };
  }

  const byId = new Map(employees.map((employee) => [String(employee._id), employee]));
  const employeeHeadNames = employeeIds
    .map((id) => formatEmployeeHeadLabel(byId.get(String(id))))
    .filter(Boolean);
  const headNames = [...employeeHeadNames];
  const seen = new Set(headNames.map((item) => item.toLowerCase()));

  fallbackNames.forEach((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    headNames.push(item);
  });

  if (requireAtLeastOne && !headNames.length) {
    return { error: "Sub site head name is required" };
  }

  return { headNames };
};

const parseNamesPayload = (body = {}) => {
  const hasBulkPayload = Array.isArray(body.names) || typeof body.names === "string";
  const raw =
    Array.isArray(body.names)
      ? body.names
      : typeof body.names === "string"
      ? body.names.split(/[\n,]+/)
      : [body.name];

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

  return { names: unique, hasBulkPayload };
};

const hasDuplicateSubSite = (rows, name, ignoreId = null) =>
  rows.some(
    (item) =>
      item.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      String(item._id) !== String(ignoreId || "")
  );

const findSubSiteNode = (rows = [], subId, level = 1) => {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (String(row._id) === String(subId)) {
      return { node: row, siblings: rows, index: i, level };
    }

    const childMatch = findSubSiteNode(row.children || [], subId, level + 1);
    if (childMatch) return childMatch;
  }

  return null;
};

router.get("/", auth, async (req, res) => {
  try {
    const rows = await Site.find().sort({ companyName: 1, name: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load sites" });
  }
});

router.post("/", auth, isAdmin, async (req, res) => {
  try {
    const companyName = normalizeName(req.body.companyName);
    const { names, hasBulkPayload } = parseNamesPayload(req.body);
    const { headNames, error: headError } = await resolveHeadNames({
      headEmployeeIds: req.body.headEmployeeIds,
      fallbackHeadNames: req.body.headNames,
    });

    if (!companyName) {
      return res.status(400).json({ message: "Company name is required" });
    }

    if (!names.length) {
      return res.status(400).json({ message: "Site name is required" });
    }

    if (hasBulkPayload && names.length > 1) {
      return res.status(400).json({
        message: "Only one site name can be added at a time in Site Master",
      });
    }

    if (headError) {
      return res.status(400).json({ message: headError });
    }

    const companyExists = await Company.exists({ name: companyName });
    if (!companyExists) {
      return res.status(400).json({ message: "Selected company is invalid" });
    }

    const siteName = names[0];
    const existingSite = await Site.findOne({ name: siteName }, "_id");
    if (existingSite) {
      return res.status(409).json({ message: "Site already exists" });
    }

    const created = await Site.create({ companyName, name: siteName, headNames });
    res.status(201).json(created);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Site already exists" });
    }
    res.status(500).json({ message: "Failed to create site" });
  }
});

router.put("/:id", auth, isAdmin, async (req, res) => {
  try {
    const companyName = normalizeName(req.body.companyName);
    const name = normalizeName(req.body.name);
    const { headNames, error: headError } = await resolveHeadNames({
      headEmployeeIds: req.body.headEmployeeIds,
      fallbackHeadNames: req.body.headNames,
    });
    if (!companyName) return res.status(400).json({ message: "Company name is required" });
    if (!name) return res.status(400).json({ message: "Site name is required" });
    if (headError) return res.status(400).json({ message: headError });

    const companyExists = await Company.exists({ name: companyName });
    if (!companyExists) {
      return res.status(400).json({ message: "Selected company is invalid" });
    }

    const updated = await Site.findByIdAndUpdate(
      req.params.id,
      { companyName, name, headNames },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Site not found" });
    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Site already exists" });
    }
    res.status(500).json({ message: "Failed to update site" });
  }
});

router.get("/:id/sub-sites", auth, async (req, res) => {
  try {
    const row = await Site.findById(req.params.id, "subSites");
    if (!row) return res.status(404).json({ message: "Site not found" });

    const { parentId = "" } = req.query;
    if (!parentId) {
      return res.json(row.subSites || []);
    }

    const parent = findSubSiteNode(row.subSites || [], parentId);
    if (!parent) return res.status(404).json({ message: "Sub site not found" });
    res.json(parent.node.children || []);
  } catch (err) {
    res.status(500).json({ message: "Failed to load sub sites" });
  }
});

router.post("/:id/sub-sites", auth, isAdmin, async (req, res) => {
  try {
    const { names, hasBulkPayload } = parseNamesPayload(req.body);
    const { headNames, error: headError } = await resolveHeadNames({
      headEmployeeIds: req.body.headEmployeeIds,
      fallbackHeadNames: req.body.headNames,
      requireAtLeastOne: true,
    });
    if (!names.length) {
      return res.status(400).json({ message: "Sub site name is required" });
    }
    if (headError) {
      return res.status(400).json({ message: headError });
    }

    const row = await Site.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Site not found" });

    const { parentId = "" } = req.body;
    let targetRows = row.subSites || [];
    let parentLevel = 0;

    if (parentId) {
      const parent = findSubSiteNode(row.subSites || [], parentId);
      if (!parent) return res.status(404).json({ message: "Sub site not found" });
      parentLevel = parent.level;
      targetRows = parent.node.children || [];
    }

    if (parentLevel >= MAX_SUB_LEVELS) {
      return res.status(400).json({
        message: `You can only create up to Sub Site Master ${MAX_SUB_LEVELS}`,
      });
    }

    const skipped = [];
    const created = [];

    names.forEach((item) => {
      if (hasDuplicateSubSite(targetRows, item)) {
        skipped.push(item);
        return;
      }
      targetRows.push({ name: item, headNames });
      created.push(targetRows[targetRows.length - 1]);
    });

    if (!created.length) {
      return res.status(409).json({ message: "All sub site names already exist", skipped });
    }

    await row.save();

    if (!hasBulkPayload && created.length === 1 && skipped.length === 0) {
      return res.status(201).json(created[0]);
    }

    res.status(201).json({ created, skipped });
  } catch (err) {
    res.status(500).json({ message: "Failed to create sub site" });
  }
});

router.put("/:id/sub-sites/:subId", auth, isAdmin, async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    const { headNames, error: headError } = await resolveHeadNames({
      headEmployeeIds: req.body.headEmployeeIds,
      fallbackHeadNames: req.body.headNames,
      requireAtLeastOne: true,
    });
    if (!name) return res.status(400).json({ message: "Sub site name is required" });
    if (headError) return res.status(400).json({ message: headError });

    const row = await Site.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Site not found" });

    const sub = findSubSiteNode(row.subSites || [], req.params.subId);
    if (!sub) return res.status(404).json({ message: "Sub site not found" });

    if (hasDuplicateSubSite(sub.siblings || [], name, sub.node._id)) {
      return res.status(409).json({ message: "Sub site already exists at this level" });
    }

    sub.node.name = name;
    sub.node.headNames = headNames;
    await row.save();
    res.json(sub.node);
  } catch (err) {
    res.status(500).json({ message: "Failed to update sub site" });
  }
});

router.delete("/:id/sub-sites/:subId", auth, isAdmin, async (req, res) => {
  try {
    const row = await Site.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Site not found" });

    const sub = findSubSiteNode(row.subSites || [], req.params.subId);
    if (!sub) return res.status(404).json({ message: "Sub site not found" });

    sub.siblings.splice(sub.index, 1);
    await row.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete sub site" });
  }
});

router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const deleted = await Site.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Site not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete site" });
  }
});

module.exports = router;
