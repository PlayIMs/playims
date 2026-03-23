export type CreateDivisionWizardStep = 1 | 2 | 3;

export interface CreateDivisionWizardFlowState {
	step: CreateDivisionWizardStep;
	draftActive: boolean;
}

export function getCreateDivisionWizardInitialFlowState(): CreateDivisionWizardFlowState {
	return {
		step: 1,
		draftActive: true
	};
}

export function getCreateDivisionWizardPostAddFlowState(): CreateDivisionWizardFlowState {
	return {
		step: 2,
		draftActive: false
	};
}

export function getCreateDivisionWizardStepTitle(step: CreateDivisionWizardStep): string {
	if (step === 1) return 'Division Details';
	if (step === 2) return 'Divisions';
	return 'Review & Create';
}

export function getCreateDivisionWizardNextLabel(
	step: CreateDivisionWizardStep,
	draftActive: boolean,
	editingIndex: number | null
): string {
	if (step === 1 && draftActive) {
		return editingIndex === null ? 'Add Division' : 'Update Division';
	}
	if (step === 2) {
		return 'Review';
	}
	return 'Next';
}
