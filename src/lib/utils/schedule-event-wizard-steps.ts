import type { ScheduleEventWizardOptions, ScheduleEventWizardSelection } from './schedule-event-wizard';
import { sanitizeScheduleEventWizardSelection } from './schedule-event-wizard';

export type ScheduleEventWizardStep = 1 | 2 | 3 | 4;

export type ScheduleEventWizardForm = ScheduleEventWizardSelection & {
	scheduledStartAt: string;
	scheduledEndAt: string;
	weekNumber: string;
	roundLabel: string;
	notes: string;
	isPostseason: boolean;
};

const STEP_TITLES: Record<ScheduleEventWizardStep, string> = {
	1: 'Competition',
	2: 'Schedule',
	3: 'Matchup',
	4: 'Details'
};

const DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function parseDateTimeValue(value: string): number | null {
	if (!DATE_TIME_REGEX.test(value)) {
		return null;
	}

	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? null : parsed;
}

function addError(errors: Record<string, string>, key: string, message: string): void {
	if (!errors[key]) {
		errors[key] = message;
	}
}

function shouldValidateStep(step: ScheduleEventWizardStep, targetStep?: ScheduleEventWizardStep): boolean {
	return targetStep === undefined || targetStep === step;
}

export function getScheduleEventWizardStepTitle(step: ScheduleEventWizardStep): string {
	return STEP_TITLES[step];
}

export function getScheduleEventWizardStepCount(): number {
	return 4;
}

export function buildScheduleEventWizardStepErrors(
	options: ScheduleEventWizardOptions,
	form: ScheduleEventWizardForm,
	step: ScheduleEventWizardStep
): Record<string, string> {
	const errors: Record<string, string> = {};
	const selection = sanitizeScheduleEventWizardSelection(options, form);

	if (shouldValidateStep(1, step)) {
		if (!selection.seasonId) {
			addError(errors, 'event.seasonId', 'Choose a valid season.');
		}
		if (!selection.offeringId) {
			addError(errors, 'event.offeringId', 'Choose a valid offering.');
		}
		if (!selection.leagueId) {
			addError(errors, 'event.leagueId', 'Choose a valid league.');
		}
		if (!selection.divisionId) {
			addError(errors, 'event.divisionId', 'Choose a valid division.');
		}
	}

	if (shouldValidateStep(2, step)) {
		const startValue = form.scheduledStartAt.trim();
		const endValue = form.scheduledEndAt.trim();
		const startMs = parseDateTimeValue(startValue);
		const endMs = parseDateTimeValue(endValue);

		if (!startValue) {
			addError(errors, 'event.scheduledStartAt', 'Scheduled start time is required.');
		} else if (startMs === null) {
			addError(errors, 'event.scheduledStartAt', 'Scheduled start time is invalid.');
		}

		if (!endValue) {
			addError(errors, 'event.scheduledEndAt', 'Scheduled end time is required.');
		} else if (endMs === null) {
			addError(errors, 'event.scheduledEndAt', 'Scheduled end time is invalid.');
		}

		if (startMs !== null && endMs !== null && endMs <= startMs) {
			addError(
				errors,
				'event.scheduledEndAt',
				'Scheduled end time must be after the scheduled start time.'
			);
		}

		if (selection.facilityAreaId && !selection.facilityId) {
			addError(errors, 'event.facilityAreaId', 'Choose a facility before selecting a facility area.');
		}
	}

	if (shouldValidateStep(3, step)) {
		const homeTeamId = form.homeTeamId.trim();
		const awayTeamId = form.awayTeamId.trim();

		if (!homeTeamId) {
			addError(
				errors,
				'event.homeTeamId',
				'Choose a home team that belongs to the selected division.'
			);
		} else if (!selection.homeTeamId) {
			addError(
				errors,
				'event.homeTeamId',
				'Choose a home team that belongs to the selected division.'
			);
		}
		if (!awayTeamId) {
			addError(
				errors,
				'event.awayTeamId',
				'Choose an away team that belongs to the selected division.'
			);
		} else if (homeTeamId && awayTeamId === homeTeamId) {
			addError(errors, 'event.awayTeamId', 'Home and away teams must be different.');
		} else if (!selection.awayTeamId) {
			addError(
				errors,
				'event.awayTeamId',
				'Choose an away team that belongs to the selected division.'
			);
		}
	}

	return errors;
}

export function buildScheduleEventWizardBlockingFieldErrors(
	options: ScheduleEventWizardOptions,
	form: ScheduleEventWizardForm
): Record<string, string> {
	return {
		...buildScheduleEventWizardStepErrors(options, form, 1),
		...buildScheduleEventWizardStepErrors(options, form, 2),
		...buildScheduleEventWizardStepErrors(options, form, 3)
	};
}
