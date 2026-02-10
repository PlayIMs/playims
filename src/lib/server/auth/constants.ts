/**
 * Central auth/security defaults.
 *
 * Keep these values in one place so session and auth behavior stays consistent
 * across hooks, API handlers, and server actions.
 */
export const AUTH_SESSION_COOKIE_NAME = 'playims_session';
export const AUTH_SESSION_TTL_HOURS = 24;
export const AUTH_SESSION_TTL_SECONDS = AUTH_SESSION_TTL_HOURS * 60 * 60;
export const AUTH_SESSION_TTL_MS = AUTH_SESSION_TTL_SECONDS * 1000;
// Session is renewed when less than 6h remain (sliding session window).
export const AUTH_SESSION_RENEW_WINDOW_MS = 6 * 60 * 60 * 1000;
export const AUTH_PASSWORD_PROVIDER = 'password';

// PBKDF2 defaults for password hashing in Cloudflare-compatible runtime.
export const AUTH_PBKDF2_DIGEST = 'SHA-256';
export const AUTH_PBKDF2_DERIVED_BITS = 256;
export const AUTH_PBKDF2_DEFAULT_ITERATIONS = 210_000;

// Required environment variables for auth bootstrapping.
export const AUTH_ENV_KEYS = {
	sessionSecret: 'AUTH_SESSION_SECRET',
	signupInviteKey: 'AUTH_SIGNUP_INVITE_KEY',
	passwordIterations: 'AUTH_PASSWORD_PBKDF2_ITERATIONS'
} as const;
