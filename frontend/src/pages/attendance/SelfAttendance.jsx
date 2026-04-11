import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../api/axios";
import { usePermissions } from "../../context/PermissionContext";
import {
  formatAttendanceDuration,
  getAttendanceStatusBadgeClass,
} from "../../utils/attendance";

export default function SelfAttendance() {
  const { user } = usePermissions();
  const [data, setData] = useState({
    settings: null,
    employee: null,
    todayRecord: null,
    recentRecords: [],
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [remarks, setRemarks] = useState("");

  if (user?.principalType !== "employee") {
    return <Navigate to="/attendance" replace />;
  }

  const loadSelfAttendance = async () => {
    setLoading(true);

    try {
      const response = await api.get("/attendance/self");
      setData({
        settings: response.data?.settings || null,
        employee: response.data?.employee || null,
        todayRecord: response.data?.todayRecord || null,
        recentRecords: Array.isArray(response.data?.recentRecords)
          ? response.data.recentRecords
          : [],
      });
    } catch (error) {
      console.error("Self attendance load failed:", error);
      setData({
        settings: null,
        employee: null,
        todayRecord: null,
        recentRecords: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSelfAttendance();
  }, []);

  const handleAction = async (actionKey) => {
    setActionLoading(actionKey);

    try {
      await api.post(`/attendance/self/${actionKey}`, {
        remarks,
      });
      setRemarks("");
      await loadSelfAttendance();
    } catch (error) {
      console.error(`Self attendance ${actionKey} failed:`, error);
      alert(error.response?.data?.message || `Failed to ${actionKey.replace("-", " ")}`);
    } finally {
      setActionLoading("");
    }
  };

  const todayRecord = data.todayRecord;
  const canCheckIn =
    Boolean(data.settings?.allowSelfCheckIn) && !todayRecord?.checkInTime;
  const canCheckOut =
    Boolean(data.settings?.allowSelfCheckOut) &&
    Boolean(todayRecord?.checkInTime) &&
    !todayRecord?.checkOutTime;

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="text-uppercase small fw-semibold text-muted">Attendance</div>
          <h2 className="mb-2">My Attendance</h2>
          <div className="text-muted">
            Self check-in, self check-out, and your recent attendance history.
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-uppercase fw-semibold text-muted mb-2">Employee</div>
              <h5>{data.employee?.displayName || "Current Employee"}</h5>
              <div className="text-muted mb-4">
                Use this screen to punch in and punch out for today.
              </div>

              {loading ? (
                <div className="text-muted">Loading attendance status...</div>
              ) : (
                <>
                  <div className="mb-3">
                    <div className="small text-muted">Today&apos;s Status</div>
                    <span
                      className={`badge ${getAttendanceStatusBadgeClass(
                        todayRecord?.status,
                        todayRecord?.isLate
                      )}`}
                    >
                      {todayRecord?.statusLabel || "Pending"}
                    </span>
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <div className="border rounded p-3 h-100">
                        <div className="small text-muted">Check In</div>
                        <div className="fw-semibold">{todayRecord?.checkInLabel || "-"}</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="border rounded p-3 h-100">
                        <div className="small text-muted">Check Out</div>
                        <div className="fw-semibold">{todayRecord?.checkOutLabel || "-"}</div>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="border rounded p-3">
                        <div className="small text-muted">Working Hours</div>
                        <div className="fw-semibold">
                          {todayRecord?.totalWorkingHoursLabel ||
                            formatAttendanceDuration(todayRecord?.totalWorkingMinutes)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Remarks</label>
                    <input
                      className="form-control"
                      placeholder="Optional punch note"
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                    />
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => handleAction("check-in")}
                      disabled={!canCheckIn || actionLoading === "check-in"}
                    >
                      {actionLoading === "check-in" ? "Checking In..." : "Check In"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleAction("check-out")}
                      disabled={!canCheckOut || actionLoading === "check-out"}
                    >
                      {actionLoading === "check-out" ? "Checking Out..." : "Check Out"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h5 className="mb-3">Recent Attendance</h5>
              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Working Hours</th>
                      <th>Late Minutes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="text-center">
                          Loading recent attendance...
                        </td>
                      </tr>
                    ) : data.recentRecords.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted">
                          No recent attendance history found
                        </td>
                      </tr>
                    ) : (
                      data.recentRecords.map((row) => (
                        <tr key={row._id}>
                          <td>{row.attendanceDateLabel}</td>
                          <td>
                            <span
                              className={`badge ${getAttendanceStatusBadgeClass(
                                row.status,
                                row.isLate
                              )}`}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          <td>{row.checkInLabel || "-"}</td>
                          <td>{row.checkOutLabel || "-"}</td>
                          <td>{row.totalWorkingHoursLabel || "0h 0m"}</td>
                          <td>{Number(row.lateMinutes || 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
