import { useEffect, useState } from "react";
import axios from "axios";

export default function DesignationMaster() {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await axios.get("http://localhost:5000/api/designations");
    setList(res.data);
  };

  const saveData = async () => {
    if (!name) return alert("Enter designation");
    await axios.post("http://localhost:5000/api/designations", { name });
    setName("");
    fetchData();
  };

  return (
    <div className="container mt-4">
      <h3>Designation Master</h3>

      <div className="card p-3 mb-3">
        <input
          className="form-control mb-2"
          placeholder="Designation Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-success" onClick={saveData}>
          Save
        </button>
      </div>

      <table className="table table-bordered">
        <tbody>
          {list.map((d, i) => (
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