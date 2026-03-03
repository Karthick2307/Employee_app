import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";

export default function EmployeeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [sitesList, setSitesList] = useState([]);

  const [form, setForm] = useState({
    employeeCode: "",
    employeeName: "",
    mobile: "",
    email: "",
    dateOfJoining: "",
    department: "",
    designation: "",
    sites: [],
    isActive: true
  });

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line
  }, []);

  const loadAll = async () => {
    try {
      const [emp, dep, des, sites] = await Promise.all([
        api.get(`/employees/${id}`),
        api.get("/departments"),
        api.get("/designations"),
        api.get("/sites")
      ]);

      const e = emp.data;

      setForm({
        employeeCode: e.employeeCode || "",
        employeeName: e.employeeName || "",
        mobile: e.mobile || "",
        email: e.email || "",
        dateOfJoining: e.dateOfJoining
          ? e.dateOfJoining.slice(0, 10)
          : "",
        department: e.department?._id || "",
        designation: e.designation?._id || "",
        sites: e.sites?.map(s => s._id) || [],
        isActive: e.isActive ?? true
      });

      setDepartments(dep.data);
      setDesignations(des.data);
      setSitesList(sites.data);
    } catch (err) {
      console.error("Edit load failed", err);
      alert("Failed to load employee");
    } finally {
      setLoading(false);
    }
  };

  /* ================= INPUT ================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const toggleSite = (siteId) => {
    setForm(prev => ({
      ...prev,
      sites: prev.sites.includes(siteId)
        ? prev.sites.filter(s => s !== siteId)
        : [...prev.sites, siteId]
    }));
  };

  /* ================= UPDATE ================= */
  const submit = async (e) => {
    e.preventDefault();

    const data = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (key === "sites") {
        value.forEach(v => data.append("sites", v));
      } else {
        data.append(key, value);
      }
    });

    // ✅ ONLY append photo if user selected new one
    if (photo instanceof File) {
      data.append("photo", photo);
    }

    try {
      await api.put(`/employees/${id}`, data, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      alert("Employee Updated Successfully");
      navigate("/employees"); // ✅ FIXED ROUTE
    } catch (err) {
      console.error(err);
      alert("Update failed");
    }
  };

  if (loading) {
    return <div className="container mt-4">Loading...</div>;
  }

  /* ================= UI ================= */
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

        <select
          className="form-select mb-2"
          name="department"
          value={form.department}
          onChange={handleChange}
          required
        >
          <option value="">Select Department</option>
          {departments.map(d => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          className="form-select mb-2"
          name="designation"
          value={form.designation}
          onChange={handleChange}
          required
        >
          <option value="">Select Designation</option>
          {designations.map(d => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>

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
            setForm(prev => ({
              ...prev,
              isActive: e.target.value === "true"
            }))
          }
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <input
          type="file"
          className="form-control mb-3"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files[0])}
        />

        <h6>Sites</h6>
        {sitesList.map(s => (
          <div className="form-check" key={s._id}>
            <input
              type="checkbox"
              className="form-check-input"
              checked={form.sites.includes(s._id)}
              onChange={() => toggleSite(s._id)}
            />
            <label className="form-check-label">{s.name}</label>
          </div>
        ))}

        <button className="btn btn-success mt-3 w-100">
          Update Employee
        </button>
      </form>
    </div>
  );
}