const { requirePermission } = require("../middleware/permissions");
const { createMockResponse } = require("./helpers/http");

describe("requirePermission middleware", () => {
  test("allows requests when the action is granted", () => {
    const middleware = requirePermission("employee_master", "view");
    const next = jest.fn();

    middleware(
      {
        user: {
          permissions: {
            employee_master: {
              canView: true,
            },
          },
        },
      },
      createMockResponse(),
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("returns 403 when the action is not granted", () => {
    const middleware = requirePermission("employee_master", "delete");
    const response = createMockResponse();
    const next = jest.fn();

    middleware(
      {
        user: {
          permissions: {
            employee_master: {
              canView: true,
              canDelete: false,
            },
          },
        },
      },
      response,
      next
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "You do not have permission to perform this action",
        moduleKey: "employee_master",
        actionKey: "delete",
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
