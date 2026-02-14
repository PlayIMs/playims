import { z } from 'zod';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : value);
const normalizeSlug = (value: unknown) => {
	if (typeof value !== 'string') return value;
	return value
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
};

const requiredText = (label: string, max = 160) =>
	z.preprocess(
		normalizeText,
		z
			.string()
			.min(1, `${label} is required.`)
			.max(max, `${label} must be ${max} characters or fewer.`)
	);

const optionalText = (label: string, max = 2000) =>
	z.preprocess(
		(value) => {
			if (typeof value !== 'string') return value;
			const trimmed = value.trim();
			return trimmed.length === 0 ? null : trimmed;
		},
		z.union([z.string().max(max, `${label} must be ${max} characters or fewer.`), z.null()])
	);

const slugField = (label: string) =>
	z.preprocess(
		normalizeSlug,
		z
			.string()
			.min(1, `${label} is required.`)
			.max(120, `${label} must be 120 characters or fewer.`)
			.regex(SLUG_REGEX, `${label} must use lowercase letters, numbers, and dashes only.`)
	);

const optionalCapacity = z.union([
	z
		.number()
		.int('Capacity must be a whole number.')
		.min(1, 'Capacity must be at least 1.')
		.max(1_000_000, 'Capacity must be 1000000 or less.'),
	z.null()
]);

const facilityInputSchema = z.object({
	name: requiredText('Facility name', 140),
	slug: slugField('Facility slug'),
	description: optionalText('Facility description', 2000),
	addressLine1: optionalText('Address line 1', 180),
	addressLine2: optionalText('Address line 2', 180),
	city: optionalText('City', 120),
	state: optionalText('State', 120),
	postalCode: optionalText('Postal code', 32),
	country: optionalText('Country', 120),
	timezone: optionalText('Timezone', 120),
	isActive: z.boolean(),
	capacity: optionalCapacity
});

const facilityAreaInputSchema = z.object({
	name: requiredText('Area name', 140),
	slug: slugField('Area slug'),
	description: optionalText('Area description', 2000),
	isActive: z.boolean(),
	capacity: optionalCapacity
});

export const createFacilityWithAreasSchema = z
	.object({
		facility: facilityInputSchema,
		areas: z.array(facilityAreaInputSchema)
	})
	.superRefine((payload, ctx) => {
		const seenAreaNames = new Map<string, number>();
		const seenAreaSlugs = new Map<string, number>();

		payload.areas.forEach((area, index) => {
			const normalizedName = area.name.trim().toLowerCase();
			const previousNameIndex = seenAreaNames.get(normalizedName);
			if (previousNameIndex !== undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['areas', index, 'name'],
					message: 'Area name must be unique within this request.'
				});
			} else {
				seenAreaNames.set(normalizedName, index);
			}

			const previousSlugIndex = seenAreaSlugs.get(area.slug);
			if (previousSlugIndex !== undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['areas', index, 'slug'],
					message: 'Area slug must be unique within this request.'
				});
			} else {
				seenAreaSlugs.set(area.slug, index);
			}
		});
	});

export type CreateFacilityWithAreasInput = z.infer<typeof createFacilityWithAreasSchema>;
