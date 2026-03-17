import { useEffect, useState } from "react";
import api from "../../api/axios";

export default function CompanyMaster() {
  const [companies, setCompanies] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await api.get("/companies");
      setCompanies(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Load companies failed:", err);
      setCompanies([]);
    }
  };

  const resetForm = () => {
    setName("");
    setEditingId("");
  };

  const saveCompany = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return alert("Enter company name");

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/companies/${editingId}`, { name: trimmedName });
      } else {
        await api.post("/companies", { name: trimmedName });
      }

      resetForm();
      fetchCompanies();
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
    if (!window.confirm("Delete this company?")) return;

    try {
      await api.delete(`/companies/${id}`);
      if (editingId === id) resetForm();
      fetchCompanies();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="container mt-4">
      <h3>Company Master</h3>

      <div className="card p-3 mb-3">
        <input
          className="form-control mb-2"
          placeholder="Company Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="d-flex gap-2">
          <button className="btn btn-success" onClick={saveCompany} disabled={loading}>
            {loading ? "Saving..." : editingId ? "Update" : "Save"}
          </button>
          {editingId && (
            <button className="btn btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <table className="table table-bordered">
        <thead>
          <tr>
            <th>#</th>
            <th>Company</th>
            <th width="170">Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.length === 0 && (
            <tr>
              <td colSpan="3" className="text-center">
                No companies found
              </td>
            </tr>
          )}

          {companies.map((company, index) => (
            <tr key={company._id}>
              <td>{index + 1}</td>
              <td>{company.name}</td>
              <td>
                <button
                  className="btn btn-sm btn-warning me-2"
                  onClick={() => editRow(company)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => deleteRow(company._id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
