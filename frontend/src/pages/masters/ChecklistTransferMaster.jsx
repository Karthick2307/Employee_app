import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import SearchableCheckboxSelector from "../../components/SearchableCheckboxSelector";
import { formatDate, formatDateTime, formatScheduleLabel } from "../../utils/checklistDisplay";

const initialFormState = {
  fromEmployeeId: "",
  toEmployeeId: "",
  fromDate: "",
  toDate: "",
};

const getEmployeeLabel = (employee) => {
  const employeeCode = String(employee?.employeeCode || "").trim();
  const employeeName = String(employee?.employeeName || "").trim();

  if (employeeCode && employeeName) return `${employeeCode} - ${employeeName}`;
  return employeeCode || employeeName || "Unknown Employee";
};

const formatSiteLabel = (site) => {
  if (!site) return "";

  const companyName = String(site.companyName || "").trim();
  const name = String(site.name || "").trim();

  if (companyName && name) return `${companyName} - ${name}`;
  return name || companyName;
};

const isActiveEmployee = (employee) => employee?.isActive !== false;

const getHistoryEmployeeLabel = (historyRow, side) => {
  const employee =
    side === "from" ? historyRow?.fromEmployee : historyRow?.toEmployee;
  const code =
    side === "from"
      ? String(historyRow?.fromEmployeeCode || "").trim()
      : String(historyRow?.toEmployeeCode || "").trim();
  const name =
    side === "from"
      ? String(historyRow?.fromEmployeeName || "").trim()
      : String(historyRow?.toEmployeeName || "").trim();

  if (employee?.employeeCode || employee?.employeeName) {
    return getEmployeeLabel(employee);
  }

  if (code && name) return `${code} - ${name}`;
  return code || name || "-";
};

const getTransferredByLabel = (historyRow) => {
  const userName = String(historyRow?.transferredBy?.name || "").trim();
  const email =
    String(historyRow?.transferredBy?.email || "").trim() ||
    String(historyRow?.transferredByEmail || "").trim();

  if (userName && email) return `${userName} (${email})`;
  return userName || email || "-";
};

const getTransferTypeLabel = (transferType) =>
  String(transferType || "").trim().toLowerCase() === "temporary"
    ? "Temporary"
    : "Permanent";

const getHistoryTransferStatusLabel = (historyRow) => {
  if (String(historyRow?.transferType || "").trim().toLowerCase() !== "temporary") {
    return "Completed";
  }

  const normalizedStatus = String(historyRow?.transferStatus || "").trim().toLowerCase();
  if (normalizedStatus === "active") return "Active";
  if (normalizedStatus === "pending") return "Pending";
  return "Completed";
};

const getHistoryTransferDateRangeLabel = (historyRow) => {
  if (String(historyRow?.transferType || "").trim().toLowerCase() !== "temporary") {
    return "-";
  }

  const fromDateLabel = formatDate(historyRow?.transferStartDate);
  const toDateLabel = formatDate(historyRow?.transferEndDate);

  if (fromDateLabel === "-" && toDateLabel === "-") return "-";
  return `${fromDateLabel} to ${toDateLabel}`;
};

const buildChecklistOption = (checklist) => {
  const labelBase =
    [checklist?.checklistNumber, checklist?.checklistName].filter(Boolean).join(" - ") ||
    checklist?.checklistName ||
    "Checklist";
  const description = [
    formatSiteLabel(checklist?.employeeAssignedSite),
    formatScheduleLabel(checklist),
    checklist?.status ? "Active" : "Inactive",
    checklist?.approvalHierarchy
      ? `${String(checklist.approvalHierarchy).trim()} approval`
      : "",
    checklist?.nextOccurrenceAt
      ? `Next task ${formatDateTime(checklist.nextOccurrenceAt)}`
      : "No next task scheduled",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    value: checklist?._id,
    label: labelBase,
    description,
  };
};

