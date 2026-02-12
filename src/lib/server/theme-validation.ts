import { z } from 'zod';

const normalizeHex = (hex: string) => hex.replace('#', '').toUpperCase();

const hexColorSchema = z
	.string()
	.trim()
	.regex(/^#?[0-9a-fA-F]{6}$/, 'Invalid hex color')
	.transform((value) => normalizeHex(value));

export const themeIdParamSchema = z.object({
	themeId: z.string().uuid()
});

export const themeColorsSchema = z.object({
	primary: hexColorSchema,
	secondary: hexColorSchema,
	accent: hexColorSchema,
	neutral: hexColorSchema.optional().default('')
});

export const createSavedThemeSchema = z.object({
	name: z.string().trim().min(1).max(100),
	colors: themeColorsSchema
});

export const updateSavedThemeSchema = z.object({
	name: z.string().trim().min(1).max(100),
	colors: themeColorsSchema
});

export const updateCurrentThemeSchema = z.object({
	colors: themeColorsSchema
});
