import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const parseNames = (value) => {
  const seen = new Set();
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getEmployeeHeadLabel = (employee) => {
  const code = String(employee?.employeeCode || "").trim();
  const name = String(employee?.employeeName || "").trim();
  if (code && name) return `${code} - ${name}`;
  return code || name;
};

const buildHeadSelectionState = (savedHeadNames = [], employeeRows = []) => {
  const normalizedSaved = Array.isArray(savedHeadNames)
    ? savedHeadNames.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const byLookup = new Map();
  employeeRows.forEach((employee) => {
    const employeeId = String(employee._id || "");
    const label = getEmployeeHeadLabel(employee);
    const lookups = [
      label,
      String(employee.employeeName || "").trim(),
      String(employee.employeeCode || "").trim(),
    ]
      .map((item) => item.toLowerCase())
      .filter(Boolean);

    lookups.forEach((item) => {
      if (!byLookup.has(item)) {
        byLookup.set(item, employeeId);
      }
    });
  });

  const selectedEmployeeIds = [];
  const legacyHeadNames = [];
  const seenIds = new Set();

  normalizedSaved.forEach((item) => {
    const matchId = byLookup.get(item.toLowerCase());
    if (matchId) {
      if (!seenIds.has(matchId)) {
        seenIds.add(matchId);
        selectedEmployeeIds.push(matchId);
      }
      return;
    }

    legacyHeadNames.push(item);
  });

  return { selectedEmployeeIds, legacyHeadNames };
};

export default function DepartmentMaster() {
  const [departments, setDepartments] = useState([]);
  const [name, setName] = useState("");
  const [employees, setEmployees] = useState([]);
  const [headEmployeeIds, setHeadEmployeeIds] = useState([]);
  const [legacyHeadNames, setLegacyHeadNames] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedDepartmentName, setSelectedDepartmentName] = useState("");
  const [subPath, setSubPath] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [subName, setSubName] = useState("");
  const [subHeadEmployeeIds, setSubHeadEmployeeIds] = useState([]);
  const [legacySubHeadNames, setLegacySubHeadNames] = useState([]);
  const [subEditingId, setSubEditingId] = useState("");
  const [subLoading, setSubLoading] = useState(false);

  const currentSubLevel = subPath.length + 1;
  const currentParentId = subPath.length ? subPath[subPath.length - 1]._id : "";

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get("/departments");
      setDepartments(res.data || []);
    } catch (err) {
      console.error("Load departments failed:", err);
      setDepartments([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees");
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Load employees failed:", err);
      setEmployees([]);
    }
  };

  const employeeOptions = useMemo(
    () =>
      [...employees].sort((left, right) =>
        getEmployeeHeadLabel(left).localeCompare(getEmployeeHeadLabel(right))
      ),
    [employees]
  );

  const resetDepartmentForm = () => {
    setName("");
    setHeadEmployeeIds([]);
    setLegacyHeadNames([]);
    setEditingId("");
  };

  const saveDepartment = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return alert("Enter department name");

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/departments/${editingId}`, {
          name: trimmedName,
          headEmployeeIds,
          headNames: legacyHeadNames,
        });
      } else {
        await api.post("/departments", {
          name: trimmedName,
          headEmployeeIds,
          headNames: legacyHeadNames,
        });
      }

      resetDepartmentForm();
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const editDepartment = (row) => {
    const { selectedEmployeeIds, legacyHeadNames: legacyNames } =
      buildHeadSelectionState(row.headNames || [], employees);
    setName(row.name || "");
    setHeadEmployeeIds(selectedEmployeeIds);
    setLegacyHeadNames(legacyNames);
    setEditingId(row._id);
  };

  const deleteDepartment = async (id) => {
    if (!window.confirm("Delete this department?")) return;

    try {
      await api.delete(`/departments/${id}`);
      if (editingId === id) resetDepartmentForm();
      if (selectedDepartmentId === id) clearSubDepartmentContext();
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const clearSubDepartmentContext = () => {
    setSelectedDepartmentId("");
    setSelectedDepartmentName("");
    setSubPath([]);
    setSubDepartments([]);
    resetSubDepartmentForm();
  };

  const openSubDepartmentManager = async (department) => {
    setSelectedDepartmentId(department._id);
    setSelectedDepartmentName(department.name);
    setSubPath([]);
    resetSubDepartmentForm();
    await fetchSubDepartments(department._id, "");
  };

  const fetchSubDepartments = async (departmentId, parentId = "") => {
    try {
      const params = parentId ? { parentId } : {};
      const res = await api.get(`/departments/${departmentId}/sub-departments`, { params });
      setSubDepartments(res.data || []);
    } catch (err) {
      console.error("Load sub departments failed:", err);
      setSubDepartments([]);
      alert(err.response?.data?.message || "Failed to load sub departments");
    }
  };

  const resetSubDepartmentForm = () => {
    setSubName("");
    setSubHeadEmployeeIds([]);
    setLegacySubHeadNames([]);
    setSubEditingId("");
  };

  const saveSubDepartment = async () => {
    if (!selectedDepartmentId) return;

    const names = parseNames(subName);
    if (!names.length) return alert("Enter sub department name");
    if (subEditingId && names.length !== 1) {
      return alert("While editing, enter only one sub department name");
    }

    setSubLoading(true);
    try {
      if (subEditingId) {
        await api.put(
          `/departments/${selectedDepartmentId}/sub-departments/${subEditingId}`,
          {
            name: names[0],
            headEmployeeIds: subHeadEmployeeIds,
            headNames: legacySubHeadNames,
          }
        );
      } else {
        await api.post(`/departments/${selectedDepartmentId}/sub-departments`, {
          parentId: currentParentId || undefined,
          names: names.length > 1 ? names : undefined,
          name: names[0],
          headEmployeeIds: subHeadEmployeeIds,
          headNames: legacySubHeadNames,
        });
      }

      resetSubDepartmentForm();
      await fetchSubDepartments(selectedDepartmentId, currentParentId);
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Save failed");
    } finally {
      setSubLoading(false);
    }
  };

  const editSubDepartment = (row) => {
    const { selectedEmployeeIds, legacyHeadNames: legacyNames } =
      buildHeadSelectionState(row.headNames || [], employees);
    setSubName(row.name || "");
    setSubHeadEmployeeIds(selectedEmployeeIds);
    setLegacySubHeadNames(legacyNames);
    setSubEditingId(row._id);
  };

  const deleteSubDepartment = async (subId) => {
    if (!selectedDepartmentId) return;
    if (!window.confirm("Delete this sub department?")) return;

    try {
      await api.delete(`/departments/${selectedDepartmentId}/sub-departments/${subId}`);
      if (subEditingId === subId) resetSubDepartmentForm();
      await fetchSubDepartments(selectedDepartmentId, currentParentId);
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const openNextSubLevel = async (subRow) => {
    if (!selectedDepartmentId) return;
    if (currentSubLevel >= 4) return;

    const nextPath = [...subPath, { _id: subRow._id, name: subRow.name }];
    setSubPath(nextPath);
    resetSubDepartmentForm();
    await fetchSubDepartments(selectedDepartmentId, subRow._id);
  };

  const jumpToSubLevel = async (pathIndex) => {
    if (!selectedDepartmentId) return;

    if (pathIndex < 0) {
      setSubPath([]);
      resetSubDepartmentForm();
      await fetchSubDepartments(selectedDepartmentId, "");
      return;
    }

    const nextPath = subPath.slice(0, pathIndex + 1);
    const parentId = nextPath[nextPath.length - 1]?._id || "";
    setSubPath(nextPath);
    resetSubDepartmentForm();
    await fetchSubDepartments(selectedDepartmentId, parentId);
  };

  return (
    <div className="container mt-4">
      <h3>Department Master</h3>

      <div className="card p-3 mb-3">
        <input
          className="form-control mb-2"
          placeholder="Department Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="form-label fw-semibold">Department Heads</label>
        <select
          className="form-select mb-1"
          multiple
          size={Math.min(8, Math.max(4, employeeOptions.length || 4))}
          value={headEmployeeIds}
          onChange={(e) =>
            setHeadEmployeeIds(
              Array.from(e.target.selectedOptions, (option) => option.value)
            )
          }
        >
          {employeeOptions.map((employee) => (
            <option key={employee._id} value={employee._id}>
              {getEmployeeHeadLabel(employee)}
            </option>
          ))}
        </select>
        <small className="text-muted d-block mb-2">
          Select one or multiple employees from Employee Master.
        </small>
        {legacyHeadNames.length > 0 && (
          <div className="alert alert-warning py-2 mb-2 d-flex justify-content-between align-items-center gap-2">
            <span>Legacy department heads preserved: {legacyHeadNames.join(", ")}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => setLegacyHeadNames([])}
            >
              Clear Legacy
            </button>
          </div>
        )}
        <div className="d-flex gap-2">
          <button className="btn btn-success" onClick={saveDepartment} disabled={loading}>
            {loading ? "Saving..." : editingId ? "Update Department" : "Save Department"}
          </button>
          {editingId && (
            <button className="btn btn-secondary" onClick={resetDepartmentForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <table className="table table-bordered mb-4">
        <thead>
          <tr>
            <th>#</th>
            <th>Department</th>
            <th>Department Heads</th>
            <th>Sub Departments</th>
            <th width="290">Actions</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d, i) => (
            <tr key={d._id}>
              <td>{i + 1}</td>
              <td>{d.name}</td>
              <td>{d.headNames?.length ? d.headNames.join(", ") : "-"}</td>
              <td>
                {d.subDepartments?.length
                  ? d.subDepartments
                      .map((sub) =>
                        sub.headNames?.length
                          ? `${sub.name} (${sub.headNames.join(", ")})`
                          : sub.name
                      )
                      .join(", ")
                  : "-"}
              </td>
              <td>
                <button className="btn btn-sm btn-primary me-2" onClick={() => openSubDepartmentManager(d)}>
                  Manage Sub
                </button>
                <button className="btn btn-sm btn-warning me-2" onClick={() => editDepartment(d)}>
                  Edit
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteDepartment(d._id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedDepartmentId && (
        <div className="card p-3">
          <h5 className="mb-3">
            Sub Department Master {currentSubLevel} - {selectedDepartmentName}
          </h5>

          <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
            <span className="fw-semibold">Path:</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => jumpToSubLevel(-1)}>
              Sub Department Master 1
            </button>
            {subPath.map((item, index) => (
              <button
                key={item._id}
                className="btn btn-sm btn-outline-secondary"
                onClick={() => jumpToSubLevel(index)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="d-flex gap-2 mb-3">
            <div className="flex-grow-1">
              <textarea
                className="form-control mb-2"
                placeholder={
                  subEditingId
                    ? `Enter Sub Department Master ${currentSubLevel} name`
                    : `Enter multiple names with comma or new line for Sub Department Master ${currentSubLevel}`
                }
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                rows={2}
              />
              <label className="form-label fw-semibold">Sub Department Heads</label>
              <select
                className="form-select"
                multiple
                size={Math.min(8, Math.max(4, employeeOptions.length || 4))}
                value={subHeadEmployeeIds}
                onChange={(e) =>
                  setSubHeadEmployeeIds(
                    Array.from(e.target.selectedOptions, (option) => option.value)
                  )
                }
              >
                {employeeOptions.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {getEmployeeHeadLabel(employee)}
                  </option>
                ))}
              </select>
              <small className="text-muted d-block mt-1">
                Select one or multiple employees from Employee Master.
              </small>
              {legacySubHeadNames.length > 0 && (
                <div className="alert alert-warning py-2 mt-2 mb-0 d-flex justify-content-between align-items-center gap-2">
                  <span>
                    Legacy sub department heads preserved: {legacySubHeadNames.join(", ")}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-warning"
                    onClick={() => setLegacySubHeadNames([])}
                  >
                    Clear Legacy
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-success" onClick={saveSubDepartment} disabled={subLoading}>
              {subLoading ? "Saving..." : subEditingId ? "Update" : "Add"}
            </button>
            {subEditingId && (
              <button className="btn btn-secondary" onClick={resetSubDepartmentForm}>
                Cancel
              </button>
            )}
            <button className="btn btn-outline-secondary" onClick={clearSubDepartmentContext}>
              Close
            </button>
          </div>

          <table className="table table-bordered">
            <thead>
              <tr>
                <th>#</th>
                <th>Sub Department Master {currentSubLevel}</th>
                <th>Sub Department Heads</th>
                <th width="250">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subDepartments.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center">
                    No sub departments found
                  </td>
                </tr>
              )}

              {subDepartments.map((sub, index) => (
                <tr key={sub._id}>
                  <td>{index + 1}</td>
                  <td>{sub.name}</td>
                  <td>{sub.headNames?.length ? sub.headNames.join(", ") : "-"}</td>
                  <td>
                    {currentSubLevel < 4 && (
                      <button className="btn btn-sm btn-primary me-2" onClick={() => openNextSubLevel(sub)}>
                        Next Level
                      </button>
                    )}
                    <button className="btn btn-sm btn-warning me-2" onClick={() => editSubDepartment(sub)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteSubDepartment(sub._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
