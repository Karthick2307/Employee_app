class HttpError extends Error {
  constructor(message, status = 500, errors = []) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.errors = Array.isArray(errors) ? errors : [];
  }
}

const createHttpError = (message, status = 500, errors = []) =>
  new HttpError(message, status, errors);

module.exports = {
  HttpError,
  createHttpError,
};
