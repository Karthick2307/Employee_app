import { useState } from "react";
import api from "../api/employeeApi";
import { useNavigate } from "react-router-dom";

export default function EmployeeForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    employeeCode: "",
    employeeName: "",
    department: "",
    email: ""
  });

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async e => {
    e.preventDefault();
    await api.post("/", form);
    alert("Employee Saved");
    navigate("/");
  };

  return (
    <div className="container mt-4">
      <h4>Add Employee</h4>

      <form onSubmit={submit} className="card p-4 shadow">
        <div className="row">
          <div className="col-md-6 mb-3">
            <label>Employee Code</label>
            <input className="form-control"
              name="employeeCode"
              onChange={handleChange} required />
          </div>

          <div className="col-md-6 mb-3">
            <label>Employee Name</label>
            <input className="form-control"
              name="employeeName"
              onChange={handleChange} required />
          </div>

          <div className="col-md-6 mb-3">
            <label>Department</label>
            <input className="form-control"
              name="department"
              onChange={handleChange} />
          </div>

          <div className="col-md-6 mb-3">
            <label>Email</label>
            <input className="form-control"
              name="email"
              onChange={handleChange} />
          </div>
        </div>

        <button className="btn btn-success">Save</button>
      </form>
    </div>
  );
}