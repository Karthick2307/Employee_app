const Site = require("../models/Site");
const createChatModuleService = require("./createChatModule.service");

const formatSiteDisplayName = (site) => {
  const companyName = String(site?.companyName || "").trim();
  const siteName = String(site?.name || "").trim();

  if (companyName && siteName) {
    return `${companyName} - ${siteName}`;
  }

  return siteName || companyName || "Site";
};

const formatSiteGroupName = (site) => {
  const siteName = String(site?.name || "").trim() || "Site";
  return `${siteName} Site Chat`;
};

module.exports = createChatModuleService({
  chatType: "site",
  emptyScopeLabel: "Site",
  emptyChatLabel: "Site Chat",
  employeeScopeField: "sites",
  viewerEmployeeProjection: "employeeCode employeeName email sites",
  getAllActiveScopes: () =>
    Site.find({ isActive: { $ne: false } })
      .sort({ companyName: 1, name: 1 })
      .lean(),
  getScopeOwnerNames: (site) => [...(site?.headNames || []), ...(site?.siteLeadNames || [])],
  getScopeSearchTerms: (site) => [
    site?.name,
    site?.companyName,
    formatSiteDisplayName(site),
  ],
  formatScopeDisplayName: formatSiteDisplayName,
  formatGroupName: formatSiteGroupName,
  buildScopeSummary: (site) => ({
    siteId: String(site?._id || "").trim(),
    siteName: String(site?.name || "").trim(),
    companyName: String(site?.companyName || "").trim(),
    siteDisplayName: formatSiteDisplayName(site),
  }),
});
