import axios from 'axios';
import { config } from '../config/env';

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier?: string
): Promise<GitHubTokenResponse> {
  const params: Record<string, string> = {
    client_id: config.github.clientId,
    client_secret: config.github.clientSecret,
    code,
    redirect_uri: config.github.callbackUrl,
  };

  if (codeVerifier) {
    params.code_verifier = codeVerifier;
  }

  const response = await axios.post<GitHubTokenResponse>(
    'https://github.com/login/oauth/access_token',
    params,
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.data.access_token) {
    throw new Error('Failed to obtain access token from GitHub');
  }

  return response.data;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await axios.get<GitHubUser>('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });
  return response.data;
}

export async function getGitHubUserEmail(accessToken: string): Promise<string> {
  try {
    const response = await axios.get<Array<{ email: string; primary: boolean }>>(
      'https://api.github.com/user/emails',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    const primary = response.data.find((e) => e.primary);
    return primary?.email || '';
  } catch {
    return '';
  }
}
