import { z } from 'zod';

// Shared field-level validators for auth payloads/forms.
const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

const passwordSchema = z.string().min(8).max(128);

const nameSchema = z
	.string()
	.trim()
	.min(1)
	.max(80)
	.regex(/^[A-Za-z .'-]+$/)
	.optional();

const nextPathSchema = z
	.string()
	.trim()
	.max(500)
	.optional()
	.transform((value) => value ?? '');

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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
