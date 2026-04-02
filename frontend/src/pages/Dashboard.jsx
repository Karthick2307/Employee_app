import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import DashboardFeedbackWidget from "../components/DashboardFeedbackWidget";
import {
  formatChecklistTaskStatus,
  formatDate,
  formatDateTime,
  formatMarkValue,
  formatTimelinessLabel,
  getChecklistTaskStatusBadgeClass,
  getTimelinessBadgeClass,
} from "../utils/checklistDisplay";

const emptyDrilldownData = {
  companies: [],
  levelSummaries: {
    companies: [],
    sites: [],
    departments: [],
    subDepartments: [],
    employees: [],
  },
  selectedCompany: null,
  siteLeads: [],
  selectedSiteLead: null,
  sites: [],
  selectedSite: null,
  departmentLeads: [],
  selectedDepartmentLead: null,
  departments: [],
  selectedDepartment: null,
  subDepartments: [],
  selectedSubDepartment: null,
  employees: [],
  selectedEmployee: null,
  completedTasks: [],
  markSummary: {
    company: null,
    siteLead: null,
    site: null,
    departmentLead: null,
    department: null,
    subDepartment: null,
    employee: null,
  },
};

const getDashboardSectionKeyFromTitle = (title) => {
  const normalizedTitle = String(title || "")
    .trim()
    .toLowerCase()
    .replace(/^\d+\.\s*/, "");

  if (!normalizedTitle) return "";
  if (normalizedTitle.startsWith("selected company") || normalizedTitle.startsWith("company")) {
    return "company";
  }
  if (normalizedTitle.startsWith("site lead")) return "siteLead";
  if (normalizedTitle.startsWith("department lead")) return "departmentLead";
  if (normalizedTitle.startsWith("sub department")) return "subDepartment";
  if (normalizedTitle.startsWith("site")) return "site";
  if (normalizedTitle.startsWith("department")) return "department";
  if (normalizedTitle.startsWith("employees")) return "employee";
  if (
    normalizedTitle.includes("checklist details") ||
    normalizedTitle.includes("employee overall mark")
  ) {
    return "mark";
  }
  if (normalizedTitle.includes("mark split-up")) return "completedTasks";

  return "";
};

const DASHBOARD_LEVEL_MENU = [
  {
    key: "companies",
    label: "Companies",
    eyebrow: "Company View",
    title: "Companies",
    subtitle:
      "Show company overall mark with site, department, sub department, and employee totals.",
    emptyMessage: "No companies are available in your scope.",
  },
  {
    key: "sites",
    label: "Sites",
    eyebrow: "Site View",
    title: "Sites",
    subtitle:
      "Show site overall mark with department, sub department, and employee totals.",
    emptyMessage: "No sites are available in your scope.",
  },
  {
    key: "departments",
    label: "Departments",
    eyebrow: "Department View",
    title: "Departments",
    subtitle: "Show department overall mark with sub department and employee totals.",
    emptyMessage: "No departments are available in your scope.",
  },
  {
    key: "subDepartments",
    label: "Sub Departments",
    eyebrow: "Sub Department View",
    title: "Sub Departments",
    subtitle: "Show sub department overall mark with employee totals.",
    emptyMessage: "No sub departments are available in your scope.",
  },
  {
    key: "employees",
    label: "Employees",
    eyebrow: "Employee View",
    title: "Employees",
    subtitle: "Show employee overall mark with checklist totals and assignment details.",
    emptyMessage: "No employees are available in your scope.",
  },
];

const buildDashboardLevelCardContent = (levelKey, item = {}) => {
  const safeTitle =
    item.name || item.employeeName || item.employeeCode || item.departmentDisplay || "-";

  switch (levelKey) {
    case "companies":
      return {
        title: safeTitle,
        metrics: [
          { label: "Overall Mark", value: item.overallMark, kind: "mark" },
          { label: "Sites", value: item.siteCount || 0 },
          { label: "Departments", value: item.departmentCount || 0 },
          { label: "Sub Departments", value: item.subDepartmentCount || 0 },
          { label: "Employees", value: item.employeeCount || 0 },
        ],
        details: [],
      };
    case "sites":
      return {
        title: safeTitle,
        metrics: [
          { label: "Overall Mark", value: item.overallMark, kind: "mark" },
          { label: "Departments", value: item.departmentCount || 0 },
          { label: "Sub Departments", value: item.subDepartmentCount || 0 },
          { label: "Employees", value: item.employeeCount || 0 },
        ],
        details: item.companyName ? [`Company: ${item.companyName}`] : [],
      };
    case "departments":
      return {
        title: safeTitle,
        metrics: [
          { label: "Overall Mark", value: item.overallMark, kind: "mark" },
          { label: "Sub Departments", value: item.subDepartmentCount || 0 },
          { label: "Employees", value: item.employeeCount || 0 },
          { label: "Scored Checklists", value: item.scoredChecklistCount || 0 },
        ],
        details: [],
      };
    case "subDepartments":
      return {
        title: safeTitle,
        metrics: [
          { label: "Overall Mark", value: item.overallMark, kind: "mark" },
          { label: "Employees", value: item.employeeCount || 0 },
          { label: "Scored Checklists", value: item.scoredChecklistCount || 0 },
        ],
        details: item.departmentName ? [`Department: ${item.departmentName}`] : [],
      };
    case "employees":
      return {
        title: safeTitle,
        metrics: [
          { label: "Overall Mark", value: item.overallMark, kind: "mark" },
          { label: "Scored Checklists", value: item.scoredChecklistCount || 0 },
        ],
        details: [
          item.employeeCode ? `Employee Code: ${item.employeeCode}` : "",
          item.departmentDisplay ? `Department: ${item.departmentDisplay}` : "",
          item.subDepartmentDisplay ? `Sub Department: ${item.subDepartmentDisplay}` : "",
          `Status: ${item.isActive === false ? "Inactive" : "Active"}`,
        ].filter(Boolean),
      };
    default:
      return {
        title: safeTitle,
        metrics: [
          { label: "Overall Mark", value: item.overallMark, kind: "mark" },
          { label: "Employees", value: item.employeeCount || 0 },
        ],
        details: [],
      };
  }
};

