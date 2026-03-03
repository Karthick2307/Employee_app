import { useEffect, useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

export default function EmployeeForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);

  /* -------- MASTER DATA -------- */
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [sitesList, setSitesList] = useState([]);

  /* -------- FORM STATE -------- */
  const [form, setForm] = useState({
    employeeCode: "",
    employeeName: "",
    mobile: "",
    password: "",
    department: "",
    designation: "",
    email: "",
    dateOfJoining: "",
    sites: []
  });

  /* -------- LOAD MASTERS -------- */
  useEffect(() => {
    loadMasters();
  }, []);

  const loadMasters = async () => {
    try {
      const [deptRes, desigRes, siteRes] = await Promise.all([
        api.get("/departments"),
        api.get("/designations"),
        api.get("/sites")
      ]);

      setDepartments(deptRes.data || []);
      setDesignations(desigRes.data || []);
      setSitesList(siteRes.data || []);
    } catch (err) {
      console.error("Failed to load masters", err);
    }
  };

  /* -------- INPUT HANDLER -------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  /* -------- SITE CHECKBOX -------- */
  const toggleSite = (siteId) => {
    setForm((prev) => ({
      ...prev,
      sites: prev.sites.includes(siteId)
        ? prev.sites.filter((id) => id !== siteId)
        : [...prev.sites, siteId]
    }));
  };

  /* -------- SUBMIT -------- */
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();

      // Append fields safely
      Object.entries(form).forEach(([key, value]) => {
        if (key === "sites") {
          value.forEach((siteId) => data.append("sites", siteId));
        } else if (value !== "" && value !== null) {
          data.append(key, value);
        }
      });

      // Photo upload (MUST match upload.single("photo"))
      if (photo) {
        data.append("photo", photo);
      }

      await api.post("/employees", data);

      alert("Employee Saved Successfully");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Save failed");
    } finally {
      setLoading(false);
    }
  };

  /* -------- UI -------- */
  return (
    <div className="container mt-4">
      <h4>Add Employee</h4>

      <form
        className="card p-4"
        onSubmit={submit}
        encType="multipart/form-data"
      >
        <input
          className="form-control mb-2"
          name="employeeCode"
          placeholder="Employee Code"
          value={form.employeeCode}
          onChange={handleChange}
          required
        />

        <input
          className="form-control mb-2"
          name="employeeName"
          placeholder="Employee Name"
          value={form.employeeName}
          onChange={handleChange}
          required
        />

        <input
          className="form-control mb-2"
          name="mobile"
          placeholder="Mobile"
          value={form.mobile}
          onChange={handleChange}
        />

        <input
          className="form-control mb-2"
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
        />

        {/* DEPARTMENT */}
        <select
          className="form-select mb-2"
          name="department"
          value={form.department}
          onChange={handleChange}
          required
        >
          <option value="">-- Select Department --</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* DESIGNATION */}
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

        <input
          className="form-control mb-2"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />

        <input
          className="form-control mb-3"
          type="date"
          name="dateOfJoining"
          value={form.dateOfJoining}
          onChange={handleChange}
        />

        {/* PHOTO */}
        <input
          className="form-control mb-3"
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files[0])}
        />

        {/* SITES */}
        <h6>Employee Sites</h6>
        <div className="border rounded p-2 mb-3">
          {sitesList.length === 0 && (
            <div className="text-muted">No sites available</div>
          )}

          {sitesList.map((site) => (
            <div className="form-check" key={site._id}>
              <input
                className="form-check-input"
                type="checkbox"
                checked={form.sites.includes(site._id)}
                onChange={() => toggleSite(site._id)}
              />
              <label className="form-check-label">
                {site.name}
              </label>
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="btn btn-success w-100"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}