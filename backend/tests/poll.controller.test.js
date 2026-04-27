jest.mock("../models/Company", () => ({}));
jest.mock("../models/Department", () => ({}));
jest.mock("../models/Employee", () => ({}));
jest.mock("../models/PollMaster", () => ({}));
jest.mock("../models/Site", () => ({}));
jest.mock("../services/accessScope.service", () => ({
  buildCompanyScopeFilter: jest.fn(),
  buildDepartmentScopeFilter: jest.fn(),
  buildSiteScopeFilter: jest.fn(),
  isAllScope: jest.fn(),
  resolveAccessibleEmployeeIds: jest.fn(),
}));

jest.mock("../models/PollAssignment", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/PollNotification", () => ({
  updateMany: jest.fn(),
}));

jest.mock("../models/PollResponse", () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

const PollAssignment = require("../models/PollAssignment");
const PollNotification = require("../models/PollNotification");
const PollResponse = require("../models/PollResponse");
const { createMockResponse } = require("./helpers/http");
const { submitPollResponse } = require("../controllers/poll.controller");

describe("poll.controller submitPollResponse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("stores a new poll response for an assigned employee", async () => {
    const assignment = {
      _id: "507f1f77bcf86cd799439011",
      employee: "507f1f77bcf86cd799439012",
      status: "not_answered",
      response: null,
      submittedAt: null,
      lastViewedAt: null,
      poll: {
        _id: "507f1f77bcf86cd799439013",
        status: "active",
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(Date.now() + 60 * 60 * 1000),
        allowResubmission: false,
        questions: [
          {
            _id: "507f1f77bcf86cd799439014",
            responseType: "single_choice",
            options: [
              {
                _id: "507f1f77bcf86cd799439015",
                text: "Yes",
              },
            ],
          },
        ],
      },
      save: jest.fn().mockResolvedValue(undefined),
    };

    PollAssignment.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(assignment),
    });
    PollResponse.findOne.mockResolvedValue(null);
    PollResponse.create.mockResolvedValue({
      _id: "507f1f77bcf86cd799439016",
    });
    PollNotification.updateMany.mockResolvedValue({ modifiedCount: 1 });

    const request = {
      user: {
        role: "employee",
        principalType: "employee",
        id: "507f1f77bcf86cd799439012",
      },
      params: {
        assignmentId: "507f1f77bcf86cd799439011",
      },
      body: {
        answers: JSON.stringify([
          {
            questionId: "507f1f77bcf86cd799439014",
            selectedOptionIds: ["507f1f77bcf86cd799439015"],
          },
        ]),
        remarks: "Done",
      },
      files: [
        {
          filename: "photo.png",
          originalname: "photo.png",
          mimetype: "image/png",
          size: 1234,
        },
      ],
    };
    const response = createMockResponse();

    await submitPollResponse(request, response);

    expect(PollResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        poll: "507f1f77bcf86cd799439013",
        assignment: "507f1f77bcf86cd799439011",
        employee: "507f1f77bcf86cd799439012",
        remarks: "Done",
        attachments: [
          expect.objectContaining({
            fileName: "photo.png",
            originalName: "photo.png",
          }),
        ],
      })
    );
    expect(assignment.status).toBe("submitted");
    expect(assignment.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Poll response submitted successfully",
      })
    );
  });
});
