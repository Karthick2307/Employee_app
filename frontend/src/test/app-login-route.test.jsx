import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import Login from "../pages/Login";

vi.mock("../api/authApi", () => ({
  login: vi.fn(),
}));

vi.mock("../context/usePermissions", () => ({
  usePermissions: () => ({
    refresh: vi.fn(),
  }),
}));

describe("login route", () => {
  test("renders the login form", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(
      screen.getByPlaceholderText(/employee code, employee name, or email/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });
});
