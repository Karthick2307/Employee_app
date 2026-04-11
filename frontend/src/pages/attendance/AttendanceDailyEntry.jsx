import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../api/axios";
import { usePermissions } from "../../context/PermissionContext";
import {
  ATTENDANCE_STATUS_OPTIONS,
  buildAttendanceQueryParams,
  formatAttendanceDuration,
  getAttendanceStatusBadgeClass,
  getTodayDateInputValue,
} from "../../utils/attendance";

const defaultFilters = {
  date: getTodayDateInputValue(),
  search: "",
  companyName: "",
  siteId: "",
  departmentId: "",
  subDepartmentId: "",
  employeeId: "",
  status: "",
};

const emptyForm = {
  recordId: "",
  employeeId: "",
  attendanceDate: getTodayDateInputValue(),
  checkInTime: "",
  checkOutTime: "",
  status: "present",
  remarks: "",
  companyName: "",
  siteId: "",
  departmentId: "",
  subDepartmentId: "",
};

export default function AttendanceDailyEntry() {
  const { can, user } = usePermissions();
  const canSaveAttendance = can("employee_attendance", "add");
  const canEditAttendance = can("employee_attendance", "edit");
  const [options, setOptions] = useState({
    companies: [],
    sites: [],
    departments: [],
    subDepartments: [],
    employees: [],
  });
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  if (user?.principalType === "employee") {
    return <Navigate to="/attendance/self" replace />;
  }

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await api.get("/attendance/options");
        setOptions({
          companies: Array.isArray(response.data?.companies) ? response.data.companies : [],
          sites: Array.isArray(response.data?.sites) ? response.data.sites : [],
          departments: Array.isArray(response.data?.departments) ? response.data.departments : [],
          subDepartments: Array.isArray(response.data?.subDepartments)
            ? response.data.subDepartments
            : [],
          employees: Array.isArray(response.data?.employees) ? response.data.employees : [],
        });
      } catch (error) {
        console.error("Attendance option load failed:", error);
      }
    };

    void loadOptions();
  }, []);

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);

      try {
        const response = await api.get("/attendance/records", {
          params: buildAttendanceQueryParams({
            ...appliedFilters,
            includeMissing: true,
          }),
        });
        setRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
      } catch (error) {
        console.error("Attendance daily entry load failed:", error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void loadRows();
  }, [appliedFilters]);

  const filteredSites = useMemo(() => {
    if (!form.companyName) return options.sites;
    return options.sites.filter((site) => site.companyName === form.companyName);
  }, [form.companyName, options.sites]);

  const filteredSubDepartments = useMemo(() => {
    if (!form.departmentId) return options.subDepartments;
    return options.subDepartments.filter(
      (subDepartment) => subDepartment.departmentId === form.departmentId
    );
  }, [form.departmentId, options.subDepartments]);

  const selectableEmployees = useMemo(
    () =>
      options.employees.filter((employee) => {
        if (filters.companyName && !employee.companyNames.includes(filters.companyName)) {
          return false;
        }
        if (filters.siteId && !employee.sites.includes(filters.siteId)) return false;
        if (filters.departmentId && !employee.departments.includes(filters.departmentId)) {
          return false;
        }
        if (filters.subDepartmentId && !employee.subDepartments.includes(filters.subDepartmentId)) {
          return false;
        }
        return true;
      }),
    [filters.departmentId, filters.siteId, filters.subDepartmentId, options.employees]
  );

  const loadRowsAgain = () => {
    setAppliedFilters((current) => ({ ...current }));
  };

  const startNewEntry = () => {
    setForm({
      ...emptyForm,
      attendanceDate: filters.date,
      companyName: filters.companyName || "",
      siteId: filters.siteId || "",
      departmentId: filters.departmentId || "",
      subDepartmentId: filters.subDepartmentId || "",
    });
  };

  const selectRow = (row) => {
    setForm({
      recordId: row.isSynthetic ? "" : row._id,
      employeeId: row.employeeId,
      attendanceDate: row.attendanceDateKey || filters.date,
      checkInTime: row.checkInTime
        ? new Date(row.checkInTime).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",
      checkOutTime: row.checkOutTime
        ? new Date(row.checkOutTime).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",
      status: row.status || "present",
      remarks: row.remarks || "",
      companyName: row.companyName || "",
      siteId: row.siteId || "",
      departmentId: row.departmentId || "",
      subDepartmentId: row.subDepartmentId || "",
    });
  };

  const handleSave = async () => {
    if (!form.employeeId) {
      alert("Select an employee before saving attendance");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        employeeId: form.employeeId,
        attendanceDate: form.attendanceDate,
        checkInTime: form.checkInTime || null,
        checkOutTime: form.checkOutTime || null,
        status: form.status,
        remarks: form.remarks,
        siteId: form.siteId || null,
        departmentId: form.departmentId || null,
        subDepartmentId: form.subDepartmentId || null,
      };

      if (form.recordId) {
        await api.put(`/attendance/records/${form.recordId}`, payload);
      } else {
        await api.post("/attendance/records", payload);
      }

      alert("Attendance saved successfully");
      startNewEntry();
      loadRowsAgain();
    } catch (error) {
      console.error("Attendance save failed:", error);
      alert(error.response?.data?.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="text-uppercase small fw-semibold text-muted">Attendance</div>
          <h2 className="mb-2">Daily Attendance Entry</h2>
          <div className="text-muted">
            Enter, update, and review one attendance row per employee per day.
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Attendance Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.date}
                onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Company</label>
              <select
                className="form-select"
                value={filters.companyName}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    companyName: event.target.value,
                    siteId: "",
                  }))
                }
              >
                <option value="">All Companies</option>
                {options.companies.map((company) => (
                  <option key={company.value} value={company.value}>
                    {company.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Site</label>
              <select
                className="form-select"
                value={filters.siteId}
                onChange={(event) => setFilters((current) => ({ ...current, siteId: event.target.value }))}
              >
                <option value="">All Sites</option>
                {options.sites
                  .filter((site) => !filters.companyName || site.companyName === filters.companyName)
                  .map((site) => (
                    <option key={site.value} value={site.value}>
                      {site.label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Department</label>
              <select
                className="form-select"
                value={filters.departmentId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    departmentId: event.target.value,
                    subDepartmentId: "",
                  }))
                }
              >
                <option value="">All Departments</option>
                {options.departments.map((department) => (
                  <option key={department.value} value={department.value}>
                    {department.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Sub Department</label>
              <select
                className="form-select"
                value={filters.subDepartmentId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, subDepartmentId: event.target.value }))
                }
              >
                <option value="">All Sub Departments</option>
                {options.subDepartments
                  .filter(
                    (subDepartment) =>
                      !filters.departmentId || subDepartment.departmentId === filters.departmentId
                  )
                  .map((subDepartment) => (
                    <option key={subDepartment.value} value={subDepartment.value}>
                      {subDepartment.label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">All Statuses</option>
                {ATTENDANCE_STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-4">
              <label className="form-label">Search</label>
              <input
                className="form-control"
                placeholder="Employee, site, department"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAppliedFilters({ ...filters })}
            >
              Apply Filters
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={startNewEntry}>
              New Entry
            </button>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Manual Attendance Form</h5>
            <div className="text-muted small">
              Admin / HR can record or correct attendance for the selected day.
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-md-6 col-xl-4">
              <label className="form-label">Employee</label>
              <select
                className="form-select"
                value={form.employeeId}
                onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
              >
                <option value="">Select Employee</option>
                {selectableEmployees.map((employee) => (
                  <option key={employee.value} value={employee.value}>
                    {employee.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                value={form.attendanceDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, attendanceDate: event.target.value }))
                }
              />
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label">Check In</label>
              <input
                type="time"
                className="form-control"
                value={form.checkInTime}
                onChange={(event) => setForm((current) => ({ ...current, checkInTime: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label">Check Out</label>
              <input
                type="time"
                className="form-control"
                value={form.checkOutTime}
                onChange={(event) => setForm((current) => ({ ...current, checkOutTime: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              >
                {ATTENDANCE_STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label">Site</label>
              <select
                className="form-select"
                value={form.siteId}
                onChange={(event) => setForm((current) => ({ ...current, siteId: event.target.value }))}
              >
                <option value="">Default Employee Site</option>
                {filteredSites.map((site) => (
                  <option key={site.value} value={site.value}>
                    {site.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label">Department</label>
              <select
                className="form-select"
                value={form.departmentId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    departmentId: event.target.value,
                    subDepartmentId: "",
                  }))
                }
              >
                <option value="">Default Employee Department</option>
                {options.departments.map((department) => (
                  <option key={department.value} value={department.value}>
                    {department.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label">Sub Department</label>
              <select
                className="form-select"
                value={form.subDepartmentId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, subDepartmentId: event.target.value }))
                }
              >
                <option value="">Default Employee Sub Department</option>
                {filteredSubDepartments.map((subDepartment) => (
                  <option key={subDepartment.value} value={subDepartment.value}>
                    {subDepartment.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-xl-3">
              <label className="form-label">Remarks</label>
              <input
                className="form-control"
                placeholder="Manual note"
                value={form.remarks}
                onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
              />
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !(canSaveAttendance || canEditAttendance)}
            >
              {saving ? "Saving..." : "Save Attendance"}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={startNewEntry}>
              Reset Form
            </button>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Attendance Rows</h5>
            <div className="text-muted small">{rows.length} rows</div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Working Hours</th>
                  <th>Late Minutes</th>
                  <th>Site</th>
                  <th>Department</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center">
                      Loading attendance rows...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center text-muted">
                      No attendance rows found for the selected date and filters
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row._id}>
                      <td>{row.employeeDisplayName}</td>
                      <td>
                        <span
                          className={`badge ${getAttendanceStatusBadgeClass(
                            row.status,
                            row.isLate
                          )}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td>{row.checkInLabel || "-"}</td>
                      <td>{row.checkOutLabel || "-"}</td>
                      <td>{row.totalWorkingHoursLabel || formatAttendanceDuration(row.totalWorkingMinutes)}</td>
                      <td>{Number(row.lateMinutes || 0)}</td>
                      <td>{row.siteDisplayName || "-"}</td>
                      <td>{row.departmentName || "-"}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => selectRow(row)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
