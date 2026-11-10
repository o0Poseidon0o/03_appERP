import { Request, Response, NextFunction } from 'express';

const DEFAULT_AGENT_SECRET = '@Towa2026!#Secure_Agent_998811_AbCdEf';

/**
 * Middleware bảo mật cho PowerShell Agent đồng bộ cấu hình phần cứng/phần mềm.
 * Kiểm tra header `X-Agent-Secret-Key` (hoặc `x-api-key` để tương thích ngược).
 */
export const verifyAgentSecret = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clientSecret =
    (req.headers['x-agent-secret-key'] as string) ||
    (req.headers['x-api-key'] as string);

  const expectedSecret =
    process.env.AGENT_SECRET_KEY ||
    process.env.AGENT_API_KEY ||
    DEFAULT_AGENT_SECRET;

  if (!clientSecret || clientSecret !== expectedSecret) {
    console.warn(
      `[SECURITY] Từ chối request đồng bộ Agent trái phép từ IP: ${req.ip} (${req.originalUrl})`
    );
    return res.status(403).json({
      status: 'fail',
      message: 'Forbidden: Invalid or missing X-Agent-Secret-Key!',
    });
  }

  next();
};

