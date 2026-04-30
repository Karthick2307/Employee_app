const createMockResponse = () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return response;
};

module.exports = {
  createMockResponse,
};
