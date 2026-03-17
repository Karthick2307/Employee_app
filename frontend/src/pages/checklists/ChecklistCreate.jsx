import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import {
  formatApprovalLabel,
  formatEmployeeLabel,
  formatPriorityLabel,
  formatScheduleLabel,
} from "../../utils/checklistDisplay";
import { getCustomRepeatSummary } from "../../utils/checklistRepeat";
import { formatDepartmentList } from "../../utils/departmentDisplay";

const defaultForm = {
  checklistNumber: "",
  checklistName: "",
  checklistMark: "1",
  checklistSourceSite: "",
  priority: "medium",
  assignedToEmployee: "",
  employeeAssignedSite: "",
  scheduleType: "daily",
  startDate: "",
  scheduleTime: "09:00",
  endDate: "",
  endTime: "18:00",
  customRepeatInterval: "1",
  customRepeatUnit: "daily",
  repeatDayOfMonth: "",
  repeatDayOfWeek: "",
  repeatMonthOfYear: "",
  approvalHierarchy: "default",
};

const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const customRepeatUnitOptions = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
  { value: "yearly", label: "Year" },
];

const monthOfYearOptions = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const toIndiaInputDate = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const shifted = new Date(date.getTime() + 330 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const createItemRow = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label: "",
  detail: "",
  isRequired: true,
});

const createApprovalRow = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  approvalEmployee: "",
});

const employeeHasSite = (employee, siteId) =>
  (employee?.sites || []).some((site) => String(site?._id || site) === String(siteId));

const getUniqueSites = (employees = []) => {
  const siteMap = new Map();

  employees.forEach((employee) => {
    (employee?.sites || []).forEach((site) => {
      const siteId = String(site?._id || site || "");
      if (!siteId || siteMap.has(siteId)) return;
      siteMap.set(siteId, site);
    });
  });

  return Array.from(siteMap.values());
};

const getChecklistSiteName = (site) => String(site?.name || "").trim();

