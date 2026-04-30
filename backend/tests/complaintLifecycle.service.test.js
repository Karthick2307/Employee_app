const {
  buildComplaintDeadlineFields,
  buildReminderNotificationContent,
  getComplaintDeadlineState,
} = require("../services/complaintLifecycle.service");

describe("complaint lifecycle timing", () => {
  test("marks unresolved complaints as overdue after the SLA window", () => {
    const raisedAt = new Date(Date.now() - 26 * 60 * 60 * 1000);
    const deadlineFields = buildComplaintDeadlineFields(raisedAt);

    const state = getComplaintDeadlineState(
      {
        raisedAt,
        deadlineAt: deadlineFields.deadlineAt,
        status: "pending_main_admin",
        currentLevel: "main_admin",
      },
      new Date()
    );

    expect(state.isOverdue).toBe(true);
    expect(state.statusCode).toBe("overdue");
  });

  test("builds reminder content for the next complaint stage", () => {
    const message = buildReminderNotificationContent(
      {
        complaintCode: "CMP-001",
        employeeName: "Asha",
        siteDisplayName: "Repplen HQ",
        departmentName: "Operations",
        currentLevel: "main_admin",
        raisedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      new Date()
    );

    expect(message.title).toContain("CMP-001");
    expect(message.message).toContain("Current Pending Level");
    expect(message.message).toContain("Operations");
  });
});
