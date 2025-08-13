// CIRIS TypeScript SDK - Authentication Store
// Manages auth tokens with browser storage

import { User } from './types';
import Cookies from 'js-cookie';

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  role: string;
  created_at: number; // timestamp in ms
}

export class AuthStore {
  private static readonly STORAGE_KEY = 'ciris_auth_token';
  private static readonly USER_KEY = 'ciris_auth_user';

  static saveToken(token: AuthToken): void {
    if (typeof window !== 'undefined') {
      const tokenWithTimestamp = {
        ...token,
        created_at: Date.now()
      };
      // Save to localStorage
      if (window.localStorage) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokenWithTimestamp));
      }
      // Also save to cookies for compatibility
      Cookies.set('auth_token', token.access_token, {
        expires: token.expires_in / 86400 // Convert seconds to days
      });
    }
  }

  static getToken(): AuthToken | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      return null;
    }

    try {
      const token = JSON.parse(stored) as AuthToken;

      // Check if token is expired
      const expiresAt = token.created_at + (token.expires_in * 1000);
      if (Date.now() > expiresAt) {
        this.clearToken();
        return null;
      }

      return token;
    } catch {
      this.clearToken();
      return null;
    }
  }

  static clearToken(): void {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.USER_KEY);
      }
      // Also clear cookies
      Cookies.remove('auth_token');
    }
  }

  static saveUser(user: User): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  static getUser(): User | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const stored = localStorage.getItem(this.USER_KEY);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  static getAccessToken(): string | null {
    // First try to get from localStorage
    const token = this.getToken();
    if (token) {
      return token.access_token;
    }

    // Fallback to cookie for compatibility
    const cookieToken = Cookies.get('auth_token');
    return cookieToken || null;
  }
}
