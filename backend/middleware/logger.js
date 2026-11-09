import { randomUUID } from 'crypto';

export const requestLogger = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID().slice(0, 8);
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const statusCode = res.statusCode;

    // Filter out health check noise from logs
    if (originalUrl.startsWith('/health')) return;

    const logPayload = {
      requestId,
      method,
      url: originalUrl,
      status: statusCode,
      durationMs: duration,
      userId: req.user?._id?.toString() || 'anonymous',
    };

    if (statusCode >= 400) {
      console.warn(`[WARN] ${method} ${originalUrl} ${statusCode} - ${duration}ms [Req: ${requestId}]`);
    } else if (process.env.NODE_ENV !== 'production' || method !== 'GET') {
      console.log(`[INFO] ${method} ${originalUrl} ${statusCode} - ${duration}ms [Req: ${requestId}]`);
    }
  });

  next();
};
