import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  const selectedSet = new Set((selectedSiteIds || []).map((siteId) => String(siteId)));
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
  const selectedSet = new Set((selectedDepartmentIds || []).map((departmentId) => String(departmentId)));
  return (departmentRows || [])
    .filter((department) => selectedSet.has(String(department._id)))
    .flatMap((department) =>
      flattenSubDepartments(department.subDepartments || [], [], department)
    );
};

const toSubSiteSelectionValues = (rows = []) =>
  (rows || [])
    .map((row) => {
      const siteId = row.site?._id || row.site || row.siteId;
      const subSiteId = row.subSite?._id || row.subSite || row.subSiteId;
      if (!siteId || !subSiteId) return "";
      return `${siteId}${SUB_SITE_SEPARATOR}${subSiteId}`;
    })
    .filter(Boolean);

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

export default function EmployeeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [sitesList, setSitesList] = useState([]);
  const [superiorEmployees, setSuperiorEmployees] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [subSiteOptions, setSubSiteOptions] = useState([]);

  const uploadBaseUrl = useMemo(
    () => (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, ""),
    []
  );

  const [form, setForm] = useState({
    employeeCode: "",
    employeeName: "",
    mobile: "",
    email: "",
    password: "",
    dateOfJoining: "",
    department: [],
    subDepartment: [],
    designation: "",
    superiorEmployee: "",
    sites: [],
    subSites: [],
    isActive: true,
  });

  const loadAll = useCallback(async () => {
    try {
      const [emp, dep, des, sites, employeeRes] = await Promise.all([
        api.get(`/employees/${id}`),
        api.get("/departments"),
        api.get("/designations"),
        api.get("/sites"),
        api.get("/employees"),
      ]);

      const e = emp.data;
      const selectedDepartmentIds = normalizeSelectionValues(
        e.departmentIds?.length ? e.departmentIds : e.department
      );
      const selectedSiteIds = e.sites?.map((s) => s._id) || [];
      const initialSubSiteValues = toSubSiteSelectionValues(
        e.subSiteDetails?.length ? e.subSiteDetails : e.subSites
      );

      setForm({
        employeeCode: e.employeeCode || "",
        employeeName: e.employeeName || "",
        mobile: e.mobile || "",
        email: e.email || "",
        password: "",
        dateOfJoining: e.dateOfJoining ? e.dateOfJoining.slice(0, 10) : "",
        department: selectedDepartmentIds,
        subDepartment: normalizeSelectionValues(e.subDepartment),
        designation: e.designation?._id || "",
        superiorEmployee: e.superiorEmployee?._id || e.superiorEmployee || "",
        sites: selectedSiteIds,
        subSites: initialSubSiteValues,
        isActive: e.isActive ?? true,
      });

      setCurrentPhoto(e.photo || "");
      const departmentRows = dep.data || [];
      setDepartments(departmentRows);
      setDesignations(des.data || []);
      const siteRows = sites.data || [];
      setSitesList(siteRows);
      setSuperiorEmployees(
        (employeeRes.data || []).filter((employee) => String(employee._id) !== String(id))
      );
      setSubSiteOptions(buildSubSiteOptions(siteRows, selectedSiteIds));
      setSubDepartments(buildSubDepartmentOptions(departmentRows, selectedDepartmentIds));
    } catch (err) {
      console.error("Edit load failed", err);
      alert("Failed to load employee");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
    const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
    setForm((prev) => ({ ...prev, subSites: selectedValues }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);

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
      } else if (key === "password") {
        if (String(value || "").trim()) {
          data.append(key, value);
        }
      } else {
        data.append(key, value);
      }
    });

    if (photo instanceof File) {
      data.append("photo", photo);
    }

    try {
      await api.put(`/employees/${id}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Employee updated successfully");
      navigate("/employees");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container mt-4">Loading...</div>;
  }

  return (
    <div className="container mt-4">
      <h4>Edit Employee</h4>

      <form className="card p-4" onSubmit={submit}>
        <input
          className="form-control mb-2"
          name="employeeCode"
          value={form.employeeCode}
          onChange={handleChange}
          placeholder="Employee Code"
          required
        />

        <input
          className="form-control mb-2"
          name="employeeName"
          value={form.employeeName}
          onChange={handleChange}
          placeholder="Employee Name"
          required
        />

        <input
          className="form-control mb-2"
          name="mobile"
          value={form.mobile}
          onChange={handleChange}
          placeholder="Mobile"
        />

        <input
          className="form-control mb-2"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email"
        />

        <label className="form-label">New Login Password</label>
        <input
          className="form-control mb-2"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="New Login Password (leave blank to keep current)"
        />
        <small className="text-muted d-block mb-3">
          Employees can log in using Employee Code, Employee Name, or Email.
        </small>

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

        <select
          className="form-select mb-2"
          name="designation"
          value={form.designation}
          onChange={handleChange}
          required
        >
          <option value="">Select Designation</option>
          {designations.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          className="form-select mb-2"
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

        <label className="form-label">Sub Departments (Optional)</label>
        <select
          className="form-select mb-2"
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
        <small className="text-muted mb-3 d-block">
          Optional. Hold Ctrl (Windows) or Cmd (Mac) to select multiple sub departments.
        </small>

        <input
          type="date"
          className="form-control mb-2"
          name="dateOfJoining"
          value={form.dateOfJoining}
          onChange={handleChange}
        />

        <select
          className="form-select mb-3"
          value={form.isActive.toString()}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              isActive: e.target.value === "true",
            }))
          }
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <label className="form-label fw-semibold">Profile Photo</label>
        {(photoPreview || currentPhoto) && (
          <div className="mb-2">
            <img
              src={photoPreview || `${uploadBaseUrl}/uploads/${currentPhoto}`}
              alt="profile"
              width="72"
              height="72"
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          </div>
        )}
        <input
          type="file"
          className="form-control mb-3"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handlePhotoChange}
        />

        <label className="form-label fw-semibold">Sites (Multi Select)</label>
        <select
          className="form-select mb-1"
          multiple
          size={Math.min(8, Math.max(4, sitesList.length))}
          value={form.sites}
          onChange={handleSitesChange}
        >
          {sitesList.map((s) => (
            <option key={s._id} value={s._id}>
              {formatSiteLabel(s)}
            </option>
          ))}
        </select>
        <small className="text-muted mb-3 d-block">
          Hold Ctrl (Windows) or Cmd (Mac) to select multiple sites.
        </small>

        <label className="form-label fw-semibold">Sub Sites (Multi Select)</label>
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
        <small className="text-muted mb-3 d-block">
          Select site first, then choose one or more sub sites.
        </small>

        <button className="btn btn-success mt-2 w-100" disabled={saving}>
          {saving ? "Updating..." : "Update Employee"}
        </button>
      </form>
    </div>
  );
}
