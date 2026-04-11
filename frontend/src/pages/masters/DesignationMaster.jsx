import { useEffect, useState } from "react";
import api from "../../api/axios";

export default function DesignationMaster() {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/designations");
      setList(res.data || []);
    } catch (err) {
      console.error("Load designations failed:", err);
      setList([]);
    }
  };

  const resetForm = () => {
    setName("");
    setEditingId("");
  };

  const saveData = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return alert("Enter designation");

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/designations/${editingId}`, { name: trimmedName });
      } else {
        await api.post("/designations", { name: trimmedName });
      }

      resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const editRow = (row) => {
    setName(row.name || "");
    setEditingId(row._id);
  };

  const deleteRow = async (id) => {
    if (!window.confirm("Delete this designation?")) return;

    try {
      await api.delete(`/designations/${id}`);
      if (editingId === id) resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="container-fluid px-3 px-lg-4 mt-4 mb-5">
      <h3>Designation Master</h3>

      <div className="card p-3 mb-3">
        <input
          className="form-control mb-2"
          placeholder="Designation Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-success" onClick={saveData} disabled={loading}>
            {loading ? "Saving..." : editingId ? "Update" : "Save"}
          </button>
          {editingId && (
            <button className="btn btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>#</th>
              <th>Designation</th>
              <th width="170">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d, i) => (
              <tr key={d._id}>
                <td>{i + 1}</td>
                <td>{d.name}</td>
                <td>
                  <div className="d-flex flex-wrap gap-2">
                    <button className="btn btn-sm btn-warning" onClick={() => editRow(d)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteRow(d._id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
