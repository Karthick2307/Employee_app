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
    <div style={{ border: "1px solid black", padding: 20 }}>
      <h3>{editData ? "Edit Employee" : "Add Employee"}</h3>

      <input placeholder="Code" value={form.employeeCode}
        onChange={e => setForm({ ...form, employeeCode: e.target.value })} />

      <input placeholder="Name" value={form.employeeName}
        onChange={e => setForm({ ...form, employeeName: e.target.value })} />

      <input placeholder="Department" value={form.department}
        onChange={e => setForm({ ...form, department: e.target.value })} />

      <input placeholder="Email" value={form.email}
        onChange={e => setForm({ ...form, email: e.target.value })} />

      <br /><br />
      <button onClick={submit}>Save</button>
      <button onClick={close}>Close</button>
    </div>
  );
}