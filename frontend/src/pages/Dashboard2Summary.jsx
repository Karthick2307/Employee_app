import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import DashboardFeedbackWidget from "../components/DashboardFeedbackWidget";
import { formatMarkValue } from "../utils/checklistDisplay";

const defaultFilters = {
  company: "",
  site: "",
  department: "",
  subDepartment: "",
  employee: "",
  fromDate: "",
  toDate: "",
  checklistType: "",
};

const emptySummaryData = {
  filters: {
    selected: defaultFilters,
    options: {
      companies: [],
      sites: [],
      departments: [],
      subDepartments: [],
      employees: [],
    },
    checklistTypes: [],
  },
  summary: {
    company: null,
    site: null,
    department: null,
    subDepartment: null,
    employee: null,
    checklist: null,
  },
  rows: [],
};

const renderSummaryMark = (value) => (
  <>
    <span className="dashboard-mark-line__label">Mark</span>
    <span className="dashboard-mark-line__value">
      {formatMarkValue(value ?? 0)}
    </span>
  </>
);

const formatOccurrenceDate = (value) => {
  if (!value) return "";

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return "";

  return parsedValue.toLocaleDateString("en-IN");
};

const buildFilterParams = (filters) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => String(value || "").trim() !== "")
  );

export default function Dashboard2Summary() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(defaultFilters);
  const [summaryData, setSummaryData] = useState(emptySummaryData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const res = await api.get("/dashboard/hierarchical-marks/summary", {
          params: buildFilterParams(filters),
        });
        setSummaryData({ ...emptySummaryData, ...(res.data || {}) });
      } catch (err) {
        console.error("Dashboard 2 summary load failed", err);
        setSummaryData(emptySummaryData);
        setLoadError(
          err.response?.data?.message ||
            "Dashboard 2 data could not be loaded. Please check that the backend server is running with the latest code."
        );
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [filters]);

  const updateFilter = (field, value) => {
    setFilters((currentValue) => {
      const nextValue = { ...currentValue, [field]: value };

      if (field === "company") {
        nextValue.site = "";
        nextValue.department = "";
        nextValue.subDepartment = "";
        nextValue.employee = "";
      }

      if (field === "site") {
        nextValue.department = "";
        nextValue.subDepartment = "";
        nextValue.employee = "";
      }

      if (field === "department") {
        nextValue.subDepartment = "";
        nextValue.employee = "";
      }

      if (field === "subDepartment") {
        nextValue.employee = "";
      }

      return nextValue;
    });
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const summaryCards = [
    summaryData.summary?.company,
    summaryData.summary?.site,
    summaryData.summary?.department,
    summaryData.summary?.subDepartment,
    summaryData.summary?.employee,
    summaryData.summary?.checklist,
  ].filter(Boolean);
  const filterOptions = summaryData.filters?.options || emptySummaryData.filters.options;
  const checklistTypes =
    summaryData.filters?.checklistTypes || emptySummaryData.filters.checklistTypes;

  return (
    <div className="container mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div className="page-kicker">Dashboard</div>
            <h4 className="mb-1">Marks Summary</h4>
            <p className="page-subtitle mb-0">
              Follow the hierarchy filters to narrow checklist marks from company level down to task
              level.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate("/welcome?preview=1")}
          >
            Back to Welcome
          </button>
        </div>
      </div>

      <div className="filter-card mb-4">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h6 className="mb-1">Hierarchical Marks Summary</h6>
              <small className="text-muted">
                Filter checklist task marks by company, site, department, sub-department,
                employee, date range, and checklist type.
              </small>
            </div>

            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>

          <div className="row g-3">
            <div className="col-12 col-md-6 col-xl-3">
              <FilterSelect
                label="Company"
                value={filters.company}
                options={filterOptions.companies}
                onChange={(value) => updateFilter("company", value)}
              />
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <FilterSelect
                label="Site"
                value={filters.site}
                options={filterOptions.sites}
                onChange={(value) => updateFilter("site", value)}
              />
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <FilterSelect
                label="Department"
                value={filters.department}
                options={filterOptions.departments}
                onChange={(value) => updateFilter("department", value)}
              />
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <FilterSelect
                label="Sub-Department"
                value={filters.subDepartment}
                options={filterOptions.subDepartments}
                onChange={(value) => updateFilter("subDepartment", value)}
              />
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <FilterSelect
                label="Employee"
                value={filters.employee}
                options={filterOptions.employees}
                onChange={(value) => updateFilter("employee", value)}
              />
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold small text-uppercase text-muted">
                From Date
              </label>
              <input
                type="date"
                className="form-control"
                value={filters.fromDate}
                onChange={(e) => updateFilter("fromDate", e.target.value)}
              />
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold small text-uppercase text-muted">
                To Date
              </label>
              <input
                type="date"
                className="form-control"
                value={filters.toDate}
                onChange={(e) => updateFilter("toDate", e.target.value)}
              />
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <FilterSelect
                label="Checklist Type"
                value={filters.checklistType}
                options={checklistTypes.map((item) => ({
                  _id: item.value,
                  label: item.label,
                  name: item.label,
                }))}
                onChange={(value) => updateFilter("checklistType", value)}
              />
            </div>
          </div>

          {loadError ? (
            <div className="alert alert-warning mt-3 mb-0">{loadError}</div>
          ) : null}
        </div>
      </div>

      <div className="row g-3 mb-4">
        {summaryCards.map((card) => (
          <div className="col-12 col-md-6 col-xl-4" key={card.label}>
            <SummaryCard card={card} />
          </div>
        ))}
      </div>

      <div className="table-shell">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h6 className="mb-1">Checklist Task Mark Table</h6>
              <small className="text-muted">
                Each task row shows the current company, site, department, sub-department,
                employee, and checklist task mark split.
              </small>
            </div>

            <div className="small text-muted">
              {summaryData.rows.length} row{summaryData.rows.length === 1 ? "" : "s"}
            </div>
          </div>

          {loading ? (
            <div className="text-muted">Loading hierarchical marks summary...</div>
          ) : summaryData.rows.length ? (
            <div className="table-responsive">
              <table className="table table-bordered align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Company Name</th>
                    <th>Company Mark</th>
                    <th>Site Name</th>
                    <th>Site Mark</th>
                    <th>Department Name</th>
                    <th>Department Mark</th>
                    <th>Sub-Department Name</th>
                    <th>Sub-Department Mark</th>
                    <th>Employee Name</th>
                    <th>Employee Mark</th>
                    <th>Checklist Task Name</th>
                    <th>Checklist Task Mark</th>
                  </tr>
                </thead>

                <tbody>
                  {summaryData.rows.map((row) => (
                    <tr key={row._id}>
                      <td>{row.companyName || "-"}</td>
                      <td className="fw-semibold text-primary">
                        {formatMarkValue(row.companyMark || 0)}
                      </td>
                      <td>{row.siteName || "-"}</td>
                      <td className="fw-semibold text-primary">
                        {formatMarkValue(row.siteMark || 0)}
                      </td>
                      <td>{row.departmentName || "-"}</td>
                      <td className="fw-semibold text-primary">
                        {row.departmentMark !== null && row.departmentMark !== undefined
                          ? formatMarkValue(row.departmentMark)
                          : "-"}
                      </td>
                      <td>{row.subDepartmentName || "-"}</td>
                      <td className="fw-semibold text-primary">
                        {row.subDepartmentMark !== null && row.subDepartmentMark !== undefined
                          ? formatMarkValue(row.subDepartmentMark)
                          : "-"}
                      </td>
                      <td>{row.employeeName || "-"}</td>
                      <td className="fw-semibold text-primary">
                        {formatMarkValue(row.employeeMark || 0)}
                      </td>
                      <td>
                        <div className="fw-semibold">{row.checklistTaskName || "-"}</div>
                        <div className="small text-muted">
                          {[row.checklistType || "-", formatOccurrenceDate(row.occurrenceDate)]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </td>
                      <td className="fw-semibold text-primary">
                        {formatMarkValue(row.checklistTaskMark || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="table-light">
                  <tr>
                    <td colSpan="8" className="text-end fw-semibold">
                      Totals
                    </td>
                    <td className="fw-semibold">Total Employee Mark</td>
                    <td className="fw-semibold text-primary">
                      {formatMarkValue(summaryData.summary?.employee?.totalMark || 0)}
                    </td>
                    <td className="fw-semibold">Total Checklist Mark</td>
                    <td className="fw-semibold text-primary">
                      {formatMarkValue(summaryData.summary?.checklist?.totalMark || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : loadError ? (
            <div className="text-muted">
              Dashboard 2 is waiting for the summary API. Once the backend route is available,
              the rows will appear here.
            </div>
          ) : (
            <div className="text-muted">
              No scored checklist task marks found for the selected filters.
            </div>
          )}
        </div>
      </div>

      <DashboardFeedbackWidget pageLabel="Marks Summary" />
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <>
      <label className="form-label fw-semibold small text-uppercase text-muted">{label}</label>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {(options || []).map((option) => (
          <option key={option._id} value={option._id}>
            {option.label || option.name || option._id}
          </option>
        ))}
      </select>
    </>
  );
}

function SummaryCard({ card }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="small text-muted text-uppercase fw-semibold mb-2">{card.label}</div>
        <div className="fw-semibold mb-2">{card.name || "-"}</div>
        <div className="dashboard-mark-line text-primary mt-2">{renderSummaryMark(card.totalMark)}</div>
      </div>
    </div>
  );
}
