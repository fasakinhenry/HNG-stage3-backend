"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeCodeForToken = exchangeCodeForToken;
exports.getGitHubUser = getGitHubUser;
exports.getGitHubUserEmail = getGitHubUserEmail;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
async function exchangeCodeForToken(code, codeVerifier) {
    const params = {
        client_id: env_1.config.github.clientId,
        client_secret: env_1.config.github.clientSecret,
        code,
        redirect_uri: env_1.config.github.callbackUrl,
    };
    if (codeVerifier) {
        params.code_verifier = codeVerifier;
    }
    const response = await axios_1.default.post('https://github.com/login/oauth/access_token', params, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    });
    if (!response.data.access_token) {
        throw new Error('Failed to obtain access token from GitHub');
    }
    return response.data;
}
async function getGitHubUser(accessToken) {
    const response = await axios_1.default.get('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
        },
    });
    return response.data;
}
async function getGitHubUserEmail(accessToken) {
    try {
        const response = await axios_1.default.get('https://api.github.com/user/emails', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
            },
        });
        const primary = response.data.find((e) => e.primary);
        return primary?.email || '';
    }
    catch {
        return '';
    }
}
