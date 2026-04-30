import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import ChecklistList from "../pages/checklists/ChecklistList";
import api from "../api/axios";

vi.mock("../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../context/usePermissions", () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

describe("checklist list", () => {
  test("renders checklist rows for checklist masters", async () => {
    api.get.mockResolvedValue({
      data: [
        {
          _id: "checklist-1",
          checklistNumber: "CHK-001",
          checklistName: "Daily Safety Walk",
          checklistSourceSite: { name: "HQ" },
          assignedToEmployee: {
            employeeCode: "EMP-001",
            employeeName: "Asha",
          },
          priority: "high",
          scheduleType: "daily",
          scheduleTime: "09:00",
          startDate: "2026-04-25T00:00:00.000Z",
          endDate: null,
          endTime: "",
          nextOccurrenceAt: null,
          status: true,
          approvals: [],
          isDependentTask: false,
        },
      ],
    });

    render(
      <MemoryRouter>
        <ChecklistList />
      </MemoryRouter>
    );

    expect(await screen.findByText("Daily Safety Walk")).toBeInTheDocument();
    expect(screen.getByText("CHK-001")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /deactivate checklist master chk-001/i })
    ).toBeInTheDocument();
  });
});
