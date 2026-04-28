const express = require("express");
const request = require("supertest");

const loadRateLimitMiddleware = (envOverrides = {}) => {
  jest.resetModules();
  jest.doMock("../config/env", () => ({
    env: {
      nodeEnv: "development",
      loginRateLimitWindowMinutes: 15,
      loginRateLimitMaxAttemptsDev: 2,
      loginRateLimitMaxAttemptsProd: 1,
      ...envOverrides,
    },
  }));

  return require("../middleware/rateLimit");
};

describe("auth login rate limiter", () => {
  afterEach(() => {
    jest.dontMock("../config/env");
    jest.resetModules();
  });

  test("uses development max attempts and returns retry minutes after the limit", async () => {
    const { authRateLimiter } = loadRateLimitMiddleware();
    const app = express();
    app.post("/login", authRateLimiter, (_req, res) => res.json({ success: true }));

    await request(app).post("/login").expect(200);
    await request(app).post("/login").expect(200);

    const response = await request(app).post("/login").expect(429);

    expect(response.body).toEqual({
      success: false,
      message: "Too many authentication attempts. Please try again after 15 minutes.",
      retryAfterMinutes: 15,
    });
    expect(response.headers["retry-after"]).toBe("900");
  });

  test("uses the production max attempts when NODE_ENV is production", () => {
    const { loginRateLimitMaxAttempts } = loadRateLimitMiddleware({
      nodeEnv: "production",
      loginRateLimitMaxAttemptsDev: 100,
      loginRateLimitMaxAttemptsProd: 5,
    });

    expect(loginRateLimitMaxAttempts).toBe(5);
  });
});
