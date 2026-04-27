import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { PermissionRoute } from "../App";

vi.mock("../context/usePermissions", () => ({
  usePermissions: () => ({
    loading: false,
    can: () => false,
    canAny: () => false,
  }),
}));

describe("permission route guard", () => {
  test("redirects unauthorized users to access denied", async () => {
    localStorage.setItem("token", "token-1");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "user-1",
        name: "Restricted User",
      })
    );

    render(
      <MemoryRouter initialEntries={["/employees"]}>
        <Routes>
          <Route
            path="/employees"
            element={
              <PermissionRoute moduleKey="employee_master">
                <div>Protected Screen</div>
              </PermissionRoute>
            }
          />
          <Route path="/access-denied" element={<div>Access Denied</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Access Denied")).toBeInTheDocument();
  });
});
