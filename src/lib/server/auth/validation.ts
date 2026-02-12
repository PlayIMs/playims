import { z } from 'zod';

// Shared field-level validators for auth payloads/forms.
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailSchema = z
	.string()
	.trim()
	.max(254)
	.regex(SIMPLE_EMAIL_REGEX, 'Please enter a valid email address')
	.transform((value) => value.toLowerCase());

const passwordSchema = z.string().min(8).max(128);

const nameSchema = z.preprocess(
	(value) => {
		if (typeof value !== 'string') {
			return value;
		}

		const trimmed = value.trim();
		return trimmed.length === 0 ? undefined : trimmed;
	},
	z
		.string()
		.trim()
		.min(1)
		.max(80)
		.regex(/^[A-Za-z .'-]+$/)
		.optional()
);

const nextPathSchema = z
	.string()
	.trim()
	.max(500)
	.optional()
	.transform((value) => value ?? '');

const optionalUrlSchema = z.preprocess(
	(value) => {
		if (typeof value !== 'string') {
			return value;
		}

		const trimmed = value.trim();
		return trimmed.length === 0 ? undefined : trimmed;
	},
	z.string().trim().url('Please enter a valid URL.').max(500).optional()
);

const IANA_TIMEZONE_REGEX = /^[A-Za-z0-9_+\-/]+$/;
const isValidIanaTimezone = (value: string) => {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
		return true;
	} catch {
		return false;
	}
};

const timezoneSchema = z.preprocess(
	(value) => {
		if (typeof value !== 'string') {
			return value;
		}

		const trimmed = value.trim();
		return trimmed.length === 0 ? undefined : trimmed;
	},
	z
		.string()
		.trim()
		.max(80)
		.regex(IANA_TIMEZONE_REGEX, 'Please use a valid timezone format.')
		.refine(isValidIanaTimezone, 'Please enter a valid IANA timezone, like America/New_York.')
		.optional()
);

const CELL_PHONE_MASK_REGEX = /^\(\d{3}\)\s\d{3}-\d{4}$/;
const COUNTRY_CODE_REGEX = /^\+\d{1,3}$/;
const cellPhoneCountryCodeSchema = z
	.string()
	.trim()
	.regex(COUNTRY_CODE_REGEX, 'Please select a valid country code.');

const cellPhoneSchema = z.preprocess(
	(value) => {
		if (typeof value !== 'string') {
			return value;
		}

		const trimmed = value.trim();
		return trimmed.length === 0 ? undefined : trimmed;
	},
	z
		.string()
		.trim()
		.max(32)
		.regex(CELL_PHONE_MASK_REGEX, 'Please enter a valid phone in (###) ###-#### format.')
		.optional()
);

const optionalLongTextSchema = (maxLength: number) =>
	z.preprocess(
		(value) => {
			if (typeof value !== 'string') {
				return value;
			}

			const trimmed = value.trim();
			return trimmed.length === 0 ? undefined : trimmed;
		},
		z.string().trim().max(maxLength).optional()
	);

// Registration requires password confirmation + invite key.
export const registerSchema = z
	.object({
		email: emailSchema,
		password: passwordSchema,
		confirmPassword: z.string().min(1).max(128),
		inviteKey: z.string().trim().min(1).max(256),
		firstName: nameSchema,
		lastName: nameSchema,
		next: nextPathSchema
	})
	.refine((value) => value.password === value.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

// Login accepts email/password and optional post-login redirect.
export const loginSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	next: nextPathSchema
});

// Logout can optionally include a redirect target.
export const logoutSchema = z
	.object({
		next: nextPathSchema
	})
	.partial()
	.default({});

export const switchClientSchema = z.object({
	clientId: z.string().trim().uuid('Please provide a valid client ID.')
});

export const accountProfileSchema = z.object({
	firstName: nameSchema,
	lastName: nameSchema,
	cellPhoneCountryCode: cellPhoneCountryCodeSchema.default('+1'),
	cellPhone: cellPhoneSchema,
	avatarUrl: optionalUrlSchema,
	timezone: timezoneSchema
}).transform((value) => {
	const nationalDigits = value.cellPhone?.replace(/\D/g, '') ?? '';
	return {
		...value,
		cellPhone: nationalDigits.length > 0 ? `${value.cellPhoneCountryCode}${nationalDigits}` : undefined
	};
});

export const accountPreferencesSchema = z.object({
	preferences: optionalLongTextSchema(4000),
	notes: optionalLongTextSchema(4000)
});

export const accountPasswordChangeSchema = z
	.object({
		currentPassword: passwordSchema,
		newPassword: passwordSchema,
		confirmPassword: z.string().min(1).max(128)
	})
	.refine((value) => value.newPassword === value.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	})
	.refine((value) => value.currentPassword !== value.newPassword, {
		message: 'New password must be different from your current password.',
		path: ['newPassword']
	});

export const accountArchiveSchema = z.object({
	currentPassword: passwordSchema,
	confirmation: z
		.string()
		.trim()
		.max(32)
		.transform((value) => value.toUpperCase())
		.refine((value) => value === 'ARCHIVE', 'Type ARCHIVE to confirm.')
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AccountProfileInput = z.infer<typeof accountProfileSchema>;
export type AccountPreferencesInput = z.infer<typeof accountPreferencesSchema>;
export type AccountPasswordChangeInput = z.infer<typeof accountPasswordChangeSchema>;
export type AccountArchiveInput = z.infer<typeof accountArchiveSchema>;
export type SwitchClientInput = z.infer<typeof switchClientSchema>;
