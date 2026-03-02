import { z } from 'zod';

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const memberAssignableRoleSchema = z.enum(['participant', 'manager', 'admin']);
export const memberSexSchema = z.enum(['M', 'F']);
export const memberRoleFilterSchema = z.enum(['participant', 'manager', 'admin', 'dev']);
export const memberSortKeySchema = z
	.enum(['studentId', 'firstName', 'lastName', 'name', 'email', 'sex', 'role'])
	.transform((value) => (value === 'name' ? 'lastName' : value));
export const sortDirectionSchema = z.enum(['asc', 'desc']);
export const memberInviteModeSchema = z.enum(['invite', 'preprovision']);

const optionalTrimmedString = (maxLength: number) =>
	z.preprocess(
		(value) => {
			if (typeof value !== 'string') {
				return value;
			}

			const trimmed = value.trim();
			return trimmed.length > 0 ? trimmed : undefined;
		},
		z.string().trim().max(maxLength).optional()
	);

const nameSchema = z.preprocess(
	(value) => {
		if (typeof value !== 'string') {
			return value;
		}

		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	},
	z
		.string()
		.trim()
		.min(1)
		.max(80)
		.regex(/^[A-Za-z .'-]+$/, 'Use letters, spaces, apostrophes, periods, or hyphens only.')
		.optional()
);

const emailSchema = z
	.string()
	.trim()
	.max(254)
	.regex(SIMPLE_EMAIL_REGEX, 'Please enter a valid email address.')
	.transform((value) => value.toLowerCase());

const studentIdSchema = optionalTrimmedString(64);

export const memberListQuerySchema = z.object({
	q: z
		.preprocess(
			(value) => (value === null ? undefined : value),
			z.string().trim().max(120).optional()
		)
		.transform((value) => value ?? ''),
	sex: z.preprocess(
		(value) => (value === null ? undefined : value),
		memberSexSchema.optional()
	),
	role: z.preprocess(
		(value) => (value === null ? undefined : value),
		memberRoleFilterSchema.optional()
	),
	sort: memberSortKeySchema.optional().default('lastName'),
	dir: sortDirectionSchema.optional().default('asc'),
	page: z.coerce.number().int().min(1).optional().default(1)
});

export const createMemberSchema = z
	.object({
		mode: memberInviteModeSchema,
		email: emailSchema,
		role: memberAssignableRoleSchema,
		firstName: nameSchema,
		lastName: nameSchema,
		studentId: studentIdSchema,
		sex: memberSexSchema.optional()
	})
	.superRefine((value, ctx) => {
		if (value.mode !== 'preprovision') {
			return;
		}

		if (!value.firstName) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['firstName'],
				message: 'First name is required for pre-provisioning.'
			});
		}
		if (!value.lastName) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['lastName'],
				message: 'Last name is required for pre-provisioning.'
			});
		}
		if (!value.studentId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['studentId'],
				message: 'Student ID is required for pre-provisioning.'
			});
		}
		if (!value.sex) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['sex'],
				message: 'Sex is required for pre-provisioning.'
			});
		}
	});

export const updateMemberProfileSchema = z.object({
	action: z.literal('edit-profile'),
	email: emailSchema,
	firstName: nameSchema,
	lastName: nameSchema,
	studentId: studentIdSchema,
	sex: memberSexSchema.optional()
});

export const updateMemberRoleSchema = z.object({
	action: z.literal('set-role'),
	role: memberAssignableRoleSchema
});

export const updateMemberSchema = z.discriminatedUnion('action', [
	updateMemberProfileSchema,
	updateMemberRoleSchema
]);

export const inviteActionSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('revoke') }),
	z.object({ action: z.literal('regenerate') })
]);

export const acceptMemberInviteSchema = z
	.object({
		token: z.string().trim().min(1).max(512),
		password: z.string().min(8).max(128),
		confirmPassword: z.string().min(1).max(128),
		firstName: nameSchema,
		lastName: nameSchema
	})
	.refine((value) => value.password === value.confirmPassword, {
		message: 'Passwords do not match.',
		path: ['confirmPassword']
	});

export type MemberListQueryInput = z.infer<typeof memberListQuerySchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type AcceptMemberInviteInput = z.infer<typeof acceptMemberInviteSchema>;
