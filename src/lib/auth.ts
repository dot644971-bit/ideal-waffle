// ============================================================
// lib/auth.ts — Cross-Domain Token Authentication Utility
// ============================================================
// Works with the PHP auth system on auth.megaxtoon.eu.
// Token format: base64url(json_payload) . base64url(hmac_sha256_signature)
//
// The AUTH_TOKEN_SECRET must match the PHP AUTH_TOKEN_SECRET in config.php.
// Set it via NEXT_PUBLIC_AUTH_TOKEN_SECRET env var on Vercel.
// ============================================================

// --- Config ---
const TOKEN_LS_KEY = 'mx_auth_token';
const USER_LS_KEY  = 'mx_auth_user';
const AUTH_SECRET  = process.env.NEXT_PUBLIC_AUTH_TOKEN_SECRET || 'CHANGE_ME_generate_a_long_random_string_32chars_min';
const AUTH_LOGIN_URL = 'https://auth.megaxtoon.eu/login.php';
const AUTH_LOGOUT_URL = 'https://auth.megaxtoon.eu/logout.php';
const TOKEN_VERIFY_URL = 'https://auth.megaxtoon.eu/token_verify.php';

// --- Types ---
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  plan: string;
  avatar: string;
  active_profile: string;
}

export interface TokenPayload {
  sub: string;
  usr: string;
  email: string;
  plan: string;
  avatar: string;
  aprof: string;
  iat: number;
  exp: number;
}

// --- Base64url helpers ---
function b64urlEncode(str: string): string {
  if (typeof window !== 'undefined') {
    // Browser: use btoa with Unicode support
    const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    );
    return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Fallback for SSR
  return Buffer.from(str, 'utf-8').toString('base64url');
}

function b64urlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);

  if (typeof window !== 'undefined') {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  // Fallback for SSR
  return Buffer.from(str, 'base64').toString('utf-8');
}

