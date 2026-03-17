import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { formatSiteLabel } from "../utils/siteDisplay";

const flattenSubDepartments = (rows = [], trail = [], department = null) =>
  rows.flatMap((item) => {
    const nextTrail = [...trail, item.name];
    return [
      {
        _id: item._id,
        name: item.name,
        departmentId: department?._id || "",
        departmentName: department?.name || "",
        label:
          department?.name
            ? `${department.name} > ${nextTrail.join(" > ")}`
            : nextTrail.join(" > "),
      },
      ...flattenSubDepartments(item.children || [], nextTrail, department),
    ];
  });

const SUB_SITE_SEPARATOR = "::";

const flattenSubSiteRows = (rows = [], trail = []) =>
  rows.flatMap((item) => {
    const nextTrail = [...trail, item.name];
    return [
      {
        subSiteId: String(item._id),
        label: nextTrail.join(" > "),
      },
      ...flattenSubSiteRows(item.children || [], nextTrail),
    ];
  });

const buildSubSiteOptions = (siteRows = [], selectedSiteIds = []) => {
  const selectedSet = new Set((selectedSiteIds || []).map((id) => String(id)));

  return (siteRows || [])
    .filter((site) => selectedSet.has(String(site._id)))
    .flatMap((site) =>
      flattenSubSiteRows(site.subSites || []).map((subSite) => ({
        value: `${site._id}${SUB_SITE_SEPARATOR}${subSite.subSiteId}`,
        label: `${formatSiteLabel(site)} > ${subSite.label}`,
      }))
    );
};

const buildSubDepartmentOptions = (departmentRows = [], selectedDepartmentIds = []) => {
  const selectedSet = new Set((selectedDepartmentIds || []).map((id) => String(id)));

  return (departmentRows || [])
    .filter((department) => selectedSet.has(String(department._id)))
    .flatMap((department) =>
      flattenSubDepartments(department.subDepartments || [], [], department)
    );
};

const toSubSitePayload = (values = []) =>
  values
    .map((value) => {
      const [site, subSite] = String(value || "").split(SUB_SITE_SEPARATOR);
      if (!site || !subSite) return null;
      return { site, subSite };
    })
    .filter(Boolean);

const normalizeSelectionValues = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item))
    : value
    ? [String(value)]
    : [];

