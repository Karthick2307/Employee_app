import { useEffect, useState } from "react";
import axios from "axios";

export default function DepartmentMaster() {
  const [departments, setDepartments] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    const res = await axios.get("http://localhost:5000/api/departments");
    setDepartments(res.data);
  };

  const saveDepartment = async () => {
    if (!name) return alert("Enter department name");
    await axios.post("http://localhost:5000/api/departments", { name });
    setName("");
    fetchDepartments();
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
        <button className="btn btn-success" onClick={saveDepartment}>
          Save
        </button>
      </div>

      <table className="table table-bordered">
        <thead>
          <tr>
            <th>#</th>
            <th>Department</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d, i) => (
            <tr key={d._id}>
              <td>{i + 1}</td>
              <td>{d.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}