export default function Dashboard({
  pageTitle = "Dashboard",
  showStatCards = true,
  drilldownVariant = "department",
  markHierarchySource = "employee",
  fullWidth = false,
  drilldownLayout = "stacked",
  showDrilldownCardMarks = false,
  showSiteLeadStep = false,
  showDepartmentLeadStep = false,
  companyOverviewOnly = false,
  hideCompanyStep = false,
  companyDetailPath = "",
  companyOverviewPath = "",
  useRouteCompanyId = false,
  showEmployeeOverallSection = true,
  showCompletedTaskCard = false,
  employeeDetailMode = "mark",
}) {
  const navigate = useNavigate();
  const params = useParams();
  const routeCompanyId = useMemo(() => {
    if (!useRouteCompanyId) return "";

    const rawValue = String(params.companyId || "");

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }, [params.companyId, useRouteCompanyId]);
  const [data, setData] = useState(null);
  const [drilldownData, setDrilldownData] = useState(emptyDrilldownData);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [photoErrors, setPhotoErrors] = useState({});
  const [selectedCompanyId, setSelectedCompanyId] = useState(routeCompanyId);
  const [selectedSidebarLevel, setSelectedSidebarLevel] = useState("companies");
  const [selectedSiteLeadId, setSelectedSiteLeadId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedDepartmentLeadId, setSelectedDepartmentLeadId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedSubDepartmentId, setSelectedSubDepartmentId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [pendingScrollIntent, setPendingScrollIntent] = useState("");
  const [showEmployeeMarksSection, setShowEmployeeMarksSection] = useState(false);
  const [expandedEmployeeMarkIds, setExpandedEmployeeMarkIds] = useState(() => new Set());
  const uploadBaseUrl = useMemo(
    () => (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, ""),
    []
  );
  const employeeMarkIds = useMemo(
    () => (data?.employeeOverallMarks || []).map((employee) => String(employee._id)),
    [data?.employeeOverallMarks]
  );
  const isCompanySiteDrilldown = drilldownVariant === "company-site";
  const isColumnDrilldownLayout = drilldownLayout === "columns";
  const showEmployeeChecklistCards = employeeDetailMode === "checklists";
  const showLevelSidebarSummary = companyOverviewOnly && isCompanySiteDrilldown;

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    loadDrilldown();
  }, [
    drilldownVariant,
    markHierarchySource,
    selectedCompanyId,
    selectedSiteLeadId,
    selectedSiteId,
    selectedDepartmentLeadId,
    selectedDepartmentId,
    selectedSubDepartmentId,
    selectedEmployeeId,
  ]);

  useEffect(() => {
    if (!useRouteCompanyId) return;

    setSelectedCompanyId(routeCompanyId);
    setSelectedSiteLeadId("");
    setSelectedSiteId("");
    setSelectedDepartmentLeadId("");
    setSelectedDepartmentId("");
    setSelectedSubDepartmentId("");
    setSelectedEmployeeId("");
    setPendingScrollIntent("");
  }, [routeCompanyId, useRouteCompanyId]);

  const loadDashboard = async () => {
    try {
      const res = await api.get("/dashboard");
      setData(res.data);
      setPhotoErrors({});
    } catch (err) {
      console.error("Dashboard load failed", err);
    }
  };

  const loadDrilldown = async () => {
    setDrilldownLoading(true);

    try {
      const endpoint = isCompanySiteDrilldown
        ? "/dashboard/company-site-marks/drilldown"
        : "/dashboard/employee-marks/drilldown";
      const params = isCompanySiteDrilldown
        ? {
            companyId: selectedCompanyId || undefined,
            siteLeadId: selectedSiteLeadId || undefined,
            siteId: selectedSiteId || undefined,
            departmentLeadId: selectedDepartmentLeadId || undefined,
            departmentId: selectedDepartmentId || undefined,
            subDepartmentId: selectedSubDepartmentId || undefined,
            employeeId: selectedEmployeeId || undefined,
            hierarchySource:
              markHierarchySource && markHierarchySource !== "employee"
                ? markHierarchySource
                : undefined,
          }
        : {
            departmentId: selectedDepartmentId || undefined,
            subDepartmentId: selectedSubDepartmentId || undefined,
            employeeId: selectedEmployeeId || undefined,
          };

      const res = await api.get(endpoint, {
        params: {
          ...params,
        },
      });
      setDrilldownData({ ...emptyDrilldownData, ...(res.data || {}) });
    } catch (err) {
      console.error("Dashboard drilldown load failed", err);
      setDrilldownData(emptyDrilldownData);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const selectCompany = (companyId) => {
    if (companyOverviewOnly && companyDetailPath) {
      navigate(`${companyDetailPath}/${encodeURIComponent(String(companyId || ""))}`);
      return;
    }

    const nextValue = String(selectedCompanyId) === String(companyId) ? "" : String(companyId);

    setSelectedCompanyId(nextValue);
    setSelectedSiteLeadId("");
    setSelectedSiteId("");
    setSelectedDepartmentLeadId("");
    setSelectedDepartmentId("");
    setSelectedSubDepartmentId("");
    setSelectedEmployeeId("");
    setPendingScrollIntent(nextValue ? "afterCompany" : "");
  };

  const selectSiteLead = (siteLeadId) => {
    const nextValue = String(selectedSiteLeadId) === String(siteLeadId) ? "" : String(siteLeadId);

    setSelectedSiteLeadId(nextValue);
    setSelectedSiteId("");
    setSelectedDepartmentLeadId("");
    setSelectedDepartmentId("");
    setSelectedSubDepartmentId("");
    setSelectedEmployeeId("");
    setPendingScrollIntent(nextValue ? "afterSiteLead" : "");
  };

  const selectSite = (siteId) => {
    const nextValue = String(selectedSiteId) === String(siteId) ? "" : String(siteId);

    setSelectedSiteId(nextValue);
    setSelectedDepartmentLeadId("");
    setSelectedDepartmentId("");
    setSelectedSubDepartmentId("");
    setSelectedEmployeeId("");
    setPendingScrollIntent(nextValue ? "afterSite" : "");
  };

  const selectDepartmentLead = (departmentLeadId) => {
    const nextValue =
      String(selectedDepartmentLeadId) === String(departmentLeadId)
        ? ""
        : String(departmentLeadId);

    setSelectedDepartmentLeadId(nextValue);
    setSelectedDepartmentId("");
    setSelectedSubDepartmentId("");
    setSelectedEmployeeId("");
    setPendingScrollIntent(nextValue ? "afterDepartmentLead" : "");
  };

  const selectDepartment = (departmentId) => {
    const nextValue =
      String(selectedDepartmentId) === String(departmentId) ? "" : String(departmentId);

    setSelectedDepartmentId(nextValue);
    setSelectedSubDepartmentId("");
    setSelectedEmployeeId("");
    setPendingScrollIntent(nextValue ? "afterDepartment" : "");
  };

  const selectSubDepartment = (subDepartmentId) => {
    const nextValue =
      String(selectedSubDepartmentId) === String(subDepartmentId)
        ? ""
        : String(subDepartmentId);

    setSelectedSubDepartmentId(nextValue);
    setSelectedEmployeeId("");
    setPendingScrollIntent(nextValue ? "afterSubDepartment" : "");
  };

  const selectEmployee = (employeeId) => {
    const nextValue =
      String(selectedEmployeeId) === String(employeeId) ? "" : String(employeeId);

    setSelectedEmployeeId(nextValue);
    setPendingScrollIntent(nextValue ? "afterEmployee" : "");
  };

  const resetDrilldown = () => {
    if (useRouteCompanyId && companyOverviewPath) {
      navigate(companyOverviewPath);
      return;
    }

    setSelectedSidebarLevel("companies");
    setSelectedCompanyId("");
    setSelectedSiteLeadId("");
    setSelectedSiteId("");
    setSelectedDepartmentLeadId("");
    setSelectedDepartmentId("");
    setSelectedSubDepartmentId("");
    setSelectedEmployeeId("");
    setPendingScrollIntent("");
  };

  const toggleEmployeeMark = (employeeId) => {
    const normalizedId = String(employeeId || "");

    setExpandedEmployeeMarkIds((currentValue) => {
      const nextValue = new Set(currentValue);

      if (nextValue.has(normalizedId)) {
        nextValue.delete(normalizedId);
      } else {
        nextValue.add(normalizedId);
      }

      return nextValue;
    });
  };

  const expandAllEmployeeMarks = () => {
    setExpandedEmployeeMarkIds(new Set(employeeMarkIds));
  };

  const collapseAllEmployeeMarks = () => {
    setExpandedEmployeeMarkIds(new Set());
  };

  const toggleEmployeeMarksSection = () => {
    setShowEmployeeMarksSection((currentValue) => {
      if (currentValue) {
        setExpandedEmployeeMarkIds(new Set());
      }

      return !currentValue;
    });
  };

  const areAllEmployeeMarksExpanded =
    employeeMarkIds.length > 0 &&
    employeeMarkIds.every((employeeId) => expandedEmployeeMarkIds.has(employeeId));
  const employeeDetailStepLabel = showEmployeeChecklistCards
    ? "Checklist Details"
    : "Employee Overall Mark";
  const hasAvailableSiteLeadStep =
    showSiteLeadStep &&
    (!drilldownData.selectedCompany || Number(drilldownData.siteLeads?.length || 0) > 0);
  const hasAvailableDepartmentLeadStep =
    showDepartmentLeadStep &&
    (!drilldownData.selectedSite || Number(drilldownData.departmentLeads?.length || 0) > 0);
  const siteStageSelectionOwner = hasAvailableSiteLeadStep
    ? drilldownData.selectedSiteLead
    : drilldownData.selectedCompany;
  const departmentStageSelectionOwner = hasAvailableDepartmentLeadStep
    ? drilldownData.selectedDepartmentLead
    : drilldownData.selectedSite;
  const pageSubtitle = showLevelSidebarSummary
    ? "Switch between company, site, department, sub department, and employee summaries from the left sidebar, then open a company to continue the drilldown."
    : isCompanySiteDrilldown
    ? hasAvailableSiteLeadStep
      ? hasAvailableDepartmentLeadStep
        ? "Move from company to site leads, then sites, then department leads, and continue through departments, employees, and checklist details."
        : "Move from company to site leads, then continue through sites, departments, employees, and checklist details."
      : "Move from company to employee and review marks or checklist details at each step."
    : "Filter by department and sub department to review employee performance.";
  const companySiteBaseStep = hideCompanyStep ? 1 : 2;
  const companySiteSiteLeadStep = companySiteBaseStep;
  const companySiteSiteStep = companySiteBaseStep + (hasAvailableSiteLeadStep ? 1 : 0);
  const companySiteDepartmentLeadStep =
    companySiteSiteStep + (hasAvailableDepartmentLeadStep ? 1 : 0);
  const companySiteDepartmentStep = companySiteDepartmentLeadStep + 1;
  const companySiteSubDepartmentStep = companySiteDepartmentStep + 1;
  const companySiteEmployeeStep = companySiteSubDepartmentStep + 1;
  const companySiteMarkStep = companySiteEmployeeStep + 1;
  const companySiteCompletedTasksStep = companySiteMarkStep + 1;
  const companySiteStepTitles = {
    company: "1. Companies",
    siteLead: hasAvailableSiteLeadStep ? `${companySiteSiteLeadStep}. Site Leads` : "",
    site: `${companySiteSiteStep}. Sites`,
    departmentLead: hasAvailableDepartmentLeadStep
      ? `${companySiteDepartmentLeadStep}. Department Leads`
      : "",
    department: `${companySiteDepartmentStep}. Departments`,
    subDepartment: `${companySiteSubDepartmentStep}. Sub Departments`,
    employee: `${companySiteEmployeeStep}. Employees`,
    mark: `${companySiteMarkStep}. ${employeeDetailStepLabel}`,
    completedTasks: `${companySiteCompletedTasksStep}. Mark Split-up`,
  };
  const buildEmployeeCountText = (value) =>
    `${value || 0} employee${Number(value || 0) === 1 ? "" : "s"}`;
  const sidebarLevelConfig =
    DASHBOARD_LEVEL_MENU.find((item) => item.key === selectedSidebarLevel) ||
    DASHBOARD_LEVEL_MENU[0];
  const sidebarLevelSummaries = drilldownData.levelSummaries || emptyDrilldownData.levelSummaries;
  const selectedSidebarRows = Array.isArray(sidebarLevelSummaries?.[selectedSidebarLevel])
    ? sidebarLevelSummaries[selectedSidebarLevel]
    : [];
  const selectedSidebarEntityLabel = String(sidebarLevelConfig?.label || "Items")
    .trim()
    .toLowerCase();

  useEffect(() => {
    if (!pendingScrollIntent || drilldownLoading || typeof document === "undefined") {
      return;
    }

    const resolveNextSectionKey = () => {
      switch (pendingScrollIntent) {
        case "afterCompany":
          return isCompanySiteDrilldown
            ? hasAvailableSiteLeadStep
              ? "siteLead"
              : "site"
            : "department";
        case "afterSiteLead":
          return "site";
        case "afterSite":
          return hasAvailableDepartmentLeadStep ? "departmentLead" : "department";
        case "afterDepartmentLead":
          return "department";
        case "afterDepartment":
          return Number(drilldownData.subDepartments?.length || 0) > 0
            ? "subDepartment"
            : "employee";
        case "afterSubDepartment":
          return "employee";
        case "afterEmployee":
          return "mark";
        default:
          return "";
      }
    };

    const nextSectionKey = resolveNextSectionKey();

    if (!nextSectionKey) {
      setPendingScrollIntent("");
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      const nextSection = document.querySelector(
        `[data-dashboard-section="${nextSectionKey}"]`
      );

      if (nextSection) {
        const sectionBounds = nextSection.getBoundingClientRect();
        const topSafeZone = 96;
        const bottomSafeZone = window.innerHeight - 60;
        const isComfortablyVisible =
          sectionBounds.top >= topSafeZone && sectionBounds.bottom <= bottomSafeZone;

        if (!isComfortablyVisible) {
          nextSection.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }

      setPendingScrollIntent("");
    }, 120);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [
    drilldownData.subDepartments,
    drilldownLoading,
    hasAvailableDepartmentLeadStep,
    hasAvailableSiteLeadStep,
    isCompanySiteDrilldown,
    pendingScrollIntent,
  ]);

  if (!data) return <p className="m-4">Loading...</p>;

  const renderSelectedEmployeeDetailContent = ({
    noEmployeeMessage,
    noChecklistMessage,
  }) => {
    if (!drilldownData.selectedEmployee) {
      return <EmptySelection message={noEmployeeMessage} />;
    }

    return (
      <div>
        <div className="small text-muted mb-2">
          {drilldownData.selectedEmployee.employeeCode || "No employee code"}
        </div>

        {showEmployeeChecklistCards ? (
          <EmployeeChecklistCardGrid
            tasks={drilldownData.completedTasks}
            emptyMessage={noChecklistMessage}
          />
        ) : (
          <EmployeeMarkCard
            employee={drilldownData.selectedEmployee}
            photoError={photoErrors[drilldownData.selectedEmployee._id]}
            uploadBaseUrl={uploadBaseUrl}
            onPhotoError={() =>
              setPhotoErrors((prev) => ({
                ...prev,
                [drilldownData.selectedEmployee._id]: true,
              }))
            }
          />
        )}
      </div>
    );
  };

  return (
    <div
      className={`dashboard-shell ${fullWidth ? "container-fluid px-4" : "container"} mt-4 mb-5`}
    >
      <div className="page-intro-card mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div className="page-kicker">Dashboard</div>
            <h4 className="mb-1">{pageTitle}</h4>
            <p className="page-subtitle mb-0">{pageSubtitle}</p>
          </div>

          <span className="summary-chip">
            {isCompanySiteDrilldown ? "Company to employee view" : "Department view"}
          </span>
        </div>
      </div>

      {showStatCards ? (
        <div className="row g-3 mb-4">
          <StatCard title="Total Employees" value={data.total} color="primary" />
          <StatCard title="Active Employees" value={data.active} color="success" />
          <StatCard title="Inactive Employees" value={data.inactive} color="secondary" />
          <StatCard title="Checklist Tasks" value={data.totalChecklistTasks || 0} color="info" />
        </div>
      ) : null}

      <div className="card border-0 shadow-sm mt-4 dashboard-panel-card">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h6 className="mb-1">Employee Mark Drilldown</h6>
              <small className="text-muted">
                {showLevelSidebarSummary
                  ? "Use the left sidebar to switch between company, site, department, sub department, and employee summaries. When Companies is selected, click a company card to open the next screen."
                  : isCompanySiteDrilldown
                  ? hasAvailableSiteLeadStep
                    ? hasAvailableDepartmentLeadStep
                      ? "Select a company, then a site lead, then a site, then a department lead, and continue with department, sub department, employee, and checklist details in the same layout."
                      : "Select a company, then a site lead, then continue with site, department, sub department, employee, and checklist details in the same layout."
                    : "Select a company, then a site, then continue with department, sub department, and employee mark in the same layout."
                  : "Select a department to see department employees. Then click a sub department to filter those employees and view the employee overall mark."}
              </small>
            </div>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={resetDrilldown}
            >
              {useRouteCompanyId && companyOverviewPath ? "Back to Companies" : "Reset Drilldown"}
            </button>
          </div>

          {!companyOverviewOnly ? (
            <DrilldownPath
              variant={drilldownVariant}
              company={drilldownData.selectedCompany}
              siteLead={drilldownData.selectedSiteLead}
              site={drilldownData.selectedSite}
              departmentLead={drilldownData.selectedDepartmentLead}
              department={drilldownData.selectedDepartment}
              subDepartment={drilldownData.selectedSubDepartment}
              employee={drilldownData.selectedEmployee}
              showSiteLead={hasAvailableSiteLeadStep}
              showDepartmentLead={hasAvailableDepartmentLeadStep}
            />
          ) : null}

          {drilldownLoading ? (
            <div className="text-muted">Loading drilldown data...</div>
          ) : companyOverviewOnly && isCompanySiteDrilldown ? (
            <div className="row g-3 dashboard-level-layout">
              <div className="col-12 col-xl-3">
                <aside className="dashboard-level-sidebar">
                  <div className="dashboard-level-sidebar__eyebrow">Browse Levels</div>
                  <h6 className="dashboard-level-sidebar__title">Overview Summary</h6>
                  <div className="dashboard-level-sidebar__subtitle">
                    Switch the content area between company, site, department, sub department,
                    and employee totals without mixing the levels.
                  </div>

                  <div className="dashboard-level-sidebar__menu">
                    {DASHBOARD_LEVEL_MENU.map((item) => {
                      const itemCount = Array.isArray(sidebarLevelSummaries?.[item.key])
                        ? sidebarLevelSummaries[item.key].length
                        : 0;

                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`dashboard-level-sidebar__item ${
                            selectedSidebarLevel === item.key
                              ? "dashboard-level-sidebar__item--active"
                              : ""
                          }`}
                          onClick={() => setSelectedSidebarLevel(item.key)}
                        >
                          <div className="dashboard-level-sidebar__item-row">
                            <span className="dashboard-level-sidebar__item-label">{item.label}</span>
                            <span className="dashboard-level-sidebar__item-count">{itemCount}</span>
                          </div>
                          <div className="dashboard-level-sidebar__item-meta">{item.subtitle}</div>
                        </button>
                      );
                    })}
                  </div>
                </aside>
              </div>

              <div className="col-12 col-xl-9">
                <DrilldownPanel
                  title={sidebarLevelConfig.title}
                  subtitle={sidebarLevelConfig.subtitle}
                >
                  <div className="dashboard-level-toolbar mb-3">
                    <span className="summary-chip">
                      {selectedSidebarRows.length} available {selectedSidebarEntityLabel}
                    </span>
                    {selectedSidebarLevel === "companies" && companyDetailPath ? (
                      <span className="summary-chip summary-chip--neutral">
                        Click a company card to continue the drilldown.
                      </span>
                    ) : null}
                  </div>

                  {selectedSidebarRows.length ? (
                    <div className="row g-3">
                      {selectedSidebarRows.map((item) => {
                        const cardContent = buildDashboardLevelCardContent(
                          selectedSidebarLevel,
                          item
                        );

                        return (
                          <div className="col-12 col-md-6 col-xxl-4" key={item._id || item.name}>
                            <DashboardLevelSummaryCard
                              eyebrow={sidebarLevelConfig.eyebrow}
                              title={cardContent.title}
                              metrics={cardContent.metrics}
                              details={cardContent.details}
                              onClick={
                                selectedSidebarLevel === "companies" && companyDetailPath
                                  ? () => selectCompany(item._id)
                                  : undefined
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptySelection message={sidebarLevelConfig.emptyMessage} />
                  )}
                </DrilldownPanel>
              </div>
            </div>
          ) : isCompanySiteDrilldown && isColumnDrilldownLayout ? (
            <div className="row g-3">
              {!hideCompanyStep ? (
                <div className="col-12 col-xl-6">
                  <DrilldownPanel
                    title={companySiteStepTitles.company}
                    subtitle="Choose a company first. The next sections open in this same layout."
                  >
                    {drilldownData.companies?.length ? (
                      <div className="row g-2">
                        {drilldownData.companies.map((company) => (
                          <div className="col-12 col-md-6 col-xl-4" key={company._id}>
                            <DrilldownChoiceCard
                              title={company.name}
                              markText={
                                showDrilldownCardMarks
                                  ? buildMarkLine(company.overallMark)
                                  : undefined
                              }
                              primaryText={buildEmployeeCountText(company.employeeCount)}
                              active={String(selectedCompanyId) === String(company._id)}
                              onClick={() => selectCompany(company._id)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptySelection message="No companies available." />
                    )}
                  </DrilldownPanel>
                </div>
              ) : null}

              {hideCompanyStep && drilldownData.selectedCompany ? (
                <div className="col-12">
                  <DrilldownPanel
                    title="Selected Company"
                    subtitle={
                      hasAvailableSiteLeadStep
                        ? hasAvailableDepartmentLeadStep
                          ? "Continue the same process from site lead and department lead to checklist details."
                          : "Continue the same process from site lead to checklist details."
                        : "Continue the same process from site to employee mark."
                    }
                  >
                    <div className="row g-2">
                      <div className="col-12 col-md-6 col-xl-4">
                        <DrilldownChoiceCard
                          title={drilldownData.selectedCompany.name}
                          markText={
                            showDrilldownCardMarks
                              ? buildMarkLine(drilldownData.selectedCompany.overallMark)
                              : undefined
                          }
                          primaryText={buildEmployeeCountText(
                            drilldownData.selectedCompany.employeeCount
                          )}
                          active
                          onClick={() => {}}
                        />
                      </div>
                    </div>
                  </DrilldownPanel>
                </div>
              ) : null}

              {hasAvailableSiteLeadStep ? (
                <div className="col-12 col-xl-6">
                  <DrilldownPanel
                    title={companySiteStepTitles.siteLead}
                    subtitle={
                      drilldownData.selectedCompany
                        ? "Choose a site lead under the selected company."
                        : "Select a company first."
                    }
                  >
                    {drilldownData.selectedCompany ? (
                      drilldownData.siteLeads?.length ? (
                        <div className="row g-2">
                          {drilldownData.siteLeads.map((siteLead) => (
                            <div className="col-12 col-md-6 col-xl-4" key={siteLead._id}>
                              <DrilldownChoiceCard
                                title={siteLead.name || "-"}
                                markText={
                                  showDrilldownCardMarks
                                    ? buildMarkLine(siteLead.overallMark)
                                    : undefined
                                }
                                primaryText={`${siteLead.siteCount || 0} site${
                                  Number(siteLead.siteCount || 0) === 1 ? "" : "s"
                                }`}
                                secondaryText={`${siteLead.employeeCount || 0} employee${
                                  Number(siteLead.employeeCount || 0) === 1 ? "" : "s"
                                }`}
                                active={String(selectedSiteLeadId) === String(siteLead._id)}
                                onClick={() => selectSiteLead(siteLead._id)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptySelection message="No site leads found in this company." />
                      )
                    ) : (
                      <EmptySelection message="Select a company to view site leads." />
                    )}
                  </DrilldownPanel>
                </div>
              ) : null}

              <div className="col-12 col-xl-6">
                <DrilldownPanel
                  title={companySiteStepTitles.site}
                  subtitle={
                    hasAvailableSiteLeadStep
                      ? drilldownData.selectedSiteLead
                        ? "Choose a site under the selected site lead."
                        : drilldownData.selectedCompany
                        ? "Select a site lead first."
                        : "Select a company first."
                      : drilldownData.selectedCompany
                      ? "Choose a site under the selected company."
                      : "Select a company first."
                  }
                >
                  {siteStageSelectionOwner ? (
                    drilldownData.sites?.length ? (
                      <div className="row g-2">
                        {drilldownData.sites.map((site) => (
                          <div className="col-12 col-md-6 col-xl-4" key={site._id}>
                            <DrilldownChoiceCard
                              title={site.name || "-"}
                              markText={
                                showDrilldownCardMarks
                                  ? buildMarkLine(site.overallMark)
                                  : undefined
                              }
                              primaryText={`${site.employeeCount || 0} employee${
                                Number(site.employeeCount || 0) === 1 ? "" : "s"
                              }`}
                              secondaryText={site.companyName || "Site"}
                              active={String(selectedSiteId) === String(site._id)}
                              onClick={() => selectSite(site._id)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptySelection
                        message={
                          hasAvailableSiteLeadStep
                            ? "No sites found for this site lead."
                            : "No sites found in this company."
                        }
                      />
                    )
                  ) : (
                    <EmptySelection
                      message={
                        hasAvailableSiteLeadStep
                          ? "Select a site lead to view sites."
                          : "Select a company to view sites."
                      }
                    />
                  )}
                </DrilldownPanel>
              </div>

              {hasAvailableDepartmentLeadStep ? (
                <div className="col-12 col-xl-6">
                  <DrilldownPanel
                    title={companySiteStepTitles.departmentLead}
                    subtitle={
                      drilldownData.selectedSite
                        ? "Choose a department lead under the selected site."
                        : "Select a site first."
                    }
                  >
                    {drilldownData.selectedSite ? (
                      drilldownData.departmentLeads?.length ? (
                        <div className="row g-2">
                          {drilldownData.departmentLeads.map((departmentLead) => (
                            <div
                              className="col-12 col-md-6 col-xl-4"
                              key={departmentLead._id}
                            >
                              <DrilldownChoiceCard
                                title={departmentLead.name || "-"}
                                markText={
                                  showDrilldownCardMarks
                                    ? buildMarkLine(departmentLead.overallMark)
                                    : undefined
                                }
                                primaryText={`${
                                  departmentLead.departmentCount || 0
                                } department${
                                  Number(departmentLead.departmentCount || 0) === 1 ? "" : "s"
                                }`}
                                secondaryText={`${departmentLead.employeeCount || 0} employee${
                                  Number(departmentLead.employeeCount || 0) === 1 ? "" : "s"
                                }`}
                                active={
                                  String(selectedDepartmentLeadId) ===
                                  String(departmentLead._id)
                                }
                                onClick={() => selectDepartmentLead(departmentLead._id)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptySelection message="No department leads found in this site." />
                      )
                    ) : (
                      <EmptySelection message="Select a site to view department leads." />
                    )}
                  </DrilldownPanel>
                </div>
              ) : null}

              <div className="col-12 col-xl-6">
                <DrilldownPanel
                  title={companySiteStepTitles.department}
                  subtitle={
                    hasAvailableDepartmentLeadStep
                      ? drilldownData.selectedDepartmentLead
                        ? "Choose a department under the selected department lead."
                        : drilldownData.selectedSite
                        ? "Select a department lead first."
                        : "Select a site first."
                      : drilldownData.selectedSite
                      ? "Choose a department under the selected site."
                      : "Select a site first."
                  }
                >
                  {departmentStageSelectionOwner ? (
                    drilldownData.departments?.length ? (
                      <div className="row g-2">
                        {drilldownData.departments.map((department) => (
                          <div className="col-12 col-md-6 col-xl-4" key={department._id}>
                            <DrilldownChoiceCard
                              title={department.name}
                              markText={
                                showDrilldownCardMarks
                                  ? buildMarkLine(department.overallMark)
                                  : undefined
                              }
                              primaryText={`${department.subDepartmentCount || 0} sub department${
                                Number(department.subDepartmentCount || 0) === 1 ? "" : "s"
                              }`}
                              secondaryText={`${department.employeeCount || 0} employee${
                                Number(department.employeeCount || 0) === 1 ? "" : "s"
                              }`}
                              active={String(selectedDepartmentId) === String(department._id)}
                              onClick={() => selectDepartment(department._id)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptySelection
                        message={
                          hasAvailableDepartmentLeadStep
                            ? "No departments found for this department lead."
                            : "No departments found in this site."
                        }
                      />
                    )
                  ) : (
                    <EmptySelection
                      message={
                        hasAvailableDepartmentLeadStep
                          ? "Select a department lead to view departments."
                          : "Select a site to view departments."
                      }
                    />
                  )}
                </DrilldownPanel>
              </div>

              <div className="col-12 col-xl-6">
                <DrilldownPanel
                  title={companySiteStepTitles.subDepartment}
                  subtitle={
                    drilldownData.selectedDepartment
                      ? "Choose a sub department under the selected department."
                      : "Select a department first."
                  }
                >
                  {drilldownData.selectedDepartment ? (
                    drilldownData.subDepartments?.length ? (
                      <div className="row g-2">
                        {drilldownData.subDepartments.map((subDepartment) => (
                          <div className="col-12 col-md-6 col-xl-4" key={subDepartment._id}>
                            <DrilldownChoiceCard
                              title={subDepartment.name || subDepartment.label}
                              markText={
                                showDrilldownCardMarks
                                  ? buildMarkLine(subDepartment.overallMark)
                                  : undefined
                              }
                              primaryText={`${subDepartment.employeeCount || 0} employee${
                                Number(subDepartment.employeeCount || 0) === 1 ? "" : "s"
                              }`}
                              secondaryText={subDepartment.departmentName || "Sub Department"}
                              active={
                                String(selectedSubDepartmentId) === String(subDepartment._id)
                              }
                              onClick={() => selectSubDepartment(subDepartment._id)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptySelection message="No sub departments found in this department." />
                    )
                  ) : (
                    <EmptySelection message="Select a department to view sub departments." />
                  )}
                </DrilldownPanel>
              </div>

              <div className="col-12 col-xl-6">
                <DrilldownPanel
                  title={companySiteStepTitles.employee}
                  subtitle={
                    drilldownData.selectedSubDepartment
                      ? "These employees belong to the selected sub department."
                      : drilldownData.selectedDepartment
                      ? "These employees belong to the selected department."
                      : "Select a department first."
                  }
                >
                  {drilldownData.selectedDepartment ? (
                    drilldownData.employees?.length ? (
                      <div className="row g-2">
                        {drilldownData.employees.map((employee) => (
                          <div className="col-12 col-md-6 col-xl-4" key={employee._id}>
                            <DrilldownChoiceCard
                              title={employee.employeeName || "-"}
                              primaryText={`Mark ${
                                employee?.overallMark !== null &&
                                employee?.overallMark !== undefined
                                  ? formatMarkValue(employee.overallMark)
                                  : "-"
                              }`}
                              secondaryText={
                                employee.scoredChecklistCount
                                  ? `${employee.scoredChecklistCount} scored checklist${
                                      Number(employee.scoredChecklistCount || 0) === 1 ? "" : "s"
                                    }`
                                  : "No scored checklists yet"
                              }
                              photo={employee.photo}
                              photoError={photoErrors[employee._id]}
                              uploadBaseUrl={uploadBaseUrl}
                              onPhotoError={() =>
                                setPhotoErrors((prev) => ({ ...prev, [employee._id]: true }))
                              }
                              active={String(selectedEmployeeId) === String(employee._id)}
                              onClick={() => selectEmployee(employee._id)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptySelection
                        message={
                          drilldownData.selectedSubDepartment
                            ? "No employees found in this sub department."
                            : "No employees found in this department."
                        }
                      />
                    )
                  ) : (
                    <EmptySelection message="Select a department to view employee names." />
                  )}
                </DrilldownPanel>
              </div>

              <div className="col-12 col-xl-6">
                <DrilldownPanel
                  title={companySiteStepTitles.mark}
                  subtitle={
                    drilldownData.selectedEmployee
                      ? showEmployeeChecklistCards
                        ? "Checklist detail cards for the selected employee are shown here."
                        : "Selected employee overall mark is shown here."
                      : showEmployeeChecklistCards
                      ? "Click an employee name to see the checklist detail cards."
                      : "Click an employee name to see the overall mark."
                  }
                >
                  {renderSelectedEmployeeDetailContent({
                    noEmployeeMessage: showEmployeeChecklistCards
                      ? "Choose an employee from the section above to see the checklist detail cards."
                      : "Choose an employee from the section above to see the overall mark.",
                    noChecklistMessage:
                      "No completed checklist details found for this employee in the selected site.",
                  })}
                </DrilldownPanel>
              </div>

              {showCompletedTaskCard ? (
                <div className="col-12">
                  <DrilldownPanel
                    title={companySiteStepTitles.completedTasks}
                    subtitle={
                      drilldownData.selectedEmployee
                        ? "Completed task marks for the selected employee path are split properly below."
                        : "Click an employee to open the mark split-up here."
                    }
                  >
                    {drilldownData.selectedEmployee ? (
                      drilldownData.completedTasks?.length ? (
                        <EmployeeTaskSplitupTable
                          companyName={drilldownData.selectedCompany?.name}
                          siteName={drilldownData.selectedSite?.name}
                          departmentName={drilldownData.selectedDepartment?.name}
                          subDepartmentName={
                            drilldownData.selectedSubDepartment?.name ||
                            drilldownData.selectedSubDepartment?.label
                          }
                          employeeName={drilldownData.selectedEmployee?.employeeName}
                          tasks={drilldownData.completedTasks}
                        />
                      ) : (
                        <EmptySelection message="No completed scored tasks found for this employee in the selected site." />
                      )
                    ) : (
                      <EmptySelection message="Choose an employee from the section above to view the mark split-up." />
                    )}
                  </DrilldownPanel>
                </div>
              ) : null}
            </div>
          ) : isCompanySiteDrilldown ? (
            <div className="d-flex flex-column gap-3">
              <DrilldownPanel
                title="1. Companies"
                subtitle={
                  hasAvailableSiteLeadStep
                    ? "Choose a company first. Site leads and the next levels will open below."
                    : "Choose a company first. The sites and the next levels will open below."
                }
              >
                {drilldownData.companies?.length ? (
                  <div className="row g-2">
                    {drilldownData.companies.map((company) => (
                      <div className="col-12 col-md-6 col-xl-4" key={company._id}>
                        <DrilldownChoiceCard
                          title={company.name}
                          markText={
                            showDrilldownCardMarks
                              ? buildMarkLine(company.overallMark)
                              : undefined
                          }
                          primaryText={buildEmployeeCountText(company.employeeCount)}
                          active={String(selectedCompanyId) === String(company._id)}
                          onClick={() => selectCompany(company._id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySelection message="No companies available." />
                )}
              </DrilldownPanel>

              {hasAvailableSiteLeadStep && drilldownData.selectedCompany ? (
                <DrilldownPanel
                  title={companySiteStepTitles.siteLead}
                  subtitle="Click a site lead to open the sites below."
                >
                  {drilldownData.siteLeads?.length ? (
                    <div className="row g-2">
                      {drilldownData.siteLeads.map((siteLead) => (
                        <div className="col-12 col-md-6 col-xl-4" key={siteLead._id}>
                          <DrilldownChoiceCard
                            title={siteLead.name || "-"}
                            markText={
                              showDrilldownCardMarks
                                ? buildMarkLine(siteLead.overallMark)
                                : undefined
                            }
                            primaryText={`${siteLead.siteCount || 0} site${
                              Number(siteLead.siteCount || 0) === 1 ? "" : "s"
                            }`}
                            secondaryText={`${siteLead.employeeCount || 0} employee${
                              Number(siteLead.employeeCount || 0) === 1 ? "" : "s"
                            }`}
                            active={String(selectedSiteLeadId) === String(siteLead._id)}
                            onClick={() => selectSiteLead(siteLead._id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySelection message="No site leads found in this company." />
                  )}
                </DrilldownPanel>
              ) : null}

              {siteStageSelectionOwner ? (
                <DrilldownPanel
                  title={companySiteStepTitles.site}
                  subtitle={
                    hasAvailableSiteLeadStep
                      ? "Click a site under the selected site lead to open the departments below."
                      : "Click a site to open the departments below."
                  }
                >
                  {drilldownData.sites?.length ? (
                    <div className="row g-2">
                      {drilldownData.sites.map((site) => (
                        <div className="col-12 col-md-6 col-xl-4" key={site._id}>
                          <DrilldownChoiceCard
                            title={site.name || "-"}
                            markText={
                              showDrilldownCardMarks
                                ? buildMarkLine(site.overallMark)
                                : undefined
                            }
                            primaryText={`${site.employeeCount || 0} employee${
                              Number(site.employeeCount || 0) === 1 ? "" : "s"
                            }`}
                            secondaryText={site.companyName || "Site"}
                            active={String(selectedSiteId) === String(site._id)}
                            onClick={() => selectSite(site._id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySelection
                      message={
                        hasAvailableSiteLeadStep
                          ? "No sites found for this site lead."
                          : "No sites found in this company."
                      }
                    />
                  )}
                </DrilldownPanel>
              ) : null}

              {hasAvailableDepartmentLeadStep && drilldownData.selectedSite ? (
                <DrilldownPanel
                  title={companySiteStepTitles.departmentLead}
                  subtitle="Click a department lead to open the departments below."
                >
                  {drilldownData.departmentLeads?.length ? (
                    <div className="row g-2">
                      {drilldownData.departmentLeads.map((departmentLead) => (
                        <div className="col-12 col-md-6 col-xl-4" key={departmentLead._id}>
                          <DrilldownChoiceCard
                            title={departmentLead.name || "-"}
                            markText={
                              showDrilldownCardMarks
                                ? buildMarkLine(departmentLead.overallMark)
                                : undefined
                            }
                            primaryText={`${departmentLead.departmentCount || 0} department${
                              Number(departmentLead.departmentCount || 0) === 1 ? "" : "s"
                            }`}
                            secondaryText={`${departmentLead.employeeCount || 0} employee${
                              Number(departmentLead.employeeCount || 0) === 1 ? "" : "s"
                            }`}
                            active={
                              String(selectedDepartmentLeadId) ===
                              String(departmentLead._id)
                            }
                            onClick={() => selectDepartmentLead(departmentLead._id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySelection message="No department leads found in this site." />
                  )}
                </DrilldownPanel>
              ) : null}

              {departmentStageSelectionOwner ? (
                <DrilldownPanel
                  title={companySiteStepTitles.department}
                  subtitle={
                    hasAvailableDepartmentLeadStep
                      ? "Choose a department under the selected department lead."
                      : "Choose a department under the selected site."
                  }
                >
                  {drilldownData.departments?.length ? (
                    <div className="row g-2">
                      {drilldownData.departments.map((department) => (
                        <div className="col-12 col-md-6 col-xl-4" key={department._id}>
                          <DrilldownChoiceCard
                            title={department.name}
                            markText={
                              showDrilldownCardMarks
                                ? buildMarkLine(department.overallMark)
                                : undefined
                            }
                            primaryText={`${department.subDepartmentCount || 0} sub department${
                              Number(department.subDepartmentCount || 0) === 1 ? "" : "s"
                            }`}
                            secondaryText={`${department.employeeCount || 0} employee${
                              Number(department.employeeCount || 0) === 1 ? "" : "s"
                            }`}
                            active={String(selectedDepartmentId) === String(department._id)}
                            onClick={() => selectDepartment(department._id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySelection
                      message={
                        hasAvailableDepartmentLeadStep
                          ? "No departments found for this department lead."
                          : "No departments found in this site."
                      }
                    />
                  )}
                </DrilldownPanel>
              ) : null}

              {drilldownData.selectedDepartment ? (
                <DrilldownPanel
                  title={companySiteStepTitles.subDepartment}
                  subtitle="Click a sub department below to filter the employees in the next section."
                >
                  {drilldownData.subDepartments?.length ? (
                    <div className="row g-2">
                      {drilldownData.subDepartments.map((subDepartment) => (
                        <div className="col-12 col-md-6 col-xl-4" key={subDepartment._id}>
                          <DrilldownChoiceCard
                            title={subDepartment.name || subDepartment.label}
                            markText={
                              showDrilldownCardMarks
                                ? buildMarkLine(subDepartment.overallMark)
                                : undefined
                            }
                            primaryText={`${subDepartment.employeeCount || 0} employee${
                              Number(subDepartment.employeeCount || 0) === 1 ? "" : "s"
                            }`}
                            secondaryText={subDepartment.departmentName || "Sub Department"}
                            active={String(selectedSubDepartmentId) === String(subDepartment._id)}
                            onClick={() => selectSubDepartment(subDepartment._id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySelection message="No sub departments found in this department." />
                  )}
                </DrilldownPanel>
              ) : null}

              {drilldownData.selectedDepartment ? (
                <DrilldownPanel
                  title={companySiteStepTitles.employee}
                  subtitle={
                    drilldownData.selectedSubDepartment
                      ? "These employees belong to the selected sub department."
                      : "These employees belong to the selected department."
                  }
                >
                  {drilldownData.employees?.length ? (
                    <div className="row g-2">
                      {drilldownData.employees.map((employee) => (
                        <div className="col-12 col-md-6 col-xl-4" key={employee._id}>
                          <DrilldownChoiceCard
                            title={employee.employeeName || "-"}
                            primaryText={`Mark ${
                              employee?.overallMark !== null &&
                              employee?.overallMark !== undefined
                                ? formatMarkValue(employee.overallMark)
                                : "-"
                            }`}
                            secondaryText={
                              employee.scoredChecklistCount
                                ? `${employee.scoredChecklistCount} scored checklist${
                                    Number(employee.scoredChecklistCount || 0) === 1 ? "" : "s"
                                  }`
                                : "No scored checklists yet"
                            }
                            photo={employee.photo}
                            photoError={photoErrors[employee._id]}
                            uploadBaseUrl={uploadBaseUrl}
                            onPhotoError={() =>
                              setPhotoErrors((prev) => ({ ...prev, [employee._id]: true }))
                            }
                            active={String(selectedEmployeeId) === String(employee._id)}
                            onClick={() => selectEmployee(employee._id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySelection
                      message={
                        drilldownData.selectedSubDepartment
                          ? "No employees found in this sub department."
                          : "No employees found in this department."
                      }
                    />
                  )}
                </DrilldownPanel>
              ) : null}

              {drilldownData.selectedDepartment ? (
                <DrilldownPanel
                  title={companySiteStepTitles.mark}
                  subtitle={
                    drilldownData.selectedEmployee
                      ? showEmployeeChecklistCards
                        ? "Checklist detail cards for the selected employee are shown below."
                        : "Selected employee overall mark is shown below."
                      : showEmployeeChecklistCards
                      ? "Click an employee from the section above to open the checklist detail cards here."
                      : "Click an employee from the section above to open the mark here."
                  }
                >
                  {renderSelectedEmployeeDetailContent({
                    noEmployeeMessage: showEmployeeChecklistCards
                      ? "Choose an employee from the section above to see the checklist detail cards."
                      : "Choose an employee from the section above to see the overall mark.",
                    noChecklistMessage:
                      "No completed checklist details found for this employee in the selected site.",
                  })}
                </DrilldownPanel>
              ) : null}
            </div>
          ) : isColumnDrilldownLayout ? (
            <div className="row g-3">
              <div className="col-12 col-xl-6">
                <DrilldownPanel
                  title="1. Departments"
                  subtitle="Choose a department first. The next sections open in this layout."
                >
                  {drilldownData.departments?.length ? (
                    <div className="row g-2">
                      {drilldownData.departments.map((department) => (
                        <div className="col-12 col-md-6 col-xl-4" key={department._id}>
                          <DrilldownChoiceCard
                            title={department.name}
                            primaryText={`${department.subDepartmentCount || 0} sub department${
                              Number(department.subDepartmentCount || 0) === 1 ? "" : "s"
                            }`}
                            secondaryText={`${department.employeeCount || 0} employee${
                              Number(department.employeeCount || 0) === 1 ? "" : "s"
                            }`}
                            active={String(selectedDepartmentId) === String(department._id)}
                            onClick={() => selectDepartment(department._id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySelection message="No departments available." />
                  )}
                </DrilldownPanel>
              </div>

              <div className="col-12 col-xl-6">
                <DrilldownPanel
                  title="2. Sub Departments"
                  subtitle={
                    drilldownData.selectedDepartment
                      ? "Choose a sub department under the selected department."
                      : "Select a department first."
                  }
                >
                  {drilldownData.selectedDepartment ? (
                    drilldownData.subDepartments?.length ? (
                      <div className="row g-2">
                        {drilldownData.subDepartments.map((subDepartment) => (
                          <div className="col-12 col-md-6 col-xl-4" key={subDepartment._id}>
                            <DrilldownChoiceCard
                              title={subDepartment.name || subDepartment.label}
                              primaryText={`${subDepartment.employeeCount || 0} employee${
                                Number(subDepartment.employeeCount || 0) === 1 ? "" : "s"
                              }`}
                              secondaryText={subDepartment.departmentName || "Sub Department"}
                              active={
                                String(selectedSubDepartmentId) === String(subDepartment._id)
                              }
                              onClick={() => selectSubDepartment(subDepartment._id)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptySelection message="No sub departments found in this department." />
                    )
                  ) : (
                    <EmptySelection message="Select a department to view sub departments." />
                  )}
                </DrilldownPanel>
              </div>

              <div className="col-12 col-xl-6">
                <DrilldownPanel
                  title="3. Employees"
                  subtitle={
                    drilldownData.selectedSubDepartment
                      ? "These employees belong to the selected sub department."
                      : drilldownData.selectedDepartment
                      ? "These employees belong to the selected department."
                      : "Select a department first."
                  }
                >
                  {drilldownData.selectedDepartment ? (
                    drilldownData.employees?.length ? (
                      <div className="row g-2">
                        {drilldownData.employees.map((employee) => (
                          <div className="col-12 col-md-6 col-xl-4" key={employee._id}>
                            <DrilldownChoiceCard
                              title={employee.employeeName || "-"}
                              primaryText={`Mark ${
                                employee?.overallMark !== null &&
                                employee?.overallMark !== undefined
                                  ? formatMarkValue(employee.overallMark)
                                  : "-"
                              }`}
                              secondaryText={
                                employee.scoredChecklistCount
                                  ? `${employee.scoredChecklistCount} scored checklist${
                                      Number(employee.scoredChecklistCount || 0) === 1 ? "" : "s"
                                    }`
                                  : "No scored checklists yet"
                              }
                              photo={employee.photo}
                              photoError={photoErrors[employee._id]}
                              uploadBaseUrl={uploadBaseUrl}
                              onPhotoError={() =>
                                setPhotoErrors((prev) => ({ ...prev, [employee._id]: true }))
                              }
                              active={String(selectedEmployeeId) === String(employee._id)}
                              onClick={() => selectEmployee(employee._id)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptySelection
                        message={
                          drilldownData.selectedSubDepartment
                            ? "No employees found in this sub department."
                            : "No employees found in this department."
                        }
                      />
                    )
                  ) : (
                    <EmptySelection message="Select a department to view employee names." />
                  )}
                </DrilldownPanel>
              </div>

              <div className="col-12 col-xl-6">
                <DrilldownPanel
                  title={showEmployeeChecklistCards ? "4. Checklist Details" : "4. Employee Overall Mark"}
                  subtitle={
                    drilldownData.selectedEmployee
                      ? showEmployeeChecklistCards
                        ? "Checklist detail cards for the selected employee are shown here."
                        : "Selected employee overall mark is shown here."
                      : showEmployeeChecklistCards
                      ? "Click an employee name to see the checklist detail cards."
                      : "Click an employee name to see the overall mark."
                  }
                >
                  {renderSelectedEmployeeDetailContent({
                    noEmployeeMessage: showEmployeeChecklistCards
                      ? "Choose an employee from step 3 to see the checklist detail cards."
                      : "Choose an employee from step 3 to see the overall mark.",
                    noChecklistMessage:
                      "No completed checklist details found for this employee in the selected site.",
                  })}
                </DrilldownPanel>
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              <DrilldownPanel
                title="1. Departments"
                subtitle="Choose a department first. The sub departments and employees will open below."
              >
                {drilldownData.departments?.length ? (
                  <div className="row g-2">
                    {drilldownData.departments.map((department) => (
                      <div className="col-12 col-md-6 col-xl-4" key={department._id}>
                        <DrilldownChoiceCard
                          title={department.name}
                          primaryText={`${department.subDepartmentCount || 0} sub department${
                            Number(department.subDepartmentCount || 0) === 1 ? "" : "s"
                          }`}
                          secondaryText={`${department.employeeCount || 0} employee${
                            Number(department.employeeCount || 0) === 1 ? "" : "s"
                          }`}
                          active={String(selectedDepartmentId) === String(department._id)}
                          onClick={() => selectDepartment(department._id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySelection message="No departments available." />
                )}
              </DrilldownPanel>

              {drilldownData.selectedDepartment ? (
                <DrilldownPanel
                  title="2. Sub Departments"
                  subtitle="Click a sub department below to filter the employees in the next section."
                >
                  {drilldownData.subDepartments?.length ? (
                    <div className="row g-2">
                      {drilldownData.subDepartments.map((subDepartment) => (
                        <div className="col-12 col-md-6 col-xl-4" key={subDepartment._id}>
                          <DrilldownChoiceCard
                            title={subDepartment.name || subDepartment.label}
                            primaryText={`${subDepartment.employeeCount || 0} employee${
                              Number(subDepartment.employeeCount || 0) === 1 ? "" : "s"
                            }`}
                            secondaryText={subDepartment.departmentName || "Sub Department"}
                            active={String(selectedSubDepartmentId) === String(subDepartment._id)}
                            onClick={() => selectSubDepartment(subDepartment._id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySelection message="No sub departments found in this department." />
                  )}
                </DrilldownPanel>
              ) : null}

              {drilldownData.selectedDepartment ? (
                <DrilldownPanel
                  title="3. Employees"
                  subtitle={
                    drilldownData.selectedSubDepartment
                      ? "These employees belong to the selected sub department."
                      : "These employees belong to the selected department."
                  }
                >
                  {drilldownData.employees?.length ? (
                    <div className="row g-2">
                      {drilldownData.employees.map((employee) => (
                        <div className="col-12 col-md-6 col-xl-4" key={employee._id}>
                          <DrilldownChoiceCard
                            title={employee.employeeName || "-"}
                            primaryText={`Mark ${
                              employee?.overallMark !== null &&
                              employee?.overallMark !== undefined
                                ? formatMarkValue(employee.overallMark)
                                : "-"
                            }`}
                            secondaryText={
                              employee.scoredChecklistCount
                                ? `${employee.scoredChecklistCount} scored checklist${
                                    Number(employee.scoredChecklistCount || 0) === 1 ? "" : "s"
                                  }`
                                : "No scored checklists yet"
                            }
                            photo={employee.photo}
                            photoError={photoErrors[employee._id]}
                            uploadBaseUrl={uploadBaseUrl}
                            onPhotoError={() =>
                              setPhotoErrors((prev) => ({ ...prev, [employee._id]: true }))
                            }
                            active={String(selectedEmployeeId) === String(employee._id)}
                            onClick={() => selectEmployee(employee._id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySelection
                      message={
                        drilldownData.selectedSubDepartment
                          ? "No employees found in this sub department."
                          : "No employees found in this department."
                      }
                    />
                  )}
                </DrilldownPanel>
              ) : null}

              {drilldownData.selectedDepartment ? (
                <DrilldownPanel
                  title={showEmployeeChecklistCards ? "4. Checklist Details" : "4. Employee Overall Mark"}
                  subtitle={
                    drilldownData.selectedEmployee
                      ? showEmployeeChecklistCards
                        ? "Checklist detail cards for the selected employee are shown below."
                        : "Selected employee overall mark is shown below."
                      : showEmployeeChecklistCards
                      ? "Click an employee from the section above to open the checklist detail cards here."
                      : "Click an employee from the section above to open the mark here."
                  }
                >
                  {renderSelectedEmployeeDetailContent({
                    noEmployeeMessage: showEmployeeChecklistCards
                      ? "Choose an employee from the section above to see the checklist detail cards."
                      : "Choose an employee from the section above to see the overall mark.",
                    noChecklistMessage:
                      "No completed checklist details found for this employee in the selected site.",
                  })}
                </DrilldownPanel>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {showEmployeeOverallSection ? (
        <div className="card border-0 shadow-sm mt-4 dashboard-panel-card">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h6 className="mb-1">Employee Overall Marks</h6>
                <small className="text-muted">
                  Click expand to open the employee list. Each employee row stays collapsed until you
                  open it.
                </small>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${
                    showEmployeeMarksSection ? "btn-outline-secondary" : "btn-outline-primary"
                  }`}
                  onClick={toggleEmployeeMarksSection}
                >
                  {showEmployeeMarksSection ? "Collapse Employees" : "Expand Employees"}
                </button>

                {showEmployeeMarksSection && data.employeeOverallMarks?.length ? (
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={expandAllEmployeeMarks}
                      disabled={areAllEmployeeMarksExpanded}
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={collapseAllEmployeeMarks}
                      disabled={!expandedEmployeeMarkIds.size}
                    >
                      Collapse All
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {!showEmployeeMarksSection ? (
              <div className="text-muted">Employee list is collapsed by default. Click expand to view it.</div>
            ) : data.employeeOverallMarks?.length ? (
              <div className="d-flex flex-column gap-3">
                {data.employeeOverallMarks.map((employee) => (
                  <EmployeeMarkAccordionItem
                    key={employee._id}
                    employee={employee}
                    expanded={expandedEmployeeMarkIds.has(String(employee._id))}
                    onToggle={() => toggleEmployeeMark(employee._id)}
                    photoError={photoErrors[employee._id]}
                    uploadBaseUrl={uploadBaseUrl}
                    onPhotoError={() =>
                      setPhotoErrors((prev) => ({ ...prev, [employee._id]: true }))
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="text-muted">No employee mark data available.</div>
            )}
          </div>
        </div>
      ) : null}

      <DashboardFeedbackWidget pageLabel={pageTitle} />
    </div>
  );
}

/* ===== CARD COMPONENT ===== */
function buildMarkLine(value) {
  return (
    <>
      <span className="dashboard-mark-line__label">Mark</span>
      <span className="dashboard-mark-line__value">
        {value !== null && value !== undefined ? formatMarkValue(value) : "-"}
      </span>
    </>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className="col-12 col-md-6 col-xl-3">
      <div className={`card text-white bg-${color} h-100 dashboard-stat-card`}>
        <div className="card-body text-center">
          <h6>{title}</h6>
          <h2>{value}</h2>
        </div>
      </div>
    </div>
  );
}

function DrilldownPanel({ title, subtitle, children }) {
  const sectionKey = getDashboardSectionKeyFromTitle(title);

  return (
    <div
      className="card h-100 border dashboard-panel-card dashboard-step-panel"
      data-dashboard-section={sectionKey || undefined}
    >
      <div className="card-body">
        <h6 className="mb-1">{title}</h6>
        <div className="text-muted small mb-3">{subtitle}</div>
        {children}
      </div>
    </div>
  );
}

function DrilldownPath({
  variant = "department",
  company,
  siteLead,
  site,
  departmentLead,
  department,
  subDepartment,
  employee,
  showSiteLead = false,
  showDepartmentLead = false,
}) {
  const segments =
    variant === "company-site"
      ? [
          company?.name || "Company",
          ...(showSiteLead ? [siteLead?.name || "Site Lead"] : []),
          site?.name || "Site",
          ...(showDepartmentLead ? [departmentLead?.name || "Department Lead"] : []),
          department?.name || "Department",
          subDepartment?.name || subDepartment?.label || "Sub Department",
          employee?.employeeName || "Employee",
        ]
      : [
          department?.name || "Department",
          subDepartment?.name || subDepartment?.label || "Sub Department",
          employee?.employeeName || "Employee",
        ];

  return (
    <div className="alert alert-light border py-2 px-3 small mb-3 dashboard-path-banner">
      <span className="text-muted">Selected Path: </span>
      {segments.join(" -> ")}
    </div>
  );
}

function DrilldownChoiceCard({
  title,
  markText,
  primaryText,
  secondaryText,
  active,
  onClick,
  photo,
  photoError,
  uploadBaseUrl,
  onPhotoError,
}) {
  const cardInitial = String(title || "").trim().charAt(0).toUpperCase() || "?";
  const showPhoto = photo && !photoError;

  return (
    <button
      type="button"
      className={`btn p-0 w-100 text-start h-100 ${
        active ? "shadow-sm" : ""
      }`}
      onClick={onClick}
      style={{ border: "none" }}
    >
      <div
        className={`card h-100 dashboard-choice-card ${
          active ? "bg-primary-subtle border border-primary" : "bg-light border-0"
        }`}
      >
        <div className="card-body d-flex align-items-center gap-3">
          {showPhoto ? (
            <img
              src={`${uploadBaseUrl}/uploads/${photo}`}
              alt={title || "Item"}
              width="56"
              height="56"
              style={{ borderRadius: "50%", objectFit: "cover" }}
              onError={onPhotoError}
            />
          ) : (
            <div
              className="d-flex align-items-center justify-content-center fw-semibold text-secondary bg-white border"
              style={{ width: 56, height: 56, borderRadius: "50%" }}
            >
              {cardInitial}
            </div>
          )}

          <div className="flex-grow-1">
            <div className="fw-semibold text-dark">{title || "-"}</div>
            {markText ? <div className="dashboard-mark-line text-primary mt-1">{markText}</div> : null}
            {primaryText ? (
              <div className={markText ? "small text-muted mt-1" : "text-primary fw-bold mt-1"}>
                {primaryText}
              </div>
            ) : null}
            {secondaryText ? <small className="text-muted">{secondaryText}</small> : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function DashboardLevelSummaryCard({
  eyebrow = "Summary",
  title,
  metrics = [],
  details = [],
  onClick,
}) {
  const CardTag = onClick ? "button" : "div";

  return (
    <CardTag
      type={onClick ? "button" : undefined}
      className={`dashboard-level-card ${onClick ? "dashboard-level-card--interactive" : ""}`}
      onClick={onClick}
    >
      <div className="dashboard-level-card__header">
        <div>
          <div className="dashboard-level-card__eyebrow">{eyebrow}</div>
          <div className="dashboard-level-card__title">{title || "-"}</div>
        </div>
        {onClick ? <span className="summary-chip summary-chip--neutral">Open</span> : null}
      </div>

      <div className="dashboard-level-card__metrics">
        {metrics.map((metric) => (
          <div
            className="dashboard-level-card__metric"
            key={`${metric.label}-${metric.kind || "value"}`}
          >
            <div className="dashboard-level-card__metric-label">{metric.label}</div>
            <div
              className={`dashboard-level-card__metric-value ${
                metric.kind === "mark" ? "dashboard-level-card__metric-value--mark" : ""
              }`}
            >
              {metric.kind === "mark"
                ? metric.value !== null && metric.value !== undefined
                  ? formatMarkValue(metric.value)
                  : "-"
                : metric.value ?? "-"}
            </div>
          </div>
        ))}
      </div>

      {details.length ? (
        <div className="dashboard-level-card__details">
          {details.map((detail) => (
            <div className="dashboard-level-card__detail" key={detail}>
              {detail}
            </div>
          ))}
        </div>
      ) : null}
    </CardTag>
  );
}

function EmptySelection({ message }) {
  return <div className="text-muted">{message}</div>;
}

function EmployeeMarkAccordionItem({
  employee,
  expanded,
  onToggle,
  photoError,
  uploadBaseUrl,
  onPhotoError,
}) {
  const employeeInitial =
    String(employee?.employeeName || "").trim().charAt(0).toUpperCase() || "?";
  const showPhoto = employee?.photo && !photoError;
  const hasMark = employee?.overallMark !== null && employee?.overallMark !== undefined;

  return (
    <div className="card border-0 shadow-sm overflow-hidden dashboard-employee-card">
      <button
        type="button"
        className="btn btn-light text-start border-0 rounded-0 p-0 dashboard-employee-card__trigger"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="card-body d-flex flex-wrap align-items-center gap-3">
          {showPhoto ? (
            <img
              src={`${uploadBaseUrl}/uploads/${employee.photo}`}
              alt={employee.employeeName || "Employee"}
              width="56"
              height="56"
              style={{ borderRadius: "50%", objectFit: "cover" }}
              onError={onPhotoError}
            />
          ) : (
            <div
              className="d-flex align-items-center justify-content-center fw-semibold text-secondary bg-white border"
              style={{ width: 56, height: 56, borderRadius: "50%" }}
            >
              {employeeInitial}
            </div>
          )}

          <div className="flex-grow-1">
            <div className="fw-semibold text-dark">{employee.employeeName || "-"}</div>
            <div className="small text-muted">
              {employee.employeeCode || "No employee code"}
            </div>
          </div>

          <div className="ms-auto d-flex align-items-center gap-3">
            <div className="text-end">
              <div className="dashboard-mark-line text-primary justify-content-end">
                {buildMarkLine(hasMark ? employee.overallMark : null)}
              </div>
              <div className="small text-muted">
                {employee.scoredChecklistCount
                  ? `${employee.scoredChecklistCount} scored checklist${
                      employee.scoredChecklistCount === 1 ? "" : "s"
                    }`
                  : "No scored checklists yet"}
              </div>
            </div>

            <div className="fs-4 text-secondary lh-1" aria-hidden="true">
              {expanded ? "-" : "+"}
            </div>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-top bg-white">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-12 col-md-6 col-xl-3">
                <div className="small text-muted mb-1">Employee Code</div>
                <div className="fw-semibold">{employee.employeeCode || "-"}</div>
              </div>

              <div className="col-12 col-md-6 col-xl-3">
                <div className="small text-muted mb-1">Status</div>
                <div className="fw-semibold">
                  {employee.isActive !== false ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="col-12 col-md-6 col-xl-3">
                <div className="small text-muted mb-1">Department</div>
                <div className="fw-semibold">
                  {employee.departmentDisplay || "No department assigned"}
                </div>
              </div>

              <div className="col-12 col-md-6 col-xl-3">
                <div className="small text-muted mb-1">Sub Department</div>
                <div className="fw-semibold">
                  {employee.subDepartmentDisplay || "No sub department assigned"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmployeeMarkCard({ employee, photoError, uploadBaseUrl, onPhotoError }) {
  const employeeInitial =
    String(employee?.employeeName || "").trim().charAt(0).toUpperCase() || "?";
  const showPhoto = employee?.photo && !photoError;
  const hasMark = employee?.overallMark !== null && employee?.overallMark !== undefined;

  return (
    <div className="card h-100 border-0 bg-light dashboard-surface-card">
      <div className="card-body d-flex align-items-center gap-3">
        {showPhoto ? (
          <img
            src={`${uploadBaseUrl}/uploads/${employee.photo}`}
            alt={employee.employeeName || "Employee"}
            width="56"
            height="56"
            style={{ borderRadius: "50%", objectFit: "cover" }}
            onError={onPhotoError}
          />
        ) : (
          <div
            className="d-flex align-items-center justify-content-center fw-semibold text-secondary bg-white border"
            style={{ width: 56, height: 56, borderRadius: "50%" }}
          >
            {employeeInitial}
          </div>
        )}

        <div className="flex-grow-1">
          <div className="fw-semibold">{employee.employeeName || "-"}</div>
          <div className="dashboard-mark-line text-primary mt-1">
            {buildMarkLine(hasMark ? employee.overallMark : null)}
          </div>
          <small className="text-muted">
            {employee.scoredChecklistCount
              ? `${employee.scoredChecklistCount} scored checklist${
                  employee.scoredChecklistCount === 1 ? "" : "s"
                }`
              : "No scored checklists yet"}
          </small>
        </div>
      </div>
    </div>
  );
}

function EmployeeChecklistCardGrid({
  tasks = [],
  emptyMessage = "No checklist details available.",
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  if (!safeTasks.length) {
    return <EmptySelection message={emptyMessage} />;
  }

  return (
    <div className="row g-3">
      {safeTasks.map((task) => (
        <div className="col-12 col-md-6 col-xl-4" key={task._id}>
          <div className="card h-100 border-0 bg-light dashboard-surface-card">
            <div className="card-body d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <div className="small text-muted">
                    {task.checklistNumber || "Checklist"}
                  </div>
                  <div className="fw-semibold">{task.checklistName || "-"}</div>
                </div>

                <div className="text-end">
                  <div className="small text-muted">Mark</div>
                  <div className="fw-bold text-primary">
                    {task.finalMark !== null && task.finalMark !== undefined
                      ? formatMarkValue(task.finalMark)
                      : "-"}
                  </div>
                </div>
              </div>

              <div>
                <div className="small text-muted">Task Number</div>
                <div className="fw-semibold">{task.taskNumber || "-"}</div>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <div className="small text-muted">Occurrence</div>
                  <div className="fw-semibold small">{formatDate(task.occurrenceDate)}</div>
                </div>

                <div className="col-6">
                  <div className="small text-muted">Completed</div>
                  <div className="fw-semibold small">{formatDateTime(task.completedAt)}</div>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 mt-auto">
                <span className={`badge ${getChecklistTaskStatusBadgeClass(task.status)}`}>
                  {formatChecklistTaskStatus(task.status)}
                </span>
                <span className={`badge ${getTimelinessBadgeClass(task.timelinessStatus)}`}>
                  {formatTimelinessLabel(task.timelinessStatus)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmployeeTaskSplitupTable({
  companyName,
  siteName,
  departmentName,
  subDepartmentName,
  employeeName,
  tasks = [],
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const totalMark = safeTasks.reduce((total, task) => {
    const parsedValue = Number(task?.finalMark);
    return Number.isFinite(parsedValue) ? total + parsedValue : total;
  }, 0);
  const totalMarkLabel = formatMarkValue(totalMark);
  const rowSpan = Math.max(safeTasks.length, 1);

  return (
    <div className="table-responsive">
      <table className="table table-sm table-bordered align-middle mb-0">
        <thead className="table-warning">
          <tr>
            <th>Company</th>
            <th>Mark</th>
            <th>Sites</th>
            <th>Mark</th>
            <th>Departments</th>
            <th>Mark</th>
            <th>Sub Departments</th>
            <th>Mark</th>
            <th>Employees</th>
            <th>Mark</th>
            <th>Checklist Task</th>
            <th>Mark</th>
          </tr>
        </thead>
        <tbody>
          {safeTasks.map((task, index) => (
            <tr key={task._id}>
              {index === 0 ? (
                <>
                  <td rowSpan={rowSpan}>{companyName || "-"}</td>
                  <td rowSpan={rowSpan} className="fw-bold text-primary">
                    {totalMarkLabel}
                  </td>
                  <td rowSpan={rowSpan}>{siteName || "-"}</td>
                  <td rowSpan={rowSpan} className="fw-bold text-primary">
                    {totalMarkLabel}
                  </td>
                  <td rowSpan={rowSpan}>{departmentName || "-"}</td>
                  <td rowSpan={rowSpan} className="fw-bold text-primary">
                    {totalMarkLabel}
                  </td>
                  <td rowSpan={rowSpan}>{subDepartmentName || "-"}</td>
                  <td rowSpan={rowSpan} className="fw-bold text-primary">
                    {totalMarkLabel}
                  </td>
                  <td rowSpan={rowSpan}>{employeeName || "-"}</td>
                  <td rowSpan={rowSpan} className="fw-bold text-primary">
                    {totalMarkLabel}
                  </td>
                </>
              ) : null}
              <td>
                <div className="fw-semibold">{task?.taskNumber || "-"}</div>
                <div className="small text-muted">{task?.checklistName || "-"}</div>
              </td>
              <td className="fw-bold text-primary">
                {task?.finalMark !== null && task?.finalMark !== undefined
                  ? formatMarkValue(task.finalMark)
                  : "-"}
              </td>
            </tr>
          ))}
          <tr className="table-light">
            <td colSpan="8" />
            <td className="fw-semibold">Total mark</td>
            <td className="fw-bold text-primary">{totalMarkLabel}</td>
            <td className="fw-semibold">Total mark</td>
            <td className="fw-bold text-primary">{totalMarkLabel}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
