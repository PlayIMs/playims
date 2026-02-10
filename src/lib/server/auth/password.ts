import {
	AUTH_PBKDF2_DEFAULT_ITERATIONS,
	AUTH_PBKDF2_DERIVED_BITS,
	AUTH_PBKDF2_DIGEST
} from './constants';

/**
 * Password storage format:
 * pbkdf2_sha256$<iterations>$<salt_base64url>$<hash_base64url>
 *
 * We also include a server-side "pepper" (AUTH_SESSION_SECRET) in derivation:
 * password + ':' + pepper. This means stolen DB hashes are less useful without
 * the server secret.
 */
const textEncoder = new TextEncoder();

const bytesToBinary = (bytes: Uint8Array): string => {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i]);
	}
	return binary;
};

const binaryToBytes = (binary: string): Uint8Array => {
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
};

const toBase64Url = (bytes: Uint8Array): string =>
	btoa(bytesToBinary(bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');

const fromBase64Url = (value: string): Uint8Array => {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	return binaryToBytes(atob(padded));
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
};

const constantTimeEquals = (a: Uint8Array, b: Uint8Array): boolean => {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i += 1) {
		result |= a[i] ^ b[i];
	}

	return result === 0;
};

const derivePasswordHash = async (input: {
	password: string;
	pepper: string;
	salt: Uint8Array;
	iterations: number;
}): Promise<Uint8Array> => {
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		textEncoder.encode(`${input.password}:${input.pepper}`),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: AUTH_PBKDF2_DIGEST,
			iterations: input.iterations,
			salt: toArrayBuffer(input.salt)
		},
		keyMaterial,
		AUTH_PBKDF2_DERIVED_BITS
	);

	return new Uint8Array(derivedBits);
};

const parsePasswordHash = (value: string) => {
	const [algorithm, iterationsText, saltValue, hashValue] = value.split('$');
	if (!algorithm || !iterationsText || !saltValue || !hashValue) {
		return null;
	}

	if (algorithm !== 'pbkdf2_sha256') {
		return null;
	}

	const iterations = Number.parseInt(iterationsText, 10);
	if (!Number.isFinite(iterations) || iterations <= 0) {
		return null;
	}

	try {
		return {
			iterations,
			salt: fromBase64Url(saltValue),
			hash: fromBase64Url(hashValue)
		};
	} catch {
		return null;
	}
};

/**
 * Clamp iterations into a safe range to avoid weak hashing or runtime abuse.
 */
export const normalizeIterations = (value: string | undefined): number => {
	if (!value) {
		return AUTH_PBKDF2_DEFAULT_ITERATIONS;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 100_000 || parsed > 2_000_000) {
		return AUTH_PBKDF2_DEFAULT_ITERATIONS;
	}

	return parsed;
};

/**
 * Creates a new salted PBKDF2 hash string for storage.
 */
export const hashPassword = async (input: {
	password: string;
	pepper: string;
	iterations: number;
}): Promise<string> => {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await derivePasswordHash({
		password: input.password,
		pepper: input.pepper,
		salt,
		iterations: input.iterations
	});

	return `pbkdf2_sha256$${input.iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
};

/**
 * Verifies a plaintext password against the stored hash in constant time.
 */
export const verifyPassword = async (input: {
	password: string;
	pepper: string;
	storedHash: string;
}): Promise<boolean> => {
	const parsed = parsePasswordHash(input.storedHash);
	if (!parsed) {
		return false;
	}

	const computed = await derivePasswordHash({
		password: input.password,
		pepper: input.pepper,
		salt: parsed.salt,
		iterations: parsed.iterations
	});

	return constantTimeEquals(computed, parsed.hash);
};
