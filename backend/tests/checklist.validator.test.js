const { checklistCreateSchema } = require("../validators/checklist.validator");

const validChecklistPayload = {
  checklistName: "Daily review",
  assignedToEmployee: "507f1f77bcf86cd799439011",
  employeeAssignedSite: "507f1f77bcf86cd799439012",
  scheduleType: "daily",
  startDate: "2026-04-27",
  scheduleTime: "10:00",
  endDate: "2026-04-27",
  endTime: "18:00",
};

describe("checklist validator", () => {
  test("allows an empty optional checklist source site", () => {
    const parsedPayload = checklistCreateSchema.parse({
      ...validChecklistPayload,
      checklistSourceSite: "",
    });

    expect(parsedPayload.checklistSourceSite).toBeUndefined();
  });
});
