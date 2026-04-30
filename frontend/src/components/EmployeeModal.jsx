import { useState } from "react";
import { addEmployee, updateEmployee } from "../api/employeeApi";

export default function EmployeeModal({ close, reload, editData }) {
  const [form, setForm] = useState(editData || {
    employeeCode: "",
    employeeName: "",
    department: "",
    email: ""
  });

  const submit = async () => {
    if (editData)
      await updateEmployee(editData._id, form);
    else
      await addEmployee(form);

    reload();
    close();
  };

  return (
    <div className="app-legacy-card p-4">
      <h3 className="mb-3">{editData ? "Edit Employee" : "Add Employee"}</h3>

      <div className="d-flex flex-column gap-3">
        <input
          className="form-control"
          placeholder="Code"
          value={form.employeeCode}
          onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
        />

        <input
          className="form-control"
          placeholder="Name"
          value={form.employeeName}
          onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
        />

        <input
          className="form-control"
          placeholder="Department"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        />

        <input
          className="form-control"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>

      <div className="d-flex gap-2 mt-4">
        <button type="button" className="btn btn-success" onClick={submit}>
          Save
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}
