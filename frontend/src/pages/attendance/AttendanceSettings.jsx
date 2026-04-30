import { useEffect, useState } from "react";
import api from "../../api/axios";

const defaultForm = {
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  graceMinutes: 15,
  minimumFullDayHours: 8,
  minimumHalfDayHours: 4,
  missingCheckInStatus: "absent",
  allowSelfCheckIn: true,
  allowSelfCheckOut: true,
  allowRegularization: true,
  futureBiometricEnabled: false,
  futureQrEnabled: false,
  futureGpsEnabled: false,
  lateAlertEnabled: false,
  missingCheckoutAlertEnabled: false,
  absenceAlertEnabled: false,
  reminderAlertEnabled: false,
};

export default function AttendanceSettings() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);

      try {
        const response = await api.get("/attendance/settings");
        setForm({
          ...defaultForm,
          ...(response.data || {}),
        });
      } catch (error) {
        console.error("Attendance settings load failed:", error);
        setForm(defaultForm);
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);

    try {
      await api.put("/attendance/settings", {
        ...form,
        graceMinutes: Number(form.graceMinutes || 0),
        minimumFullDayHours: Number(form.minimumFullDayHours || 0),
        minimumHalfDayHours: Number(form.minimumHalfDayHours || 0),
      });
      alert("Attendance settings updated successfully");
    } catch (error) {
      console.error("Attendance settings save failed:", error);
      alert(error.response?.data?.message || "Failed to update attendance settings");
    } finally {
      setSaving(false);
    }
  };

  const updateToggle = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.checked }));

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="text-uppercase small fw-semibold text-muted">Attendance</div>
          <h2 className="mb-2">Attendance Settings</h2>
          <div className="text-muted">
            Configure office timings, grace rules, self service attendance, and future device support.
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Loading attendance settings...</div>
          ) : (
            <>
              <div className="row g-3">
                <div className="col-12 col-md-6 col-xl-2">
                  <label className="form-label">Office Start</label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.officeStartTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, officeStartTime: event.target.value }))
                    }
                  />
                </div>
                <div className="col-12 col-md-6 col-xl-2">
                  <label className="form-label">Office End</label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.officeEndTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, officeEndTime: event.target.value }))
                    }
                  />
                </div>
                <div className="col-12 col-md-6 col-xl-2">
                  <label className="form-label">Grace Minutes</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    value={form.graceMinutes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, graceMinutes: event.target.value }))
                    }
                  />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <label className="form-label">Minimum Full Day Hours</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="0.5"
                    value={form.minimumFullDayHours}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minimumFullDayHours: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <label className="form-label">Minimum Half Day Hours</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="0.5"
                    value={form.minimumHalfDayHours}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minimumHalfDayHours: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <label className="form-label">Missing Check-In Rule</label>
                  <select
                    className="form-select"
                    value={form.missingCheckInStatus}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        missingCheckInStatus: event.target.value,
                      }))
                    }
                  >
                    <option value="absent">Mark as Absent</option>
                    <option value="pending">Keep as Pending</option>
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="allowSelfCheckIn"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.allowSelfCheckIn)}
                      onChange={updateToggle("allowSelfCheckIn")}
                    />
                    <label className="form-check-label" htmlFor="allowSelfCheckIn">
                      Allow Self Check-In
                    </label>
                  </div>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="allowSelfCheckOut"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.allowSelfCheckOut)}
                      onChange={updateToggle("allowSelfCheckOut")}
                    />
                    <label className="form-check-label" htmlFor="allowSelfCheckOut">
                      Allow Self Check-Out
                    </label>
                  </div>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="allowRegularization"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.allowRegularization)}
                      onChange={updateToggle("allowRegularization")}
                    />
                    <label className="form-check-label" htmlFor="allowRegularization">
                      Allow Regularization Requests
                    </label>
                  </div>
                </div>
              </div>

              <hr className="my-4" />

              <h5 className="mb-3">Optional Alerts</h5>
              <div className="row g-3">
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="lateAlertEnabled"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.lateAlertEnabled)}
                      onChange={updateToggle("lateAlertEnabled")}
                    />
                    <label className="form-check-label" htmlFor="lateAlertEnabled">
                      Late Check-In Alerts
                    </label>
                  </div>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="missingCheckoutAlertEnabled"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.missingCheckoutAlertEnabled)}
                      onChange={updateToggle("missingCheckoutAlertEnabled")}
                    />
                    <label className="form-check-label" htmlFor="missingCheckoutAlertEnabled">
                      Missing Check-Out Alerts
                    </label>
                  </div>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="absenceAlertEnabled"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.absenceAlertEnabled)}
                      onChange={updateToggle("absenceAlertEnabled")}
                    />
                    <label className="form-check-label" htmlFor="absenceAlertEnabled">
                      Absence Alerts
                    </label>
                  </div>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="reminderAlertEnabled"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.reminderAlertEnabled)}
                      onChange={updateToggle("reminderAlertEnabled")}
                    />
                    <label className="form-check-label" htmlFor="reminderAlertEnabled">
                      Daily Reminder Alerts
                    </label>
                  </div>
                </div>
              </div>

              <hr className="my-4" />

              <h5 className="mb-3">Future Integrations</h5>
              <div className="row g-3">
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="futureBiometricEnabled"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.futureBiometricEnabled)}
                      onChange={updateToggle("futureBiometricEnabled")}
                    />
                    <label className="form-check-label" htmlFor="futureBiometricEnabled">
                      Biometric Ready
                    </label>
                  </div>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="futureQrEnabled"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.futureQrEnabled)}
                      onChange={updateToggle("futureQrEnabled")}
                    />
                    <label className="form-check-label" htmlFor="futureQrEnabled">
                      QR Attendance Ready
                    </label>
                  </div>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <div className="form-check">
                    <input
                      id="futureGpsEnabled"
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.futureGpsEnabled)}
                      onChange={updateToggle("futureGpsEnabled")}
                    />
                    <label className="form-check-label" htmlFor="futureGpsEnabled">
                      GPS Attendance Ready
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Attendance Settings"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
