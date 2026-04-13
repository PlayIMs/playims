interface CommunicationEditorRuntimeState<T> {
	editor: T | null;
	toolbarRevision: number;
}

interface CommunicationEditorRuntimeUpdateOptions {
	bumpRevision?: boolean;
}

export const updateCommunicationEditorRuntimeState = <T>(
	currentState: CommunicationEditorRuntimeState<T>,
	nextEditor: T | null,
	options: CommunicationEditorRuntimeUpdateOptions = {}
): CommunicationEditorRuntimeState<T> => ({
	editor: currentState.editor === nextEditor ? currentState.editor : nextEditor,
	toolbarRevision: options.bumpRevision === false
		? currentState.toolbarRevision
		: currentState.toolbarRevision + 1
});
