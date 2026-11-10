"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAgentSecret = void 0;
const DEFAULT_AGENT_SECRET = '@Towa2026!#Secure_Agent_998811_AbCdEf';
const verifyAgentSecret = (req, res, next) => {
    const clientSecret = req.headers['x-agent-secret-key'] ||
        req.headers['x-api-key'];
    const expectedSecret = process.env.AGENT_SECRET_KEY ||
        process.env.AGENT_API_KEY ||
        DEFAULT_AGENT_SECRET;
    if (!clientSecret || clientSecret !== expectedSecret) {
        console.warn(`[SECURITY] Từ chối request đồng bộ Agent trái phép từ IP: ${req.ip} (${req.originalUrl})`);
        return res.status(403).json({
            status: 'fail',
            message: 'Forbidden: Invalid or missing X-Agent-Secret-Key!',
        });
    }
    next();
};
exports.verifyAgentSecret = verifyAgentSecret;
