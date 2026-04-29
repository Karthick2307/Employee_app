import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import api from "../api/axios";
import ChatModule from "../pages/ChatModule";

vi.mock("../api/axios", () => ({
  default: {
    defaults: {
      baseURL: "",
    },
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const chatGroups = [
  {
    _id: "group-1",
    name: "Operations Site",
    scopeDisplayName: "Operations Site",
    companyName: "Repplen",
    members: [],
    unreadCount: 0,
    unreadMentionCount: 0,
  },
];

const renderChatModule = (props = {}) =>
  render(
    <MemoryRouter>
      <ChatModule chatType="site" apiBasePath="/chat" {...props} />
    </MemoryRouter>
  );

describe("chat module voice recorder", () => {
  beforeEach(() => {
    localStorage.setItem("user", JSON.stringify({ role: "admin" }));

    api.get.mockImplementation((url) => {
      const normalizedUrl = String(url || "");

      if (normalizedUrl.endsWith("/groups")) {
        return Promise.resolve({ data: { groups: chatGroups } });
      }

      if (normalizedUrl.includes("/messages")) {
        return Promise.resolve({ data: { messages: [] } });
      }

      return Promise.resolve({ data: { mentions: [] } });
    });
    api.post.mockResolvedValue({ data: {} });

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });

  test.each([
    ["site", "/chat"],
    ["department", "/department-chat"],
  ])("shows unsupported voice recording errors inline for %s chat", async (chatType, apiBasePath) => {
    renderChatModule({ chatType, apiBasePath });

    fireEvent.click(await screen.findByRole("button", { name: /record voice/i }));

    expect(
      await screen.findByText("Unable to start voice recording on this browser")
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("chat-composer__voice-error");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("shows microphone permission failures inline", async () => {
    function MockMediaRecorder() {}
    MockMediaRecorder.isTypeSupported = vi.fn(() => true);

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: MockMediaRecorder,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });

    renderChatModule();

    fireEvent.click(await screen.findByRole("button", { name: /record voice/i }));

    expect(
      await screen.findByText("Unable to start voice recording on this browser")
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("chat-composer__voice-error");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
