import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestedStatus = Number(err.statusCode || err.status);
  const statusCode = requestedStatus >= 400 && requestedStatus < 500 ? requestedStatus : 500;
  const requestId = req.headers['x-request-id'];
  console.error(`[SKILLBRIDGE API] requestId=${requestId} error=${err.name || 'UnknownError'}`);

  res.status(statusCode).json({
    success: false,
    error: statusCode < 500 ? err.message : 'Internal server error',
    requestId,
    timestamp: new Date().toISOString(),
  });
};