export default function ChecklistCreate({ mode = "create" }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = mode === "edit" && Boolean(id);

  const [form, setForm] = useState(defaultForm);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [siteOptions, setSiteOptions] = useState([]);
  const [items, setItems] = useState([createItemRow()]);
  const [approvalRows, setApprovalRows] = useState([createApprovalRow()]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [numberLoading, setNumberLoading] = useState(false);
  const [showWorkflowMapping, setShowWorkflowMapping] = useState(false);
  const [workflowDepartment, setWorkflowDepartment] = useState("");
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowSelectedEmployeeIds, setWorkflowSelectedEmployeeIds] = useState([]);

  const selectedEmployee = useMemo(
    () =>
      employees.find((employee) => String(employee._id) === String(form.assignedToEmployee)) ||
      null,
    [employees, form.assignedToEmployee]
  );
  const filteredEmployees = useMemo(() => {
    if (!form.employeeAssignedSite) return employees;
    return employees.filter((employee) => employeeHasSite(employee, form.employeeAssignedSite));
  }, [employees, form.employeeAssignedSite]);
  const availableSites = useMemo(() => {
    if (selectedEmployee) {
      return Array.isArray(selectedEmployee.sites) ? selectedEmployee.sites : [];
    }

    return getUniqueSites(employees);
  }, [employees, selectedEmployee]);
  const defaultApprover = selectedEmployee?.superiorEmployee || null;
  const selectedSourceSite = useMemo(
    () =>
      siteOptions.find((site) => String(site._id) === String(form.checklistSourceSite)) || null,
    [form.checklistSourceSite, siteOptions]
  );
  const customScheduleSummary = useMemo(
    () =>
      getCustomRepeatSummary({
        customRepeatInterval: form.customRepeatInterval,
        customRepeatUnit: form.customRepeatUnit,
        repeatDayOfMonth: form.repeatDayOfMonth,
        repeatDayOfWeek: form.repeatDayOfWeek,
        repeatMonthOfYear: form.repeatMonthOfYear,
      }),
    [
      form.customRepeatInterval,
      form.customRepeatUnit,
      form.repeatDayOfMonth,
      form.repeatDayOfWeek,
      form.repeatMonthOfYear,
    ]
  );

  useEffect(() => {
    const loadPage = async () => {
      setPageLoading(true);

      try {
        const requests = [
          api.get("/employees", { params: { status: "active" } }),
          api.get("/departments"),
          api.get("/sites"),
        ];

        if (isEditMode) {
          requests.push(api.get(`/checklists/${id}`));
        }

        const [employeeRes, departmentRes, siteRes, checklistRes] = await Promise.all(requests);
        const employeeRows = Array.isArray(employeeRes.data) ? employeeRes.data : [];
        const departmentRows = Array.isArray(departmentRes.data) ? departmentRes.data : [];
        const siteRows = Array.isArray(siteRes.data) ? siteRes.data : [];

        setEmployees(employeeRows);
        setDepartments(departmentRows);
        setSiteOptions(siteRows);

        if (checklistRes?.data) {
          const checklist = checklistRes.data;

          setForm({
            checklistNumber: checklist.checklistNumber || "",
            checklistName: checklist.checklistName || "",
            checklistMark: String(checklist.checklistMark || 1),
            checklistSourceSite:
              checklist.checklistSourceSite?._id || checklist.checklistSourceSite || "",
            priority: checklist.priority || "medium",
            assignedToEmployee:
              checklist.assignedToEmployee?._id || checklist.assignedToEmployee || "",
            employeeAssignedSite:
              checklist.employeeAssignedSite?._id || checklist.employeeAssignedSite || "",
            scheduleType: checklist.scheduleType || "daily",
            startDate: toIndiaInputDate(checklist.startDate),
            scheduleTime: checklist.scheduleTime || "09:00",
            endDate: toIndiaInputDate(checklist.endDate || checklist.startDate),
            endTime: checklist.endTime || checklist.scheduleTime || "18:00",
            customRepeatInterval: String(checklist.customRepeatInterval || 1),
            customRepeatUnit: checklist.customRepeatUnit || "daily",
            repeatDayOfMonth: checklist.repeatDayOfMonth
              ? String(checklist.repeatDayOfMonth)
              : "",
            repeatDayOfWeek: checklist.repeatDayOfWeek || "",
            repeatMonthOfYear: checklist.repeatMonthOfYear
              ? String(checklist.repeatMonthOfYear)
              : "",
            approvalHierarchy: checklist.approvalHierarchy || "default",
          });

          const checklistItems = Array.isArray(checklist.checklistItems)
            ? checklist.checklistItems.map((item) => ({
                id: item._id || createItemRow().id,
                label: item.label || "",
                detail: item.detail || "",
                isRequired: item.isRequired !== false,
              }))
            : [];
          setItems(checklistItems.length ? checklistItems : [createItemRow()]);

          const checklistApprovals = Array.isArray(checklist.approvals)
            ? checklist.approvals.map((row) => ({
                id: `${row.approvalLevel}-${row.approvalEmployee?._id || row.approvalEmployee}`,
                approvalEmployee: row.approvalEmployee?._id || row.approvalEmployee || "",
              }))
            : [];
          setApprovalRows(checklistApprovals.length ? checklistApprovals : [createApprovalRow()]);
        }
      } catch (err) {
        console.error("Checklist form load failed:", err);
        alert(isEditMode ? "Failed to load checklist master" : "Failed to load checklist setup data");
      } finally {
        setPageLoading(false);
      }
    };

    void loadPage();
  }, [id, isEditMode]);

  useEffect(() => {
    if (!form.employeeAssignedSite || isEditMode) {
      if (!form.employeeAssignedSite && !isEditMode) {
        setForm((prev) => ({ ...prev, checklistNumber: "" }));
      }
      return;
    }

    const loadNumber = async () => {
      setNumberLoading(true);

      try {
        const response = await api.get("/checklists/next-number", {
          params: { employeeAssignedSite: form.employeeAssignedSite },
        });

        setForm((prev) => ({
          ...prev,
          checklistNumber: response.data?.checklistNumber || "",
        }));
      } catch (err) {
        console.error("Checklist number load failed:", err);
        setForm((prev) => ({ ...prev, checklistNumber: "" }));
      } finally {
        setNumberLoading(false);
      }
    };

    void loadNumber();
  }, [form.employeeAssignedSite, isEditMode]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    if (name === "assignedToEmployee") {
      const nextSelectedEmployee =
        employees.find((employee) => String(employee._id) === String(value)) || null;

      setForm((prev) => ({
        ...prev,
        assignedToEmployee: value,
        employeeAssignedSite:
          nextSelectedEmployee && employeeHasSite(nextSelectedEmployee, prev.employeeAssignedSite)
            ? prev.employeeAssignedSite
            : "",
        checklistNumber:
          isEditMode || (nextSelectedEmployee && employeeHasSite(nextSelectedEmployee, prev.employeeAssignedSite))
            ? prev.checklistNumber
            : "",
      }));
      return;
    }

    if (name === "employeeAssignedSite") {
      setForm((prev) => {
        const canKeepEmployee =
          !prev.assignedToEmployee ||
          filteredEmployees.some(
            (employee) => String(employee._id) === String(prev.assignedToEmployee)
          ) ||
          employees.some(
            (employee) =>
              String(employee._id) === String(prev.assignedToEmployee) &&
              employeeHasSite(employee, value)
          );

        return {
          ...prev,
          employeeAssignedSite: value,
          assignedToEmployee: canKeepEmployee ? prev.assignedToEmployee : "",
          checklistNumber: !isEditMode && !value ? "" : prev.checklistNumber,
        };
      });
      return;
    }

    if (name === "scheduleType") {
      setForm((prev) => ({
        ...prev,
        scheduleType: value,
        customRepeatInterval:
          value === "custom" ? prev.customRepeatInterval || "1" : prev.customRepeatInterval,
        customRepeatUnit:
          value === "custom" ? prev.customRepeatUnit || "daily" : prev.customRepeatUnit,
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateItem = (rowId, key, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === rowId ? { ...item, [key]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, createItemRow()]);
  };

  const removeItem = (rowId) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== rowId)));
  };

  const updateApprovalRow = (rowId, value) => {
    setApprovalRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, approvalEmployee: value } : row))
    );
  };

  const addApprovalRow = () => {
    setApprovalRows((prev) => [...prev, createApprovalRow()]);
  };

  const removeApprovalRow = (rowId) => {
    setApprovalRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== rowId)));
  };

  const openWorkflowMapping = () => {
    setWorkflowDepartment("");
    setWorkflowSearch("");
    setWorkflowSelectedEmployeeIds(
      approvalRows.map((row) => row.approvalEmployee).filter(Boolean)
    );
    setShowWorkflowMapping(true);
  };

  const closeWorkflowMapping = () => {
    setShowWorkflowMapping(false);
  };

  const toggleWorkflowEmployee = (employeeId) => {
    setWorkflowSelectedEmployeeIds((prev) => {
      const normalizedId = String(employeeId);

      if (prev.includes(normalizedId)) {
        return prev.filter((id) => id !== normalizedId);
      }

      return [...prev, normalizedId];
    });
  };

  const applyWorkflowMapping = () => {
    const nextIds = workflowSelectedEmployeeIds.filter(Boolean);

    if (!nextIds.length) {
      setApprovalRows([createApprovalRow()]);
      setShowWorkflowMapping(false);
      return;
    }

    setApprovalRows(
      nextIds.map((approvalEmployee) => ({
        id: `${Date.now()}-${approvalEmployee}`,
        approvalEmployee,
      }))
    );
    setShowWorkflowMapping(false);
  };

  const filteredWorkflowEmployees = employees
    .filter((employee) => String(employee._id) !== String(form.assignedToEmployee))
    .filter((employee) => {
      if (!workflowDepartment) return true;
      return (employee.departmentIds || []).some(
        (departmentId) => String(departmentId) === String(workflowDepartment)
      );
    })
    .filter((employee) => {
      if (!workflowSearch) return true;

      const searchValue = workflowSearch.toLowerCase();
      return [employee.employeeCode, employee.employeeName, employee.departmentDisplay]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchValue));
    });

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedItems = items
      .map((item) => ({
        label: item.label.trim(),
        detail: item.detail.trim(),
        isRequired: item.isRequired !== false,
      }))
      .filter((item) => item.label);

    if (!normalizedItems.length) {
      alert("Add at least one checklist item.");
      return;
    }

    const startWindow = new Date(`${form.startDate}T${form.scheduleTime}`);
    const endWindow = new Date(`${form.endDate}T${form.endTime}`);

    if (
      Number.isNaN(startWindow.getTime()) ||
      Number.isNaN(endWindow.getTime()) ||
      endWindow <= startWindow
    ) {
      alert("End date and end time must be later than start date and start task time.");
      return;
    }

    if (form.scheduleType === "custom") {
      const interval = Number(form.customRepeatInterval || 0);

      if (!form.customRepeatUnit || Number.isNaN(interval) || interval < 1) {
        alert("Custom schedule must include a valid repeat interval and unit.");
        return;
      }

      if (form.customRepeatUnit === "weekly" && !form.repeatDayOfWeek) {
        alert("Select a day of week for custom weekly schedule.");
        return;
      }

      if (
        form.customRepeatUnit === "monthly" &&
        (!form.repeatDayOfMonth ||
          Number(form.repeatDayOfMonth) < 1 ||
          Number(form.repeatDayOfMonth) > 31)
      ) {
        alert("Select a valid day of month for custom monthly schedule.");
        return;
      }

      if (
        form.customRepeatUnit === "yearly" &&
        (!form.repeatMonthOfYear ||
          Number(form.repeatMonthOfYear) < 1 ||
          Number(form.repeatMonthOfYear) > 12 ||
          !form.repeatDayOfMonth ||
          Number(form.repeatDayOfMonth) < 1 ||
          Number(form.repeatDayOfMonth) > 31)
      ) {
        alert("Select a valid month and day for custom yearly schedule.");
        return;
      }
    }

    if (form.approvalHierarchy === "default" && !defaultApprover) {
      alert(
        "Approval mapping is incomplete. Configure the employee's Superior Employee before using default approval."
      );
      return;
    }

    const normalizedApprovals =
      form.approvalHierarchy === "custom"
        ? approvalRows
            .map((row) => row.approvalEmployee)
            .filter(Boolean)
            .map((approvalEmployee, index) => ({
              approvalLevel: index + 1,
              approvalEmployee,
            }))
        : [];

    if (form.approvalHierarchy === "custom" && !normalizedApprovals.length) {
      alert("Select at least one approver for custom workflow mapping.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...form,
        checklistItems: normalizedItems,
        approvals: normalizedApprovals,
      };

      if (isEditMode) {
        await api.put(`/checklists/${id}`, payload);
      } else {
        await api.post("/checklists", payload);
      }

      navigate("/checklists");
    } catch (err) {
      console.error("Checklist save failed:", err);
      alert(
        err.response?.data?.message ||
          (isEditMode ? "Failed to update checklist master" : "Failed to create checklist master")
      );
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return <div className="container mt-4">Loading checklist form...</div>;
  }

  return (
    <div className="container mt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">{isEditMode ? "Edit Checklist Master" : "Create Checklist Master"}</h3>
          <div className="text-muted">
            Build the recurring checklist template that will generate employee tasks automatically.
          </div>
        </div>

        <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/checklists")}>
          Back
        </button>
      </div>

      <form className="card shadow-sm border-0" onSubmit={handleSubmit}>
        <div className="card-body">
          <div className="row g-4">
            <div className="col-12 col-xl-6">
              <div className="border rounded-4 p-4 bg-light h-100">
                <div className="mb-3">
                  <h5 className="mb-1">Master Setup</h5>
                  <div className="text-muted small">
                    Map the site, employee, schedule, and priority for this checklist master.
                  </div>
                </div>

                <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Assigned Site</label>
              <select
                className="form-select"
                name="employeeAssignedSite"
                value={form.employeeAssignedSite}
                onChange={handleFormChange}
                disabled={!availableSites.length}
                required
              >
                <option value="">Select Site</option>
                {availableSites.map((site) => (
                  <option key={site._id} value={site._id}>
                    {getChecklistSiteName(site)}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                Checklist number is generated from this site. Example: Head Office {"->"} HO - 001.
              </small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Assign To Employee</label>
              <select
                className="form-select"
                name="assignedToEmployee"
                value={form.assignedToEmployee}
                onChange={handleFormChange}
                required
              >
                <option value="">Select Employee</option>
                {filteredEmployees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {formatEmployeeLabel(employee)}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                {form.employeeAssignedSite
                  ? "Only employees mapped to the selected site are shown."
                  : "All active employees are shown until a site is selected."}
              </small>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold">Checklist Number</label>
              <input className="form-control" value={form.checklistNumber} readOnly />
              <small className="text-muted">
                {numberLoading
                  ? "Generating checklist number..."
                  : "Generated from selected assigned site"}
              </small>
            </div>

            <div className="col-md-8">
              <label className="form-label fw-semibold">Checklist Name</label>
              <input
                className="form-control"
                name="checklistName"
                value={form.checklistName}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Checklist Mark</label>
              <input
                type="number"
                min="1"
                max="10"
                step="1"
                className="form-control"
                name="checklistMark"
                value={form.checklistMark}
                onChange={handleFormChange}
                required
              />
              <small className="text-muted">Define the score for one checklist from 1 to 10.</small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Checklist Source Site</label>
              <select
                className="form-select"
                name="checklistSourceSite"
                value={form.checklistSourceSite}
                onChange={handleFormChange}
                disabled={!siteOptions.length}
              >
                <option value="">Select Source Site</option>
                {siteOptions.map((site) => (
                  <option key={site._id} value={site._id}>
                    {getChecklistSiteName(site)}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                Optional. Site names match the same list format shown on employee screens.
              </small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Schedule Type</label>
              <select
                className="form-select"
                name="scheduleType"
                value={form.scheduleType}
                onChange={handleFormChange}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Start Date</label>
              <input
                type="date"
                className="form-control"
                name="startDate"
                value={form.startDate}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Start Task Time</label>
              <input
                type="time"
                className="form-control"
                name="scheduleTime"
                value={form.scheduleTime}
                onChange={handleFormChange}
                required
              />
              <small className="text-muted">
                Tasks auto-post from Schedule Type, Start Date, and Task Time using India time (IST).
              </small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">End Date</label>
              <input
                type="date"
                className="form-control"
                name="endDate"
                value={form.endDate}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">End Time</label>
              <input
                type="time"
                className="form-control"
                name="endTime"
                value={form.endTime}
                onChange={handleFormChange}
                required
              />
              <small className="text-muted">
                Reports use the end date and end time to mark each task as On Time, Delay, or Advanced.
              </small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Priority</label>
              <select
                className="form-select"
                name="priority"
                value={form.priority}
                onChange={handleFormChange}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <small className="text-muted">
                Task lists use this priority to highlight urgency with color.
              </small>
            </div>

            {form.scheduleType === "custom" && (
              <>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Custom Interval</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    name="customRepeatInterval"
                    value={form.customRepeatInterval}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Custom Unit</label>
                  <select
                    className="form-select"
                    name="customRepeatUnit"
                    value={form.customRepeatUnit}
                    onChange={handleFormChange}
                  >
                    {customRepeatUnitOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {form.customRepeatUnit === "weekly" && (
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Day of Week</label>
                    <select
                      className="form-select"
                      name="repeatDayOfWeek"
                      value={form.repeatDayOfWeek}
                      onChange={handleFormChange}
                    >
                      <option value="">Select Day</option>
                      {weekDays.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {form.customRepeatUnit === "monthly" && (
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Day of Month</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      className="form-control"
                      name="repeatDayOfMonth"
                      value={form.repeatDayOfMonth}
                      onChange={handleFormChange}
                    />
                  </div>
                )}

                {form.customRepeatUnit === "yearly" && (
                  <>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Month</label>
                      <select
                        className="form-select"
                        name="repeatMonthOfYear"
                        value={form.repeatMonthOfYear}
                        onChange={handleFormChange}
                      >
                        <option value="">Select Month</option>
                        {monthOfYearOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Day of Month</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="form-control"
                        name="repeatDayOfMonth"
                        value={form.repeatDayOfMonth}
                        onChange={handleFormChange}
                      />
                    </div>
                  </>
                )}

                <div className="col-12">
                  <div className="alert alert-info mb-0">
                    Custom repeat summary: {customScheduleSummary}
                  </div>
                </div>
              </>
            )}

                </div>
              </div>
            </div>

            <div className="col-12 col-xl-6">
              <div className="d-flex flex-column gap-4">
                <div className="border rounded-4 p-4 bg-light">
                  <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-3">
            <div>
              <h5 className="mb-1">Checklist Items</h5>
              <div className="text-muted small">
                These items are copied into every generated employee task.
              </div>
            </div>

            <button type="button" className="btn btn-sm btn-success" onClick={addItem}>
              + Add Item
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "30%" }}>Item</th>
                  <th>Detail</th>
                  <th style={{ width: "130px" }}>Required</th>
                  <th style={{ width: "90px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        className="form-control"
                        value={item.label}
                        onChange={(event) => updateItem(item.id, "label", event.target.value)}
                        placeholder="Item label"
                      />
                    </td>
                    <td>
                      <input
                        className="form-control"
                        value={item.detail}
                        onChange={(event) => updateItem(item.id, "detail", event.target.value)}
                        placeholder="How should the employee verify this item?"
                      />
                    </td>
                    <td>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={item.isRequired}
                          onChange={(event) =>
                            updateItem(item.id, "isRequired", event.target.checked)
                          }
                        />
                        <label className="form-check-label">Mandatory</label>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeItem(item.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
                </div>

                <div className="border rounded-4 p-4 bg-light">
                  <div className="mb-3">
            <h5 className="mb-1">Approval / Workflow Mapping</h5>
            <div className="text-muted small">
              After submission, the generated task moves only to the mapped approver chain.
            </div>
          </div>

          <div className="d-flex gap-3 mb-3">
            {["default", "custom"].map((option) => (
              <label className="form-check" key={option}>
                <input
                  className="form-check-input"
                  type="radio"
                  name="approvalHierarchy"
                  value={option}
                  checked={form.approvalHierarchy === option}
                  onChange={handleFormChange}
                />
                <span className="form-check-label text-capitalize">{option}</span>
              </label>
            ))}
          </div>

          {form.approvalHierarchy === "default" ? (
            <div className={`alert ${defaultApprover ? "alert-info" : "alert-warning"} mb-0`}>
              {defaultApprover
                ? `Default Department Head mapping: ${formatEmployeeLabel(defaultApprover)}`
                : "No Superior Employee mapping found for the selected employee. Configure it first to use default approval."}
            </div>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="small text-muted">
                  Custom workflow mapping overrides the employee's default Department Head.
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={openWorkflowMapping}
                  >
                    Workflow Mapping
                  </button>
                  <button type="button" className="btn btn-sm btn-success" onClick={addApprovalRow}>
                    + Add Approver
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "120px" }}>Level</th>
                      <th>Approver Employee</th>
                      <th style={{ width: "90px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>
                        <td>
                          <select
                            className="form-select"
                            value={row.approvalEmployee}
                            onChange={(event) => updateApprovalRow(row.id, event.target.value)}
                          >
                            <option value="">Select Approver</option>
                            {employees
                              .filter(
                                (employee) =>
                                  String(employee._id) !== String(form.assignedToEmployee)
                              )
                              .map((employee) => (
                                <option key={employee._id} value={employee._id}>
                                  {formatEmployeeLabel(employee)}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeApprovalRow(row.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="small text-muted mt-2">
                Use <span className="fw-semibold">Workflow Mapping</span> to pick approvers by
                department, then fine-tune the level order in the table if needed.
              </div>
            </>
          )}

                  {selectedEmployee && (
                    <div className="border rounded-4 p-4 bg-light">
                      <div className="fw-semibold mb-1">Assignment Summary</div>
                      <div className="small text-muted">
                        Employee: {formatEmployeeLabel(selectedEmployee)}
                      </div>
                      <div className="small text-muted">
                        Schedule: {formatScheduleLabel(form)} starting {form.startDate || "-"} at{" "}
                        {form.scheduleTime || "-"}
                      </div>
                      <div className="small text-muted">
                        End Window: {form.endDate || "-"} at {form.endTime || "-"}
                      </div>
                      <div className="small text-muted">
                        Priority: {formatPriorityLabel(form.priority)}
                      </div>
                      <div className="small text-muted">Checklist Mark: {form.checklistMark || "1"}</div>
                      <div className="small text-muted">
                        Source Site: {getChecklistSiteName(selectedSourceSite) || "-"}
                      </div>
                      <div className="small text-muted">
                        Approval Flow:{" "}
                        {form.approvalHierarchy === "default"
                          ? defaultApprover
                            ? formatEmployeeLabel(defaultApprover)
                            : "Not configured"
                          : formatApprovalLabel({
                              approvals: approvalRows
                                .filter((row) => row.approvalEmployee)
                                .map((row, index) => ({
                                  approvalLevel: index + 1,
                                  approvalEmployee:
                                    employees.find(
                                      (employee) =>
                                        String(employee._id) === String(row.approvalEmployee)
                                    ) || null,
                                })),
                            })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-footer bg-white d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate("/checklists")}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
              ? "Update Checklist Master"
              : "Create Checklist Master"}
          </button>
        </div>
      </form>

      {showWorkflowMapping && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-1">Workflow Mapping</h5>
                  <div className="small text-muted">
                    Select the approver employees who should receive this checklist after submission.
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={closeWorkflowMapping} />
              </div>

              <div className="modal-body">
                <div className="row g-3 mb-3">
                  <div className="col-md-5">
                    <label className="form-label fw-semibold">Department</label>
                    <select
                      className="form-select"
                      value={workflowDepartment}
                      onChange={(event) => setWorkflowDepartment(event.target.value)}
                    >
                      <option value="">All Departments</option>
                      {departments.map((department) => (
                        <option key={department._id} value={department._id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-7">
                    <label className="form-label fw-semibold">Search</label>
                    <input
                      className="form-control"
                      placeholder="Search employee code, name, or department"
                      value={workflowSearch}
                      onChange={(event) => setWorkflowSearch(event.target.value)}
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="small text-muted">
                    Selected approvers: {workflowSelectedEmployeeIds.length}
                  </div>
                </div>

                <div className="border rounded p-2" style={{ maxHeight: "320px", overflowY: "auto" }}>
                  {filteredWorkflowEmployees.length === 0 ? (
                    <div className="text-muted">No employees found for the selected workflow filters.</div>
                  ) : (
                    filteredWorkflowEmployees.map((employee) => {
                      const employeeId = String(employee._id);
                      const isChecked = workflowSelectedEmployeeIds.includes(employeeId);

                      return (
                        <label className="form-check d-flex gap-2 mb-3" key={employeeId}>
                          <input
                            className="form-check-input mt-1"
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleWorkflowEmployee(employeeId)}
                          />
                          <span>
                            <span className="fw-semibold">{formatEmployeeLabel(employee)}</span>
                            <br />
                            <small className="text-muted">
                              {employee.departmentDisplay ||
                                formatDepartmentList(employee.departmentDetails || employee.department) ||
                                "No department"}
                            </small>
                            <br />
                            <small className="text-muted">
                              {employee.subDepartmentDisplay ||
                                employee.subDepartmentPath ||
                                employee.subDepartmentName ||
                                "No sub department"}
                            </small>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={closeWorkflowMapping}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={applyWorkflowMapping}>
                  Apply Workflow Mapping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
