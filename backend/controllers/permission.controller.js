const AccessModule = require("../models/AccessModule");
const Company = require("../models/Company");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const PermissionAction = require("../models/PermissionAction");
const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");
const Site = require("../models/Site");
const User = require("../models/User");
const UserPermission = require("../models/UserPermission");
const {
  ACTION_FIELD_MAP,
  buildEmptyPermissionFlags,
  getModuleCatalog,
  normalizePermissionFlags,
} = require("../services/permissionCatalog.service");
const {
  buildSessionUserPayload,
  resolvePrincipalAccess,
} = require("../services/permissionResolver.service");

const normalizeId = (value) => String(value?._id || value || "").trim();
const normalizeText = (value) => String(value || "").trim();
const uniqueIdList = (value) => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawValues
    .map((item) => normalizeId(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const serializePermissionRow = (permissionRow = {}) => ({
  moduleKey: normalizeText(permissionRow.moduleKey).toLowerCase(),
  ...normalizePermissionFlags(permissionRow),
  isActive: permissionRow.isActive !== false,
});

const getPrincipalModel = (principalType) => (principalType === "employee" ? Employee : User);

const loadPrincipalForAccess = async (principalType, principalId) => {
  const PrincipalModel = getPrincipalModel(principalType);
  const query = PrincipalModel.findById(principalId);

  if (principalType === "user") {
    query.populate("site", "name companyName");
  }

  return query.lean();
};

const buildRolePermissionRows = (roleId, rows = []) =>
  rows.map((row) => ({
    roleId,
    ...serializePermissionRow(row),
  }));

const buildPrincipalOverrideRows = (principalType, principalId, rows = []) =>
  rows.map((row) => ({
    principalType,
    principalId,
    ...serializePermissionRow(row),
  }));

const getRolePermissionMap = (rows = []) =>
  rows.reduce((result, row) => {
    result[normalizeText(row.moduleKey).toLowerCase()] = normalizePermissionFlags(row);
    return result;
  }, {});

const permissionsEqual = (left = {}, right = {}) =>
  Object.values(ACTION_FIELD_MAP).every((fieldKey) => Boolean(left?.[fieldKey]) === Boolean(right?.[fieldKey]));

exports.getCurrentPermissionProfile = async (req, res) => {
  try {
    const principalType = req.user?.principalType || "user";
    const principal = await loadPrincipalForAccess(principalType, req.user?.id);

    if (!principal) {
      return res.status(404).json({ message: "Signed-in account was not found" });
    }

    const access = await resolvePrincipalAccess({ principalType, principal });

    return res.json({
      user: buildSessionUserPayload({ principalType, principal, access }),
      role: access.role,
      modules: access.modules,
      permissions: access.permissions,
      scope: access.scope,
      homePath: access.homePath,
    });
  } catch (err) {
    console.error("GET CURRENT PERMISSION PROFILE ERROR:", err);
    return res.status(500).json({ message: "Failed to load current permission profile" });
  }
};

exports.getPermissionSetup = async (req, res) => {
  try {
    const [
      modules,
      actions,
      roles,
      rolePermissions,
      overrides,
      users,
      employees,
      companies,
      sites,
      departments,
    ] = await Promise.all([
      AccessModule.find({}).sort({ order: 1 }).lean(),
      PermissionAction.find({}).sort({ order: 1 }).lean(),
      Role.find({}).sort({ name: 1 }).lean(),
      RolePermission.find({}).lean(),
      UserPermission.find({}).lean(),
      User.find({}, "name email role roleId site accessScopeStrategy accessCompanyIds accessSiteIds accessDepartmentIds accessSubDepartmentIds accessEmployeeIds isDefaultAdmin")
        .populate("site", "name companyName")
        .lean(),
      Employee.find({}, "employeeCode employeeName email roleId accessScopeStrategy accessCompanyIds accessSiteIds accessDepartmentIds accessSubDepartmentIds accessEmployeeIds sites department")
        .lean(),
      Company.find({}, "name").sort({ name: 1 }).lean(),
      Site.find({}, "name companyName").sort({ companyName: 1, name: 1 }).lean(),
      Department.find({}, "name subDepartments").sort({ name: 1 }).lean(),
    ]);

    return res.json({
      modules: modules.length ? modules : getModuleCatalog(),
      actions,
      roles,
      rolePermissions,
      overrides,
      users,
      employees,
      companies,
      sites,
      departments,
    });
  } catch (err) {
    console.error("GET PERMISSION SETUP ERROR:", err);
    return res.status(500).json({ message: "Failed to load permission setup data" });
  }
};

exports.createRole = async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const key = normalizeText(req.body?.key)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    if (!key) {
      return res.status(400).json({ message: "Role key is required" });
    }

    const role = await Role.create({
      key,
      name,
      description: normalizeText(req.body?.description),
      dashboardType: normalizeText(req.body?.dashboardType) || "generic",
      scopeStrategy: normalizeText(req.body?.scopeStrategy) || "mapped",
      homeModuleKey: normalizeText(req.body?.homeModuleKey) || "dashboard",
      isSystem: false,
      isActive: true,
    });

    const moduleRows = getModuleCatalog().map((moduleItem) => ({
      roleId: role._id,
      moduleKey: moduleItem.key,
      ...buildEmptyPermissionFlags(),
      isActive: true,
    }));

    if (moduleRows.length) {
      await RolePermission.insertMany(moduleRows);
    }

    return res.status(201).json(role);
  } catch (err) {
    console.error("CREATE ROLE ERROR:", err);
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Role key already exists" });
    }
    return res.status(500).json({ message: "Failed to create role" });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    role.name = normalizeText(req.body?.name) || role.name;
    role.description = normalizeText(req.body?.description);
    role.dashboardType = normalizeText(req.body?.dashboardType) || role.dashboardType;
    role.scopeStrategy = normalizeText(req.body?.scopeStrategy) || role.scopeStrategy;
    role.homeModuleKey = normalizeText(req.body?.homeModuleKey) || role.homeModuleKey;
    role.isActive = req.body?.isActive !== false;

    await role.save();

    return res.json(role);
  } catch (err) {
    console.error("UPDATE ROLE ERROR:", err);
    return res.status(500).json({ message: "Failed to update role" });
  }
};

