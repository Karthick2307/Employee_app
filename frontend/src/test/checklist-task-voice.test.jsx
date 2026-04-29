import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import api from "../api/axios";
import ChecklistTaskView from "../pages/checklists/ChecklistTaskView";

vi.mock("../api/axios", () => ({
  default: {
    defaults: {
      baseURL: "",
    },
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const buildTask = () => ({
  _id: "task-1",
  taskNumber: "TASK-001",
  checklistNumber: "CHK-001",
  checklistName: "Daily Safety Walk",
  assignedEmployee: {
    _id: "employee-1",
    employeeCode: "EMP-001",
    employeeName: "Asha",
  },
  status: "open",
  scheduleType: "daily",
  priority: "medium",
  approvalType: "normal",
  isNilApproval: false,
  checklistItems: [
    {
      _id: "item-1",
      checklistItemId: "item-1",
      label: "Confirm area is safe",
      detail: "",
      isRequired: true,
      employeeAnswerRemark: "",
      superiorAnswerRemark: "",
      answer: "",
      remarks: "",
      verified: false,
    },
  ],
  employeeAttachments: [],
  approvalSteps: [
    {
      approvalLevel: 1,
      approverEmployee: {
        _id: "employee-2",
        employeeCode: "EMP-002",
        employeeName: "Ravi",
      },
      status: "waiting",
      remarks: "",
      actedAt: null,
    },
  ],
});

const renderTaskView = () =>
  render(
    <MemoryRouter initialEntries={["/checklists/tasks/task-1"]}>
      <Routes>
        <Route path="/checklists/tasks/:id" element={<ChecklistTaskView />} />
      </Routes>
    </MemoryRouter>
  );

describe("checklist task voice recording", () => {
  beforeEach(() => {
    localStorage.setItem("user", JSON.stringify({ id: "employee-1", role: "employee" }));

    api.get.mockResolvedValue({ data: buildTask() });
    api.post.mockResolvedValue({ data: {} });

    vi.spyOn(window, "alert").mockImplementation(() => {});

    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:voice-preview"),
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });

  test("shows unsupported recorder errors inline on the task detail screen", async () => {
    renderTaskView();

    fireEvent.click(await screen.findByRole("button", { name: /record voice/i }));

    expect(
      await screen.findByText("Unable to start voice recording on this browser.")
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("checklist-voice-recorder__error");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("submits a recorded voice file as a checklist attachment", async () => {
    let recorderInstance;

    class MockMediaRecorder {
      constructor(_stream, options = {}) {
        this.mimeType = options.mimeType || "audio/webm";
        this.state = "inactive";
        recorderInstance = this;
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["voice"], { type: "audio/webm" }),
        });
        this.onstop?.();
      }
    }

    MockMediaRecorder.isTypeSupported = vi.fn((mimeType) => mimeType === "audio/webm");

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: MockMediaRecorder,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });

    renderTaskView();

    fireEvent.change(await screen.findByPlaceholderText(/enter the required answer or remark/i), {
      target: { value: "Checked and safe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /record voice/i }));

    await waitFor(() => expect(recorderInstance).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^stop$/i }));

    expect(await screen.findByText(/checklist-voice-/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /submit for approval/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/checklists/tasks/task-1/submit",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
    });

    const submittedPayload = api.post.mock.calls[0][1];
    const submittedAttachments = submittedPayload.getAll("attachments");

    expect(submittedAttachments).toHaveLength(1);
    expect(submittedAttachments[0]).toBeInstanceOf(File);
    expect(submittedAttachments[0].type).toBe("audio/webm");
    expect(submittedAttachments[0].name).toMatch(/^checklist-voice-.*\.webm$/);
  });
});
