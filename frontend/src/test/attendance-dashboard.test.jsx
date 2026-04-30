import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import AttendanceDashboard from "../pages/attendance/AttendanceDashboard";
import {
  getAttendanceDashboard,
  getAttendanceOptions,
} from "../api/attendanceApi";

vi.mock("../api/attendanceApi", () => ({
  getAttendanceDashboard: vi.fn(),
  getAttendanceOptions: vi.fn(),
}));

describe("attendance dashboard", () => {
  test("renders summary cards from API data", async () => {
    getAttendanceOptions.mockResolvedValue({
      data: {
        companies: [],
        sites: [],
        departments: [],
        subDepartments: [],
        employees: [],
      },
    });
    getAttendanceDashboard.mockResolvedValue({
      data: {
        cards: {
          presentCount: 12,
          absentCount: 3,
          lateCount: 2,
          leaveCount: 1,
          halfDayCount: 0,
          onDutyCount: 0,
          pendingCount: 0,
          missingCheckOutCount: 1,
        },
        siteWise: [],
        departmentWise: [],
        employeeWise: [],
        alertRows: [],
        employeesInScope: 18,
        dateLabel: "25 Apr 2026",
      },
    });

    render(<AttendanceDashboard />);

    expect(
      await screen.findByRole("heading", { name: /employee attendance dashboard/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Present").length).toBeGreaterThan(0);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/18 employees in current scope/i)).toBeInTheDocument();
  });
});