exports.saveRolePermissions = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).lean();

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const nextRows = buildRolePermissionRows(role._id, rows);

    await Promise.all(
      nextRows.map((row) =>
        RolePermission.updateOne(
          { roleId: row.roleId, moduleKey: row.moduleKey },
          { $set: row },
          { upsert: true }
        )
      )
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("SAVE ROLE PERMISSIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to save role permissions" });
  }
};

exports.savePrincipalAccess = async (req, res) => {
  try {
    const principalType = normalizeText(req.params.principalType).toLowerCase();
    if (!["user", "employee"].includes(principalType)) {
      return res.status(400).json({ message: "Principal type is invalid" });
    }

    const PrincipalModel = getPrincipalModel(principalType);
    const principal = await PrincipalModel.findById(req.params.principalId);

    if (!principal) {
      return res.status(404).json({ message: "Selected person was not found" });
    }

    principal.roleId = normalizeId(req.body?.roleId) || null;
    principal.accessScopeStrategy =
      normalizeText(req.body?.accessScopeStrategy).toLowerCase() || "inherit";
    principal.accessCompanyIds = uniqueIdList(req.body?.accessCompanyIds);
    principal.accessSiteIds = uniqueIdList(req.body?.accessSiteIds);
    principal.accessDepartmentIds = uniqueIdList(req.body?.accessDepartmentIds);
    principal.accessSubDepartmentIds = uniqueIdList(req.body?.accessSubDepartmentIds);
    principal.accessEmployeeIds = uniqueIdList(req.body?.accessEmployeeIds);

    await principal.save();

    return res.json({ success: true });
  } catch (err) {
    console.error("SAVE PRINCIPAL ACCESS ERROR:", err);
    return res.status(500).json({ message: "Failed to save person access mapping" });
  }
};

exports.savePrincipalOverrides = async (req, res) => {
  try {
    const principalType = normalizeText(req.params.principalType).toLowerCase();
    if (!["user", "employee"].includes(principalType)) {
      return res.status(400).json({ message: "Principal type is invalid" });
    }

    const principalId = normalizeId(req.params.principalId);
    const principal = await loadPrincipalForAccess(principalType, principalId);

    if (!principal) {
      return res.status(404).json({ message: "Selected person was not found" });
    }

    const access = await resolvePrincipalAccess({ principalType, principal });
    const rolePermissionRows = access.role?._id
      ? await RolePermission.find({ roleId: access.role._id }).lean()
      : [];
    const rolePermissionMap = getRolePermissionMap(rolePermissionRows);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const incomingRows = buildPrincipalOverrideRows(principalType, principalId, rows);
    const rowsToPersist = incomingRows.filter((row) => {
      const roleDefaults = rolePermissionMap[row.moduleKey] || buildEmptyPermissionFlags();
      return !permissionsEqual(row, roleDefaults);
    });
    const nextModuleKeys = rowsToPersist.map((row) => row.moduleKey);

    await UserPermission.deleteMany({
      principalType,
      principalId,
      ...(nextModuleKeys.length ? { moduleKey: { $nin: nextModuleKeys } } : {}),
    });

    await Promise.all(
      rowsToPersist.map((row) =>
        UserPermission.updateOne(
          {
            principalType: row.principalType,
            principalId: row.principalId,
            moduleKey: row.moduleKey,
          },
          { $set: row },
          { upsert: true }
        )
      )
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("SAVE PRINCIPAL OVERRIDES ERROR:", err);
    return res.status(500).json({ message: "Failed to save permission overrides" });
  }
};
