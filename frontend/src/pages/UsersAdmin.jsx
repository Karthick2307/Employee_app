import { useEffect, useState } from "react";
import api from "../api/axios";

const defaultForm = {
  name: "",
  email: "",
  password: "",
  role: "user",
};

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingUserId, setEditingUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/auth/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingUserId("");
  };

  const handleEdit = (user) => {
    setError("");
    setSuccess("");
    setEditingUserId(user._id);
    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "user",
    });
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.email}"?`)) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/auth/users/${user._id}`);
      setSuccess("User deleted successfully");

      if (editingUserId === user._id) {
        resetForm();
      }

      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete user");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
      };

      if (form.password) {
        payload.password = form.password;
      }

      if (editingUserId) {
        await api.put(`/auth/users/${editingUserId}`, payload);
        setSuccess("User updated successfully");

        if (String(currentUser.id || "") === String(editingUserId)) {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...currentUser,
              name: payload.name,
              email: payload.email,
              role: payload.role,
            })
          );
        }
      } else {
        if (!form.password) {
          throw new Error("Password is required");
        }

        await api.post("/auth/users", payload);
        setSuccess("User created successfully");
      }

      resetForm();
      loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          (editingUserId ? "Failed to update user" : "Failed to create user")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mt-4">
      <h4 className="mb-3">Admin User Panel</h4>

      <div className="card mb-4">
        <div className="card-body">
          <h6 className="card-title">
            {editingUserId ? "Edit Login User" : "Create Login User"}
          </h6>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {success && <div className="alert alert-success py-2">{success}</div>}

          <form className="row g-2" onSubmit={handleSubmit}>
            <div className="col-md-3">
              <input
                className="form-control"
                name="name"
                placeholder="Name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-3">
              <input
                type="email"
                className="form-control"
                name="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-2">
              <input
                type="password"
                className="form-control"
                name="password"
                placeholder={editingUserId ? "New Password (optional)" : "Password"}
                value={form.password}
                onChange={handleChange}
                required={!editingUserId}
                minLength={form.password ? 6 : undefined}
              />
            </div>

            <div className="col-md-2">
              <select
                className="form-select"
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="col-md-2 d-grid">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : editingUserId ? "Update User" : "Create User"}
              </button>
            </div>

            {editingUserId && (
              <div className="col-md-2 d-grid">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h6 className="card-title">Multiple Users View</h6>

          <div className="table-responsive">
            <table className="table table-striped table-bordered">
              <thead className="table-dark">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="5" className="text-center">
                      Loading users...
                    </td>
                  </tr>
                )}

                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center">
                      No users found
                    </td>
                  </tr>
                )}

                {!loading &&
                  users.map((user) => (
                    <tr key={user._id}>
                      <td>
                        {user.name}
                        {String(currentUser.id || "") === String(user._id) && (
                          <span className="badge bg-info text-dark ms-2">You</span>
                        )}
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span
                          className={`badge ${
                            user.role === "admin" ? "bg-danger" : "bg-secondary"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td>
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleString()
                          : "-"}
                      </td>
                      <td className="text-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-warning me-2"
                          onClick={() => handleEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(user)}
                          disabled={String(currentUser.id || "") === String(user._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
