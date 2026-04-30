const AccessModule = require("../models/AccessModule");
const PermissionAction = require("../models/PermissionAction");
const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");
const {
  ACTION_KEYS,
  ACTION_FIELD_MAP,
  ACTION_LABELS,
  MODULE_CATALOG,
  SYSTEM_ROLES,
  buildAllDeniedPermissions,
} = require("../config/permissions");

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const normalizePermissionFlags = (value = {}) =>
  Object.values(ACTION_FIELD_MAP).reduce((result, fieldKey) => {
    result[fieldKey] = Boolean(value?.[fieldKey]);
    return result;
  }, {});

const buildEmptyPermissionFlags = () => normalizePermissionFlags(buildAllDeniedPermissions());

const getModuleCatalog = () => [...MODULE_CATALOG].sort((left, right) => left.order - right.order);

const getModuleConfigByKey = (moduleKey) =>
  getModuleCatalog().find((moduleItem) => moduleItem.key === normalizeKey(moduleKey)) || null;

const getSystemRoleConfigByKey = (roleKey) =>
  SYSTEM_ROLES.find((role) => role.key === normalizeKey(roleKey)) || null;

const syncPermissionSeed = async () => {
  await Promise.all(
    ACTION_KEYS.map((actionKey, index) =>
      PermissionAction.updateOne(
        { key: actionKey },
        {
          $set: {
            label: ACTION_LABELS[actionKey],
            order: index + 1,
            isSystem: true,
          },
        },
        { upsert: true }
      )
    )
  );

  await Promise.all(
    MODULE_CATALOG.map((moduleItem) =>
      AccessModule.updateOne(
        { key: moduleItem.key },
        {
          $set: {
            name: moduleItem.name,
            description: moduleItem.description,
            category: moduleItem.category,
            routePath: moduleItem.routePath || "",
            order: moduleItem.order,
            isNavigable: moduleItem.isNavigable !== false,
            showInNavbar: moduleItem.showInNavbar !== false,
            showOnDashboard: moduleItem.showOnDashboard !== false,
          },
        },
        { upsert: true }
      )
    )
  );

  for (const roleConfig of SYSTEM_ROLES) {
    await Role.updateOne(
      { key: roleConfig.key },
      {
        $set: {
          name: roleConfig.name,
          description: roleConfig.description,
          isSystem: roleConfig.isSystem !== false,
          dashboardType: roleConfig.dashboardType || "generic",
          scopeStrategy: roleConfig.scopeStrategy || "mapped",
          homeModuleKey: roleConfig.homeModuleKey || "dashboard",
          isActive: true,
        },
      },
      { upsert: true }
    );
  }

  const systemRoles = await Role.find({
    key: { $in: SYSTEM_ROLES.map((roleConfig) => roleConfig.key) },
  }).lean();
  const systemRoleByKey = new Map(systemRoles.map((role) => [role.key, role]));

  for (const roleConfig of SYSTEM_ROLES) {
    const roleRecord = systemRoleByKey.get(roleConfig.key);
    if (!roleRecord) continue;

    for (const moduleItem of MODULE_CATALOG) {
      const existingRow = await RolePermission.exists({
        roleId: roleRecord._id,
        moduleKey: moduleItem.key,
      });

      if (existingRow) continue;

      await RolePermission.create({
        roleId: roleRecord._id,
        moduleKey: moduleItem.key,
        ...normalizePermissionFlags(roleConfig.defaultPermissions?.[moduleItem.key]),
        isActive: true,
      });
    }
  }
};

module.exports = {
  ACTION_KEYS,
  ACTION_FIELD_MAP,
  ACTION_LABELS,
  SYSTEM_ROLES,
  buildEmptyPermissionFlags,
  getModuleCatalog,
  getModuleConfigByKey,
  getSystemRoleConfigByKey,
  normalizePermissionFlags,
  syncPermissionSeed,
};
