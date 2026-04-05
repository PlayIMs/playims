import type {
	CommunicationRecipientGroupDraft,
	CommunicationRecipientGroupFilter,
	CommunicationRecipientGroupMode
} from '$lib/communications/types.js';

export interface RecipientBuilderFormPreviewState {
	id: string | null;
	mode: CommunicationRecipientGroupMode;
	filters: CommunicationRecipientGroupFilter;
}

export interface RecipientBuilderPreviewRequestGroup {
	id: string;
	mode: CommunicationRecipientGroupMode;
	filters: CommunicationRecipientGroupFilter;
}

export interface RecipientBuilderAdditionalFilterOption {
	value: string;
	label: string;
}

export interface RecipientBuilderAdditionalFilterDefinition {
	key: string;
	label: string;
	disabled: boolean;
	options: RecipientBuilderAdditionalFilterOption[];
}

const DEFAULT_DISABLED_OPTIONS: RecipientBuilderAdditionalFilterOption[] = [{ value: '', label: 'All' }];

export const RECIPIENT_BUILDER_ADDITIONAL_FILTERS: RecipientBuilderAdditionalFilterDefinition[] = [
	{ key: 'userStatus', label: 'User Status', disabled: true, options: DEFAULT_DISABLED_OPTIONS },
	{
		key: 'classification',
		label: 'Classification',
		disabled: true,
		options: DEFAULT_DISABLED_OPTIONS
	},
	{
		key: 'suspendedStatus',
		label: 'Suspended Status',
		disabled: true,
		options: DEFAULT_DISABLED_OPTIONS
	},
	{ key: 'teamApproval', label: 'Team Approval', disabled: true, options: DEFAULT_DISABLED_OPTIONS },
	{ key: 'teamPayment', label: 'Team Payment', disabled: true, options: DEFAULT_DISABLED_OPTIONS },
	{
		key: 'playerPayment',
		label: 'Player Payment',
		disabled: true,
		options: DEFAULT_DISABLED_OPTIONS
	},
	{
		key: 'teamPlayerRequirement',
		label: 'Team Player Req',
		disabled: true,
		options: DEFAULT_DISABLED_OPTIONS
	},
	{
		key: 'teamInPlayoffs',
		label: 'Team in Playoffs',
		disabled: true,
		options: DEFAULT_DISABLED_OPTIONS
	},
	{
		key: 'gameDateTime',
		label: 'Game Date/Time',
		disabled: true,
		options: DEFAULT_DISABLED_OPTIONS
	},
	{
		key: 'playerEligibility',
		label: 'Player Eligibility',
		disabled: true,
		options: DEFAULT_DISABLED_OPTIONS
	},
	{
		key: 'ssoPlayerEligibility',
		label: 'SSO Player Eligibility',
		disabled: true,
		options: DEFAULT_DISABLED_OPTIONS
	},
	{ key: 'forms', label: 'Forms', disabled: true, options: DEFAULT_DISABLED_OPTIONS },
	{ key: 'quizzes', label: 'Quizzes', disabled: true, options: DEFAULT_DISABLED_OPTIONS },
	{
		key: 'invitations',
		label: 'Invitations',
		disabled: true,
		options: DEFAULT_DISABLED_OPTIONS
	}
];

export function hasMeaningfulRecipientGroupFilters(
	filters: CommunicationRecipientGroupFilter
): boolean {
	return Object.values(filters).some((value) => value.trim().length > 0);
}

export function buildRecipientBuilderPreviewRequestGroups(input: {
	draftRecipientGroups: CommunicationRecipientGroupDraft[];
	recipientGroupForm: RecipientBuilderFormPreviewState;
}): RecipientBuilderPreviewRequestGroup[] {
	const persistedGroups = input.draftRecipientGroups.map((recipientGroup) => ({
		id: recipientGroup.id,
		mode: recipientGroup.mode,
		filters: { ...recipientGroup.filters }
	}));

	if (input.recipientGroupForm.id) {
		return persistedGroups.map((recipientGroup) =>
			recipientGroup.id === input.recipientGroupForm.id
				? {
						id: input.recipientGroupForm.id ?? recipientGroup.id,
						mode: input.recipientGroupForm.mode,
						filters: { ...input.recipientGroupForm.filters }
					}
				: recipientGroup
		);
	}

	if (!hasMeaningfulRecipientGroupFilters(input.recipientGroupForm.filters)) {
		return persistedGroups;
	}

	return [
		...persistedGroups,
		{
			id: '__recipient-preview-draft__',
			mode: input.recipientGroupForm.mode,
			filters: { ...input.recipientGroupForm.filters }
		}
	];
}

export function buildRecipientBuilderPreviewSignature(
	groups: RecipientBuilderPreviewRequestGroup[]
): string {
	return JSON.stringify(groups);
}
