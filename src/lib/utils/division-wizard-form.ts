import { slugifyFinal } from '$lib/components/wizard/slug-utils.js';

export interface DivisionWizardFormLike {
	name: string;
	slug: string;
	maxTeams: string | number;
	description: string;
	dayOfWeek: string;
	gameTime: string;
	location: string;
	startDate: string;
	isLocked: boolean;
	doAutoLock: boolean;
}

export interface NormalizedDivisionWizardForm {
	name: string;
	slug: string;
	maxTeams: string;
	description: string;
	dayOfWeek: string;
	gameTime: string;
	location: string;
	startDate: string;
	isLocked: boolean;
	doAutoLock: boolean;
}

export interface DivisionWizardDraftLike extends NormalizedDivisionWizardForm {
	draftId: string;
}

function normalizeTextValue(value: string | null | undefined): string {
	return value?.trim() ?? '';
}

export function normalizeDivisionMaxTeamsValue(
	value: string | number | null | undefined
): string {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? String(value) : '';
	}
	return normalizeTextValue(value);
}

export function cloneDivisionWizardForm(
	values: DivisionWizardFormLike
): NormalizedDivisionWizardForm {
	return {
		name: values.name,
		slug: values.slug,
		maxTeams: normalizeDivisionMaxTeamsValue(values.maxTeams),
		description: values.description,
		dayOfWeek: values.dayOfWeek,
		gameTime: values.gameTime,
		location: values.location,
		startDate: values.startDate,
		isLocked: values.isLocked,
		doAutoLock: values.doAutoLock
	};
}

export function normalizeCreateDivisionDraft(
	values: DivisionWizardFormLike,
	draftId: string
): DivisionWizardDraftLike {
	return {
		draftId,
		name: normalizeTextValue(values.name),
		slug: slugifyFinal(values.slug),
		maxTeams: normalizeDivisionMaxTeamsValue(values.maxTeams),
		description: normalizeTextValue(values.description),
		dayOfWeek: normalizeTextValue(values.dayOfWeek),
		gameTime: normalizeTextValue(values.gameTime),
		location: normalizeTextValue(values.location),
		startDate: normalizeTextValue(values.startDate),
		isLocked: values.isLocked,
		doAutoLock: values.doAutoLock
	};
}
