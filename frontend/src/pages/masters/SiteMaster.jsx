import { useEffect, useState } from "react";
import axios from "axios";

export default function SiteMaster() {
  const [sites, setSites] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    const res = await axios.get("http://localhost:5000/api/sites");
    setSites(res.data);
  };

  const saveSite = async () => {
    if (!name) return alert("Enter site name");
    await axios.post("http://localhost:5000/api/sites", { name });
    setName("");
    fetchSites();
  };

  return (
    <div className="container mt-4">
      <h3>Site Master</h3>

      <div className="card p-3 mb-3">
        <input
          className="form-control mb-2"
          placeholder="Site Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-success" onClick={saveSite}>
          Save
        </button>
      </div>

      <table className="table table-bordered">
        <tbody>
          {sites.map((s, i) => (
            <tr key={s._id}>
              <td>{i + 1}</td>
              <td>{s.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}