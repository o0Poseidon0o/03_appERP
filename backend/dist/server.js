"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const socket_1 = require("./socket");
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
const httpServer = http_1.default.createServer(app_1.default);
(0, socket_1.initSocket)(httpServer);
const server = httpServer.listen(PORT, () => {
    console.log(`✅ Server đang chạy tại port ${PORT}`);
    console.log(`🚀 Socket.io đã sẵn sàng!`);
});
process.on('unhandledRejection', (err) => {
    console.log('UNHANDLED REJECTION! 💥 Đang tắt server...');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});
