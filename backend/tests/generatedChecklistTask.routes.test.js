const express = require("express");
const request = require("supertest");

const mockGetGeneratedChecklistTasks = jest.fn((_req, res) =>
  res.status(200).json({ route: "list" })
);
const mockDeleteGeneratedChecklistTask = jest.fn((_req, res) =>
  res.status(200).json({ route: "delete" })
);
const mockBulkDeleteGeneratedChecklistTasks = jest.fn((_req, res) =>
  res.status(200).json({ route: "bulk-delete" })
);

jest.mock("../middleware/auth", () => ({
  auth: (_req, _res, next) => next(),
}));

jest.mock("../middleware/permissions", () => ({
  requirePermission: () => (_req, _res, next) => next(),
}));

jest.mock("../middleware/validateRequest", () => ({
  validateRequest: () => (_req, _res, next) => next(),
}));

jest.mock("../controllers/checklist.controller", () => ({
  bulkDeleteGeneratedChecklistTasks: mockBulkDeleteGeneratedChecklistTasks,
  deleteGeneratedChecklistTask: mockDeleteGeneratedChecklistTask,
  getGeneratedChecklistTasks: mockGetGeneratedChecklistTasks,
}));

const generatedChecklistTaskRoutes = require("../routes/generatedChecklistTask.routes");

const createTestApp = () => {
  const app = express();
  app.use("/", generatedChecklistTaskRoutes);
  return app;
};

describe("generated checklist task routes", () => {
  beforeEach(() => {
    mockGetGeneratedChecklistTasks.mockClear();
    mockDeleteGeneratedChecklistTask.mockClear();
    mockBulkDeleteGeneratedChecklistTasks.mockClear();
  });

  test("routes the generated task list without checklist id validation", async () => {
    await request(createTestApp()).get("/").expect(200, { route: "list" });

    expect(mockGetGeneratedChecklistTasks).toHaveBeenCalledTimes(1);
  });

  test("routes generated task deletion separately from checklist master deletion", async () => {
    await request(createTestApp())
      .delete("/507f1f77bcf86cd799439011")
      .expect(200, { route: "delete" });

    expect(mockDeleteGeneratedChecklistTask).toHaveBeenCalledTimes(1);
  });

  test("routes generated task bulk deletion before id deletion", async () => {
    await request(createTestApp())
      .post("/bulk-delete")
      .send({ taskIds: ["507f1f77bcf86cd799439011"] })
      .expect(200, { route: "bulk-delete" });

    expect(mockBulkDeleteGeneratedChecklistTasks).toHaveBeenCalledTimes(1);
    expect(mockDeleteGeneratedChecklistTask).not.toHaveBeenCalled();
  });
});
