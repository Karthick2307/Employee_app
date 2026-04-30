export const formatSiteLabel = (site) => {
  if (!site) return "";

  const companyName = String(site.companyName || "").trim();
  const name = String(site.name || "").trim();

  if (companyName && name) return `${companyName} - ${name}`;
  return name || companyName;
};

export const formatSiteList = (sites = []) =>
  (sites || [])
    .map((site) => formatSiteLabel(site))
    .filter(Boolean)
    .join(", ");
