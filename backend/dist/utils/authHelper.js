"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.comparePassword = exports.signToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const signToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '1d'),
    });
};
exports.signToken = signToken;
const comparePassword = async (candidatePassword, userPassword) => {
    return await bcryptjs_1.default.compare(candidatePassword, userPassword);
};
exports.comparePassword = comparePassword;
