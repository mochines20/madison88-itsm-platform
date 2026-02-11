/**
 * Application error with HTTP status for proper API responses.
 * Use in services so the global error handler returns correct status codes.
 */
class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

module.exports = AppError;
