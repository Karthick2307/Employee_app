import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import ComplaintsReport from "../pages/complaints/ComplaintsReport";
import { getComplaintReport } from "../api/complaintApi";

vi.mock("../api/complaintApi", () => ({
  exportComplaintReport: vi.fn(),
  getComplaintDetail: vi.fn(),
  getComplaintReport: vi.fn(),
  updateComplaint: vi.fn(),
}));

vi.mock("../components/complaints/ComplaintDetailPanel", () => ({
  default: () => <div data-testid="complaint-detail-panel" />,
}));

describe("complaints report", () => {
  test("renders complaint summary data", async () => {
    getComplaintReport.mockResolvedValue({
      data: {
        summary: {
          total: 7,
          open: 2,
          inProgress: 3,
          resolved: 2,
          overdue: 1,
        },
        rows: [
          {
            _id: "complaint-1",
            complaintCode: "CMP-001",
            employeeName: "Asha",
            complaintText: "Broken access gate",
            companyName: "Repplen",
            siteDisplayName: "HQ",
            departmentName: "Operations",
            raisedAtLabel: "25 Apr 2026",
            currentLevelLabel: "Site Head",
            businessStatusLabel: "In Progress",
            workflowStatusLabel: "Pending",
            overdueStatusLabel: "Within SLA",
            slaClockLabel: "2h",
            completedAtLabel: "-",
          },
        ],
        filterOptions: {
          companies: [],
          sites: [],
          departments: [],
          employees: [],
          complaintStatuses: [],
          complaintLevels: [],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/complaints/reports"]}>
        <ComplaintsReport />
      </MemoryRouter>
    );

    expect(await screen.findByText("Complaint Report")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("CMP-001")).toBeInTheDocument();
  });
});