export default function EmployeeForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [sitesList, setSitesList] = useState([]);
  const [superiorEmployees, setSuperiorEmployees] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [subSiteOptions, setSubSiteOptions] = useState([]);

  const [form, setForm] = useState({
    employeeCode: "",
    employeeName: "",
    mobile: "",
    password: "",
    department: [],
    subDepartment: [],
    designation: "",
    superiorEmployee: "",
    email: "",
    dateOfJoining: "",
    sites: [],
    subSites: [],
  });

  useEffect(() => {
    loadMasters();
  }, []);

  const loadMasters = async () => {
    try {
      const [deptRes, desigRes, siteRes, employeeRes] = await Promise.all([
        api.get("/departments"),
        api.get("/designations"),
        api.get("/sites"),
        api.get("/employees"),
      ]);

      setDepartments(deptRes.data || []);
      setDesignations(desigRes.data || []);
      setSitesList(siteRes.data || []);
      setSuperiorEmployees(employeeRes.data || []);
    } catch (err) {
      console.error("Failed to load masters", err);
      alert("Failed to load masters");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDepartmentsChange = (e) => {
    const selectedDepartmentIds = normalizeSelectionValues(
      Array.from(e.target.selectedOptions, (option) => option.value)
    );
    const nextOptions = buildSubDepartmentOptions(departments, selectedDepartmentIds);
    const allowedValues = new Set(nextOptions.map((item) => String(item._id)));

    setSubDepartments(nextOptions);
    setForm((prev) => ({
      ...prev,
      department: selectedDepartmentIds,
      subDepartment: (prev.subDepartment || []).filter((value) => allowedValues.has(String(value))),
    }));
  };

  const handleSubDepartmentsChange = (e) => {
    const selectedValues = normalizeSelectionValues(
      Array.from(e.target.selectedOptions, (option) => option.value)
    );
    setForm((prev) => ({ ...prev, subDepartment: selectedValues }));
  };

  const handleSitesChange = (e) => {
    const selectedSiteIds = Array.from(e.target.selectedOptions, (option) => option.value);
    const nextOptions = buildSubSiteOptions(sitesList, selectedSiteIds);
    const allowedValues = new Set(nextOptions.map((item) => item.value));

    setSubSiteOptions(nextOptions);
    setForm((prev) => ({
      ...prev,
      sites: selectedSiteIds,
      subSites: (prev.subSites || []).filter((value) => allowedValues.has(value)),
    }));
  };

  const handleSubSitesChange = (e) => {
    const selectedSubSiteValues = Array.from(
      e.target.selectedOptions,
      (option) => option.value
    );
    setForm((prev) => ({ ...prev, subSites: selectedSubSiteValues }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        if (key === "department") {
          value.forEach((departmentId) => data.append("department", departmentId));
        } else if (key === "sites") {
          value.forEach((siteId) => data.append("sites", siteId));
        } else if (key === "subDepartment") {
          value.forEach((subDepartmentId) => data.append("subDepartment", subDepartmentId));
        } else if (key === "subSites") {
          data.append("subSites", JSON.stringify(toSubSitePayload(value)));
        } else if (value !== "" && value !== null) {
          data.append(key, value);
        }
      });

      if (photo) {
        data.append("photo", photo);
      }

      await api.post("/employees", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Employee saved successfully");
      navigate("/employees");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-1">Add Employee</h4>
          <p className="text-muted mb-0">Use left and right panels to complete details.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate("/employees")}
        >
          Back
        </button>
      </div>

      <form onSubmit={submit} encType="multipart/form-data">
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="card h-100 shadow-sm">
              <div className="card-header bg-light fw-semibold">Basic Information</div>
              <div className="card-body">
                <label className="form-label">Employee Code *</label>
                <input
                  className="form-control mb-2"
                  name="employeeCode"
                  placeholder="Employee Code"
                  value={form.employeeCode}
                  onChange={handleChange}
                  required
                />

                <label className="form-label">Employee Name *</label>
                <input
                  className="form-control mb-2"
                  name="employeeName"
                  placeholder="Employee Name"
                  value={form.employeeName}
                  onChange={handleChange}
                  required
                />

                <label className="form-label">Mobile</label>
                <input
                  className="form-control mb-2"
                  name="mobile"
                  placeholder="Mobile"
                  value={form.mobile}
                  onChange={handleChange}
                />

                <label className="form-label">Email</label>
                <input
                  className="form-control mb-2"
                  name="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={handleChange}
                />

                <label className="form-label">Login Password *</label>
                <input
                  className="form-control mb-2"
                  name="password"
                  type="password"
                  placeholder="Employee login password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <small className="text-muted d-block mb-3">
                  Employees can log in using Employee Code, Employee Name, or Email with this
                  password.
                </small>

                <label className="form-label">Date Of Joining</label>
                <input
                  className="form-control mb-3"
                  type="date"
                  name="dateOfJoining"
                  value={form.dateOfJoining}
                  onChange={handleChange}
                />

                <label className="form-label fw-semibold">Profile Photo</label>
                <input
                  className="form-control mb-2"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handlePhotoChange}
                />
                {photoPreview && (
                  <div className="mt-2 d-flex align-items-center gap-2">
                    <img
                      src={photoPreview}
                      alt="preview"
                      width="72"
                      height="72"
                      style={{ borderRadius: "50%", objectFit: "cover", border: "1px solid #dee2e6" }}
                    />
                    <small className="text-muted">Photo preview</small>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card h-100 shadow-sm">
              <div className="card-header bg-light fw-semibold">Department And Site Mapping</div>
              <div className="card-body">
                <label className="form-label">Departments *</label>
                <select
                  className="form-select mb-1"
                  multiple
                  size={Math.min(8, Math.max(4, departments.length || 4))}
                  name="department"
                  value={form.department}
                  onChange={handleDepartmentsChange}
                  required
                >
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <small className="text-muted mb-2 d-block">
                  Hold Ctrl (Windows) or Cmd (Mac) to select multiple departments.
                </small>

                <label className="form-label">Sub Departments (Optional)</label>
                <select
                  className="form-select mb-1"
                  multiple
                  size={Math.min(8, Math.max(4, subDepartments.length || 4))}
                  name="subDepartment"
                  value={form.subDepartment}
                  onChange={handleSubDepartmentsChange}
                  disabled={!form.department.length || !subDepartments.length}
                >
                  {subDepartments.length === 0 ? (
                    <option value="" disabled>
                      {form.department.length
                        ? "No sub departments available"
                        : "Select department first"}
                    </option>
                  ) : (
                    subDepartments.map((sub) => (
                      <option key={sub._id} value={sub._id}>
                        {sub.label}
                      </option>
                    ))
                  )}
                </select>
                <small className="text-muted mb-2 d-block">
                  Optional. Hold Ctrl (Windows) or Cmd (Mac) to select multiple sub departments.
                </small>

                <label className="form-label">Designation *</label>
                <select
                  className="form-select mb-2"
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Select Designation --</option>
                  {designations.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <label className="form-label">Superior Employee</label>
                <select
                  className="form-select mb-3"
                  name="superiorEmployee"
                  value={form.superiorEmployee}
                  onChange={handleChange}
                >
                  <option value="">(No superior)</option>
                  {superiorEmployees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.employeeCode} - {employee.employeeName}
                    </option>
                  ))}
                </select>

                <label className="form-label fw-semibold">Employee Sites (Multi Select)</label>
                <select
                  className="form-select mb-1"
                  multiple
                  size={Math.min(8, Math.max(4, sitesList.length))}
                  value={form.sites}
                  onChange={handleSitesChange}
                >
                  {sitesList.map((site) => (
                    <option key={site._id} value={site._id}>
                      {formatSiteLabel(site)}
                    </option>
                  ))}
                </select>
                <small className="text-muted mb-3 d-block">
                  Hold Ctrl (Windows) or Cmd (Mac) to select multiple sites.
                </small>

                <label className="form-label fw-semibold">Employee Sub Sites (Multi Select)</label>
                <select
                  className="form-select mb-1"
                  multiple
                  size={Math.min(8, Math.max(4, subSiteOptions.length || 4))}
                  value={form.subSites}
                  onChange={handleSubSitesChange}
                  disabled={!form.sites.length || !subSiteOptions.length}
                >
                  {subSiteOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <small className="text-muted d-block">
                  Select site first, then choose one or more sub sites.
                </small>
              </div>
            </div>
          </div>

          <div className="col-12 d-flex justify-content-end gap-2 mt-1">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => navigate("/employees")}
            >
              Close
            </button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
