export type NumericWizardStep = number;

export interface WizardStepDefinition {
	id: NumericWizardStep;
	title: string;
}

export interface WizardProgressState {
	step: NumericWizardStep;
	stepCount: number;
	stepTitle: string;
	progressPercent: number;
}