// --- HMAC-SHA256 (Web Crypto API — async) ---
async function hmacSHA256(key: string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

function arrayBufferToB64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- Token operations ---

/**
 * Verifies the HMAC signature of a token.
 * Returns true if the signature is valid and the token is not expired.
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  if (!token || !token.includes('.')) return null;

  const [b64, sigB64] = token.split('.', 2);
  if (!b64 || !sigB64) return null;

  try {
    // Decode payload first to check expiry
    const jsonStr = b64urlDecode(b64);
    const payload = JSON.parse(jsonStr);

    if (!payload.exp || !payload.sub) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Verify HMAC signature
    const sig = await hmacSHA256(AUTH_SECRET, b64);
    const expectedSigB64 = arrayBufferToB64Url(sig);

    // Timing-safe comparison
    if (sigB64.length !== expectedSigB64.length) return null;
    let result = 0;
    for (let i = 0; i < sigB64.length; i++) {
      result |= sigB64.charCodeAt(i) ^ expectedSigB64.charCodeAt(i);
    }
    if (result !== 0) return null;

    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Decodes the token payload WITHOUT signature verification.
 * Use this for quick checks; call verifyToken for full validation.
 */
export function decodeTokenPayload(token: string): TokenPayload | null {
  if (!token || !token.includes('.')) return null;
  try {
    const [b64] = token.split('.', 2);
    const jsonStr = b64urlDecode(b64);
    const payload = JSON.parse(jsonStr);
    if (!payload.exp || !payload.sub) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extracts user data from a token payload.
 */
export function payloadToUser(payload: TokenPayload): AuthUser | null {
  if (!payload || !payload.sub) return null;
  return {
    id: payload.sub,
    username: payload.usr || '',
    email: payload.email || '',
    plan: payload.plan || 'free',
    avatar: payload.avatar || '',
    active_profile: payload.aprof || '',
  };
}

// --- localStorage operations ---

/**
 * Saves the auth token and user data to localStorage.
 */
export function saveAuth(token: string, payload: TokenPayload): void {
  if (typeof window === 'undefined') return;
  const user = payloadToUser(payload);
  if (!user) return;
  try {
    localStorage.setItem(TOKEN_LS_KEY, token);
    localStorage.setItem(USER_LS_KEY, JSON.stringify(user));
  } catch {
    // localStorage may be full or disabled
  }
}

/**
 * Loads auth data from localStorage.
 * Does NOT verify token expiry (use isAuthValid for that).
 */
export function loadAuth(): { token: string | null; user: AuthUser | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  try {
    const token = localStorage.getItem(TOKEN_LS_KEY);
    const userJson = localStorage.getItem(USER_LS_KEY);
    const user = userJson ? JSON.parse(userJson) as AuthUser : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

/**
 * Clears all auth data from localStorage.
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_LS_KEY);
    localStorage.removeItem(USER_LS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Checks if the current stored auth is valid (token exists and not expired).
 */
export function isAuthValid(): boolean {
  const { token } = loadAuth();
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  return payload !== null;
}

// --- URL token handling ---

/**
 * Handles token from URL query parameters.
 * - If ?token=xxx found: validates, saves to localStorage, cleans URL
 * - If ?action=logout found: clears localStorage, cleans URL
 * Returns the auth result.
 */
export function handleTokenFromUrl(): {
  handled: boolean;
  user: AuthUser | null;
  token: string | null;
} {
  if (typeof window === 'undefined') return { handled: false, user: null, token: null };

  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const tokenParam = params.get('token');

  // Handle logout action
  if (action === 'logout') {
    clearAuth();
    window.history.replaceState({}, '', window.location.pathname);
    return { handled: true, user: null, token: null };
  }

  // Handle token
  if (!tokenParam) return { handled: false, user: null, token: null };

  const payload = decodeTokenPayload(tokenParam);
  if (!payload) {
    // Invalid token — clean URL and return
    window.history.replaceState({}, '', window.location.pathname);
    return { handled: true, user: null, token: null };
  }

  saveAuth(tokenParam, payload);
  window.history.replaceState({}, '', window.location.pathname);

  return {
    handled: true,
    user: payloadToUser(payload),
    token: tokenParam,
  };
}

// --- Server-side token verification (optional) ---

/**
 * Verifies the token server-side via the PHP token_verify.php endpoint.
 * Returns refreshed user data and a new token.
 * Use this periodically to refresh the token and catch revoked sessions.
 */
export async function verifyTokenServerSide(token: string): Promise<{
  valid: boolean;
  user: AuthUser | null;
  token: string | null;
}> {
  try {
    const res = await fetch(TOKEN_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      return { valid: false, user: null, token: null };
    }

    const data = await res.json();
    if (!data.valid) {
      return { valid: false, user: null, token: null };
    }

    const user: AuthUser = {
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
      plan: data.user.plan,
      avatar: data.user.avatar,
      active_profile: data.user.active_profile,
    };

    // Save the refreshed token
    if (data.token) {
      const payload = decodeTokenPayload(data.token);
      if (payload) {
        saveAuth(data.token, payload);
      }
    }

    return { valid: true, user, token: data.token || null };
  } catch {
    // Network error — keep existing local auth
    return { valid: false, user: null, token: null };
  }
}

// --- Redirect helpers ---

export function getLoginUrl(returnUrl?: string): string {
  const base = AUTH_LOGIN_URL;
  if (returnUrl) {
    return `${base}?redirect=${encodeURIComponent(returnUrl)}`;
  }
  return base;
}

export function getLogoutUrl(): string {
  return AUTH_LOGOUT_URL;
}

export function redirectToLogin(returnUrl?: string): void {
  if (typeof window === 'undefined') return;
  window.location.href = getLoginUrl(returnUrl);
}

export function redirectToLogout(): void {
  if (typeof window === 'undefined') return;
  window.location.href = getLogoutUrl();
}