const buildTransferConfirmationMessage = ({
  transferType,
  count,
  fromEmployeeLabel,
  toEmployeeLabel,
  fromDate,
  toDate,
  requiresApproval = false,
}) =>
  [
    `${
      transferType === "temporary" ? "Temporarily" : "Permanently"
    } transfer ${count} checklist${count === 1 ? "" : "s"}?`,
    "",
    `From Employee: ${fromEmployeeLabel}`,
    `To Employee: ${toEmployeeLabel}`,
    ...(transferType === "temporary"
      ? [`From Date: ${fromDate || "-"}`, `To Date: ${toDate || "-"}`]
      : []),
    "",
    requiresApproval
      ? transferType === "temporary"
        ? "This will submit a temporary transfer request for admin approval. No checklist assignment will change until that approval is completed."
        : "This will submit a permanent transfer request for admin approval. No checklist assignment will change until that approval is completed."
      : transferType === "temporary"
      ? "This will temporarily move the selected checklist masters and their active checklist tasks for the selected date range, then automatically revert them to the original employee."
      : "This will update the checklist master assignment, move the selected checklist tasks to the new employee, and save transfer history.",
  ].join("\n");

export default function ChecklistTransferMaster() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserRole = String(currentUser?.role || "").trim().toLowerCase();
  const isAdminChecklistUser = currentUserRole === "admin";
  const usesApprovalRequestFlow = !isAdminChecklistUser;
  const [activeOption, setActiveOption] = useState("");
  const [form, setForm] = useState(initialFormState);
  const [employees, setEmployees] = useState([]);
  const [eligibleToEmployees, setEligibleToEmployees] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((left, right) => {
        const activeRank = Number(isActiveEmployee(right)) - Number(isActiveEmployee(left));
        if (activeRank !== 0) return activeRank;
        return getEmployeeLabel(left).localeCompare(getEmployeeLabel(right));
      }),
    [employees]
  );

  const selectedFromEmployee = useMemo(
    () =>
      sortedEmployees.find(
        (employee) => String(employee._id) === String(form.fromEmployeeId)
      ) || null,
    [form.fromEmployeeId, sortedEmployees]
  );

  const sortedEligibleToEmployees = useMemo(
    () =>
      [...eligibleToEmployees].sort((left, right) => {
        const activeRank = Number(isActiveEmployee(right)) - Number(isActiveEmployee(left));
        if (activeRank !== 0) return activeRank;
        return getEmployeeLabel(left).localeCompare(getEmployeeLabel(right));
      }),
    [eligibleToEmployees]
  );

  const selectedToEmployee = useMemo(
    () =>
      sortedEligibleToEmployees.find(
        (employee) => String(employee._id) === String(form.toEmployeeId)
      ) || null,
    [form.toEmployeeId, sortedEligibleToEmployees]
  );

  const toEmployeeOptions = useMemo(
    () =>
      sortedEligibleToEmployees.filter(
        (employee) =>
          isActiveEmployee(employee) &&
          String(employee._id) !== String(form.fromEmployeeId || "")
      ),
    [form.fromEmployeeId, sortedEligibleToEmployees]
  );

  const fromEmployeeSiteLabel = useMemo(() => {
    if (!selectedFromEmployee) return "No site assigned";

    if (Array.isArray(selectedFromEmployee.siteLabels) && selectedFromEmployee.siteLabels.length) {
      return selectedFromEmployee.siteLabels.join(", ");
    }

    if (Array.isArray(selectedFromEmployee.sites) && selectedFromEmployee.sites.length) {
      return selectedFromEmployee.sites.map((site) => formatSiteLabel(site)).filter(Boolean).join(", ");
    }

    return "No site assigned";
  }, [selectedFromEmployee]);

  const fromEmployeeDepartmentLabel = useMemo(() => {
    if (!selectedFromEmployee) return "No department assigned";

    if (String(selectedFromEmployee.departmentDisplay || "").trim()) {
      return selectedFromEmployee.departmentDisplay;
    }

    if (
      Array.isArray(selectedFromEmployee.departmentNames) &&
      selectedFromEmployee.departmentNames.length
    ) {
      return selectedFromEmployee.departmentNames.join(", ");
    }

    if (
      Array.isArray(selectedFromEmployee.departmentDetails) &&
      selectedFromEmployee.departmentDetails.length
    ) {
      return selectedFromEmployee.departmentDetails
        .map((department) => String(department?.name || "").trim())
        .filter(Boolean)
        .join(", ");
    }

    return "No department assigned";
  }, [selectedFromEmployee]);

  const checklistOptions = useMemo(
    () => checklists.map((checklist) => buildChecklistOption(checklist)),
    [checklists]
  );

  const allChecklistIds = useMemo(
    () => checklistOptions.map((option) => String(option.value)),
    [checklistOptions]
  );

  const allChecklistsSelected =
    allChecklistIds.length > 0 &&
    allChecklistIds.every((checklistId) => selectedChecklistIds.includes(checklistId));
  const isPermanentTransfer = activeOption === "permanent";
  const isTemporaryTransfer = activeOption === "temporary";
  const hasInvalidTemporaryDateRange =
    Boolean(form.fromDate) && Boolean(form.toDate) && form.fromDate > form.toDate;

  useEffect(() => {
    const loadPage = async () => {
      setPageLoading(true);
      setHistoryLoading(true);
      setError("");

      try {
        const [employeeResponse, historyResponse] = await Promise.all([
          api.get("/employees"),
          api.get("/checklists/transfers/history", {
            params: { limit: 25 },
          }),
        ]);

        setEmployees(Array.isArray(employeeResponse.data) ? employeeResponse.data : []);
        setHistoryRows(Array.isArray(historyResponse.data) ? historyResponse.data : []);
      } catch (err) {
        console.error("Checklist transfer page load failed:", err);
        setEmployees([]);
        setHistoryRows([]);
        setError(err.response?.data?.message || "Failed to load checklist transfer setup.");
      } finally {
        setPageLoading(false);
        setHistoryLoading(false);
      }
    };

    void loadPage();
  }, []);

  useEffect(() => {
    if (!form.fromEmployeeId) {
      setEligibleToEmployees([]);
      setChecklists([]);
      setSelectedChecklistIds([]);
      return;
    }

    const loadChecklists = async () => {
      setChecklistLoading(true);
      setError("");
      setSuccess("");

      try {
        const response = await api.get("/checklists/transfers/checklists", {
          params: { fromEmployeeId: form.fromEmployeeId },
        });

        const nextChecklists = Array.isArray(response.data?.checklists)
          ? response.data.checklists
          : [];
        const nextEligibleEmployees = Array.isArray(response.data?.toEmployees)
          ? response.data.toEmployees
          : [];

        setEligibleToEmployees(nextEligibleEmployees);
        setChecklists(nextChecklists);
        setSelectedChecklistIds([]);
      } catch (err) {
        console.error("Checklist transfer checklist load failed:", err);
        setEligibleToEmployees([]);
        setChecklists([]);
        setSelectedChecklistIds([]);
        setError(
          err.response?.data?.message || "Failed to load checklists for the selected employee."
        );
      } finally {
        setChecklistLoading(false);
      }
    };

    void loadChecklists();
  }, [form.fromEmployeeId]);

  useEffect(() => {
    if (!form.toEmployeeId) return;

    const isValidToEmployee = toEmployeeOptions.some(
      (employee) => String(employee._id) === String(form.toEmployeeId)
    );

    if (!isValidToEmployee) {
      setForm((currentValue) => ({
        ...currentValue,
        toEmployeeId: "",
      }));
      setSelectedChecklistIds([]);
    }
  }, [form.toEmployeeId, toEmployeeOptions]);

  const refreshHistory = async () => {
    setHistoryLoading(true);

    try {
      const response = await api.get("/checklists/transfers/history", {
        params: { limit: 25 },
      });
      setHistoryRows(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Checklist transfer history refresh failed:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshSelectedEmployeeChecklists = async (fromEmployeeId) => {
    if (!fromEmployeeId) {
      setEligibleToEmployees([]);
      setChecklists([]);
      setSelectedChecklistIds([]);
      return;
    }

    setChecklistLoading(true);

    try {
      const response = await api.get("/checklists/transfers/checklists", {
        params: { fromEmployeeId },
      });

      const nextChecklists = Array.isArray(response.data?.checklists)
        ? response.data.checklists
        : [];
      const nextEligibleEmployees = Array.isArray(response.data?.toEmployees)
        ? response.data.toEmployees
        : [];

      setEligibleToEmployees(nextEligibleEmployees);
      setChecklists(nextChecklists);
      setSelectedChecklistIds([]);
    } catch (err) {
      console.error("Checklist transfer checklist refresh failed:", err);
      setEligibleToEmployees([]);
      setChecklists([]);
      setSelectedChecklistIds([]);
      setError(
        err.response?.data?.message || "Failed to refresh checklists after transfer."
      );
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleOptionOpen = (optionKey) => {
    setActiveOption(optionKey);
    setError("");
    setSuccess("");
  };

  const handleEmployeeChange = (event) => {
    const { name, value } = event.target;

    setForm((currentValue) => {
      if (name === "fromEmployeeId") {
        return {
          ...currentValue,
          fromEmployeeId: value,
          toEmployeeId: "",
        };
      }

      return {
        ...currentValue,
        [name]: value,
      };
    });

    setError("");
    setSuccess("");

    if (name === "fromEmployeeId") {
      setEligibleToEmployees([]);
    }
  };

  const selectAllChecklists = () => {
    setSelectedChecklistIds(allChecklistIds);
  };

  const clearSelectedChecklists = () => {
    setSelectedChecklistIds([]);
  };

  const handlePermanentTransfer = async () => {
    setError("");
    setSuccess("");

    if (!form.fromEmployeeId) {
      setError("Select a From Employee before loading checklist masters.");
      return;
    }

    if (!form.toEmployeeId) {
      setError("Select a To Employee for the permanent transfer.");
      return;
    }

    if (String(form.fromEmployeeId) === String(form.toEmployeeId)) {
      setError("From Employee and To Employee cannot be the same.");
      return;
    }

    if (
      !toEmployeeOptions.some(
        (employee) => String(employee._id) === String(form.toEmployeeId)
      )
    ) {
      setError(
        "To Employee must be selected from the filtered same Site and Department employee list."
      );
      return;
    }

    if (!selectedChecklistIds.length) {
      setError("Select at least one checklist to transfer permanently.");
      return;
    }

    const confirmed = window.confirm(
      buildTransferConfirmationMessage({
        transferType: "permanent",
        count: selectedChecklistIds.length,
        fromEmployeeLabel: getEmployeeLabel(selectedFromEmployee),
        toEmployeeLabel: getEmployeeLabel(selectedToEmployee),
        requiresApproval: usesApprovalRequestFlow,
      })
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const response = await api.post("/checklists/transfers/permanent", {
        fromEmployeeId: form.fromEmployeeId,
        toEmployeeId: form.toEmployeeId,
        checklistIds: selectedChecklistIds,
      });

      const transferredCount = Number(
        response.data?.transferredCount || selectedChecklistIds.length
      );

      setSuccess(
        response.data?.message ||
          `${transferredCount} checklist${
            transferredCount === 1 ? "" : "s"
          } transferred successfully to ${getEmployeeLabel(selectedToEmployee)}.`
      );
      setForm((currentValue) => ({
        ...currentValue,
        toEmployeeId: "",
      }));

      if (isAdminChecklistUser) {
        await Promise.all([
          refreshSelectedEmployeeChecklists(form.fromEmployeeId),
          refreshHistory(),
        ]);
      }
    } catch (err) {
      console.error("Checklist permanent transfer failed:", err);
      setError(err.response?.data?.message || "Failed to transfer selected checklists.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTemporaryTransfer = async () => {
    setError("");
    setSuccess("");

    if (!form.fromEmployeeId) {
      setError("Select a From Employee before loading checklist masters.");
      return;
    }

    if (!form.toEmployeeId) {
      setError("Select a To Employee for the temporary transfer.");
      return;
    }

    if (String(form.fromEmployeeId) === String(form.toEmployeeId)) {
      setError("From Employee and To Employee cannot be the same.");
      return;
    }

    if (
      !toEmployeeOptions.some(
        (employee) => String(employee._id) === String(form.toEmployeeId)
      )
    ) {
      setError(
        "To Employee must be selected from the filtered same Site and Department employee list."
      );
      return;
    }

    if (!form.fromDate || !form.toDate) {
      setError("Select From Date and To Date for the temporary transfer.");
      return;
    }

    if (form.fromDate > form.toDate) {
      setError("From Date must be less than or equal to To Date.");
      return;
    }

    if (!selectedChecklistIds.length) {
      setError("Select at least one checklist to transfer temporarily.");
      return;
    }

    const confirmed = window.confirm(
      buildTransferConfirmationMessage({
        transferType: "temporary",
        count: selectedChecklistIds.length,
        fromEmployeeLabel: getEmployeeLabel(selectedFromEmployee),
        toEmployeeLabel: getEmployeeLabel(selectedToEmployee),
        fromDate: form.fromDate,
        toDate: form.toDate,
        requiresApproval: usesApprovalRequestFlow,
      })
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const response = await api.post("/checklists/transfers/temporary", {
        fromEmployeeId: form.fromEmployeeId,
        toEmployeeId: form.toEmployeeId,
        fromDate: form.fromDate,
        toDate: form.toDate,
        checklistIds: selectedChecklistIds,
      });

      const transferredCount = Number(
        response.data?.transferredCount || selectedChecklistIds.length
      );
      const transferStatus = String(response.data?.transferStatus || "").trim().toLowerCase();

      setSuccess(
        response.data?.message ||
          `${transferredCount} checklist${
            transferredCount === 1 ? "" : "s"
          } scheduled for temporary transfer to ${getEmployeeLabel(selectedToEmployee)}${
            transferStatus === "active"
              ? ` from ${form.fromDate} to ${form.toDate}.`
              : ` for ${form.fromDate} to ${form.toDate}.`
          }`
      );
      setForm((currentValue) => ({
        ...currentValue,
        toEmployeeId: "",
        fromDate: "",
        toDate: "",
      }));
      setSelectedChecklistIds([]);

      if (isAdminChecklistUser) {
        await Promise.all([
          refreshSelectedEmployeeChecklists(form.fromEmployeeId),
          refreshHistory(),
        ]);
      }
    } catch (err) {
      console.error("Checklist temporary transfer failed:", err);
      setError(
        err.response?.data?.message || "Failed to save the temporary checklist transfer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Masters</div>
            <h3 className="mb-1">Checklist Transfer</h3>
            <p className="page-subtitle mb-0">
              {usesApprovalRequestFlow
                ? "Prepare checklist transfer requests and send them for admin approval before any assignment change is applied."
                : "Reassign selected checklist masters between employees with either permanent movement or temporary date-based transfer windows while keeping the checklist configuration and workflow mapping unchanged."}
            </p>
          </div>

          <div className="list-summary">
            <span className="summary-chip">{checklists.length} loaded checklists</span>
            <span className="summary-chip summary-chip--neutral">
              {selectedChecklistIds.length} selected
            </span>
            <span className="summary-chip summary-chip--neutral">
              {historyRows.length} recent transfers
            </span>
          </div>
        </div>
      </div>

      <div className="soft-card mb-4">
        <div className="mb-3">
          <h5 className="mb-1">Transfer Options</h5>
          <div className="form-help">
            Choose the transfer action you want to perform inside this module.
          </div>
        </div>

        <div className="row g-3">
          <div className="col-lg-4">
            <button
              type="button"
              className={`btn w-100 text-start p-3 ${
                activeOption === "permanent" ? "btn-primary" : "btn-outline-primary"
              }`}
              onClick={() => handleOptionOpen("permanent")}
            >
              <div className="fw-semibold">Permanent Transfer</div>
              <div className={activeOption === "permanent" ? "text-white-50" : "text-muted"}>
                Move selected checklist masters from one employee to another and
                keep the workflow configuration intact.
              </div>
            </button>
          </div>

          <div className="col-lg-4">
            <button
              type="button"
              className={`btn w-100 text-start p-3 ${
                activeOption === "temporary" ? "btn-primary" : "btn-outline-primary"
              }`}
              onClick={() => handleOptionOpen("temporary")}
            >
              <div className="fw-semibold">Temporary Transfer</div>
              <div className={activeOption === "temporary" ? "text-white-50" : "text-muted"}>
                Move selected checklist masters only for a selected date range
                and automatically revert them back to the original employee
                after the end date.
              </div>
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="alert alert-success" role="alert">
          {success}
        </div>
      ) : null}

      {isPermanentTransfer || isTemporaryTransfer ? (
        <>
          <div className="soft-card mb-4">
            <div className="row g-3">
              <div className="col-lg-6">
                <label className="form-label fw-semibold">From Employee Name</label>
                <select
                  className="form-select"
                  name="fromEmployeeId"
                  value={form.fromEmployeeId}
                  onChange={handleEmployeeChange}
                  disabled={pageLoading}
                >
                  <option value="">Select From Employee</option>
                  {sortedEmployees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {`${getEmployeeLabel(employee)}${
                        isActiveEmployee(employee) ? "" : " (Inactive)"
                      }`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-lg-6">
                <label className="form-label fw-semibold">To Employee Name</label>
                <select
                  className="form-select"
                  name="toEmployeeId"
                  value={form.toEmployeeId}
                  onChange={handleEmployeeChange}
                  disabled={pageLoading || !form.fromEmployeeId}
                >
                  <option value="">Select To Employee</option>
                  {toEmployeeOptions.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {getEmployeeLabel(employee)}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  {form.fromEmployeeId
                    ? "Only active employees from the same assigned Site and Department are shown."
                    : "Select a From Employee first to filter To Employee options."}
                </div>
              </div>

              {isTemporaryTransfer ? (
                <>
                  <div className="col-lg-6">
                    <label className="form-label fw-semibold">From Date</label>
                    <input
                      type="date"
                      className="form-control"
                      name="fromDate"
                      value={form.fromDate}
                      onChange={handleEmployeeChange}
                      disabled={submitting}
                    />
                  </div>

                  <div className="col-lg-6">
                    <label className="form-label fw-semibold">To Date</label>
                    <input
                      type="date"
                      className="form-control"
                      name="toDate"
                      value={form.toDate}
                      onChange={handleEmployeeChange}
                      disabled={submitting}
                    />
                  </div>
                </>
              ) : null}
            </div>

            <div className="list-summary mt-3">
              <span className="summary-chip">
                From: {selectedFromEmployee ? getEmployeeLabel(selectedFromEmployee) : "Not selected"}
              </span>
              <span className="summary-chip summary-chip--neutral">
                To: {selectedToEmployee ? getEmployeeLabel(selectedToEmployee) : "Not selected"}
              </span>
              <span className="summary-chip summary-chip--neutral">
                Site: {fromEmployeeSiteLabel}
              </span>
              <span className="summary-chip summary-chip--neutral">
                Department: {fromEmployeeDepartmentLabel}
              </span>
              <span className="summary-chip summary-chip--neutral">
                {toEmployeeOptions.length} eligible To Employees
              </span>
              {isTemporaryTransfer ? (
                <span className="summary-chip summary-chip--neutral">
                  Window: {form.fromDate || "-"} to {form.toDate || "-"}
                </span>
              ) : null}
            </div>

            {form.fromEmployeeId && !toEmployeeOptions.length ? (
              <div className="alert alert-warning mt-3 mb-0">
                No active employees were found in the same assigned Site and Department for the
                selected From Employee.
              </div>
            ) : null}

            {isTemporaryTransfer && hasInvalidTemporaryDateRange ? (
              <div className="alert alert-danger mt-3 mb-0">
                From Date must be less than or equal to To Date.
              </div>
            ) : null}
          </div>

          <div className="soft-card mb-4">
            <div className="list-toolbar mb-3">
              <div>
                <h5 className="mb-1">Selected Employee Checklist Masters</h5>
                <div className="form-help">
                  Only checklist masters currently assigned to the selected From
                  Employee are shown here.
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={selectAllChecklists}
                  disabled={!allChecklistIds.length || allChecklistsSelected || checklistLoading}
                >
                  Select All Checklists
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={clearSelectedChecklists}
                  disabled={!selectedChecklistIds.length || checklistLoading}
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {!form.fromEmployeeId ? (
              <div className="alert alert-secondary mb-0">
                Choose a From Employee to load the currently assigned checklist masters.
              </div>
            ) : checklistLoading ? (
              <div className="alert alert-info mb-0">Loading employee checklist masters...</div>
            ) : !checklistOptions.length ? (
              <div className="alert alert-warning mb-0">
                No checklist masters are currently assigned to the selected From Employee.
              </div>
            ) : (
              <>
                <SearchableCheckboxSelector
                  label="Checklist Selection"
                  helperText="Pick individual checklist masters or use Select All Checklists to transfer everything assigned to the selected employee."
                  options={checklistOptions}
                  selectedValues={selectedChecklistIds}
                  onChange={setSelectedChecklistIds}
                  searchPlaceholder="Search checklist number or name"
                  emptyMessage="No checklist masters are available for transfer."
                  noResultsMessage="No checklist masters match the current search."
                  disabled={submitting}
                />

                <div className="list-summary mt-3">
                  <span className="summary-chip">{checklistOptions.length} available</span>
                  <span className="summary-chip summary-chip--neutral">
                    {selectedChecklistIds.length} ready to transfer
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="soft-card mb-4">
            <div className="list-toolbar">
              <div>
                <h5 className="mb-1">
                  {isTemporaryTransfer
                    ? "Temporary Transfer Confirmation"
                    : "Permanent Transfer Confirmation"}
                </h5>
                <div className="form-help">
                  {isTemporaryTransfer
                    ? usesApprovalRequestFlow
                      ? "The selected checklist masters will stay unchanged until admin approval. After approval, the temporary transfer window will be saved and applied in the normal transfer flow."
                      : "The selected checklist masters will move only for the selected date range. During that period the new employee will handle the transferred checklist masters and related checklist tasks, then the assignment will automatically revert."
                    : usesApprovalRequestFlow
                    ? "The selected checklist masters will stay unchanged until admin approval. After approval, the permanent transfer will update the checklist owner and related checklist tasks."
                    : "The selected checklist masters will be moved permanently. The new employee will own the transferred checklist masters and the related checklist tasks."}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={isTemporaryTransfer ? handleTemporaryTransfer : handlePermanentTransfer}
                disabled={
                  submitting ||
                  !form.fromEmployeeId ||
                  !form.toEmployeeId ||
                  (isTemporaryTransfer && (!form.fromDate || !form.toDate || hasInvalidTemporaryDateRange)) ||
                  !selectedChecklistIds.length
                }
              >
                {submitting
                  ? usesApprovalRequestFlow
                    ? "Submitting..."
                    : "Transferring..."
                  : isTemporaryTransfer
                  ? usesApprovalRequestFlow
                    ? "Submit Temporary Transfer Request"
                    : "Temporary Transfer"
                  : usesApprovalRequestFlow
                  ? "Submit Permanent Transfer Request"
                  : "Permanent Transfer"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="soft-card mb-4">
          <div className="text-muted">
            Open <span className="fw-semibold">Permanent Transfer</span> or{" "}
            <span className="fw-semibold">Temporary Transfer</span> to choose
            the employees and the checklist masters you want to move.
          </div>
        </div>
      )}

      <div className="table-shell">
        <div className="p-3 border-bottom">
          <div className="list-toolbar">
            <div>
              <h5 className="mb-1">Transfer History</h5>
              <div className="form-help">
                Recent permanent and temporary transfers are stored here for audit and tracking.
              </div>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ minWidth: "160px" }}>Transfer Date</th>
                <th style={{ minWidth: "120px" }}>Transfer Type</th>
                <th style={{ minWidth: "180px" }}>Effective Dates</th>
                <th style={{ minWidth: "120px" }}>Status</th>
                <th style={{ minWidth: "180px" }}>From Employee</th>
                <th style={{ minWidth: "180px" }}>To Employee</th>
                <th>Transferred Checklist Names</th>
                <th style={{ minWidth: "220px" }}>Transferred By</th>
              </tr>
            </thead>
            <tbody>
              {pageLoading || historyLoading ? (
                <tr>
                  <td colSpan="8" className="text-center">
                    Loading transfer history...
                  </td>
                </tr>
              ) : historyRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center">
                    No checklist transfers have been recorded yet.
                  </td>
                </tr>
              ) : (
                historyRows.map((historyRow) => (
                  <tr key={historyRow._id}>
                    <td>{formatDateTime(historyRow.transferredAt || historyRow.createdAt)}</td>
                    <td>{getTransferTypeLabel(historyRow.transferType)}</td>
                    <td>{getHistoryTransferDateRangeLabel(historyRow)}</td>
                    <td>{getHistoryTransferStatusLabel(historyRow)}</td>
                    <td>{getHistoryEmployeeLabel(historyRow, "from")}</td>
                    <td>{getHistoryEmployeeLabel(historyRow, "to")}</td>
                    <td className="text-break">
                      {Array.isArray(historyRow.checklistNames) && historyRow.checklistNames.length
                        ? historyRow.checklistNames.join(", ")
                        : Array.isArray(historyRow.checklists)
                        ? historyRow.checklists
                            .map((checklist) => checklist?.checklistName || checklist?.checklistNumber)
                            .filter(Boolean)
                            .join(", ")
                        : "-"}
                    </td>
                    <td>{getTransferredByLabel(historyRow)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
