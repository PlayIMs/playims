type BeforeUnloadListener = EventListenerOrEventListenerObject;

type TrackedBeforeUnloadListener = {
	listener: BeforeUnloadListener;
	capture: boolean;
};

export interface AuthSessionRedirectWindowLike {
	fetch: typeof fetch;
	location: {
		origin: string;
		pathname: string;
		search: string;
		hash: string;
		replace: (url: string) => void;
	};
	addEventListener: (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions
	) => void;
	removeEventListener: (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions
	) => void;
	onbeforeunload: ((event: BeforeUnloadEvent) => unknown) | null;
}

type AuthSessionRedirectState = {
	originalFetch: typeof fetch;
	originalAddEventListener: AuthSessionRedirectWindowLike['addEventListener'];
	originalRemoveEventListener: AuthSessionRedirectWindowLike['removeEventListener'];
	trackedBeforeUnloadListeners: TrackedBeforeUnloadListener[];
	redirectInProgress: boolean;
};

const AUTH_SESSION_REDIRECT_STATE_KEY = Symbol.for('playims.auth-session-redirect-state');

type AuthSessionRedirectWindow = AuthSessionRedirectWindowLike & {
	[AUTH_SESSION_REDIRECT_STATE_KEY]?: AuthSessionRedirectState;
};

const LOGIN_ROUTE = '/log-in';

const getCaptureFlag = (
	options?: boolean | AddEventListenerOptions | EventListenerOptions
): boolean => {
	if (typeof options === 'boolean') {
		return options;
	}

	return Boolean(options?.capture);
};

const isSameOriginUrl = (requestUrl: URL, origin: string): boolean => requestUrl.origin === origin;

const resolveRequestUrl = (
	input: RequestInfo | URL,
	windowOrigin: string
): URL | null => {
	try {
		if (input instanceof URL) {
			return input;
		}

		if (typeof input === 'string') {
			return new URL(input, windowOrigin);
		}

		if (typeof Request !== 'undefined' && input instanceof Request) {
			return new URL(input.url);
		}
	} catch {
		return null;
	}

	return null;
};

export const buildLoginRedirectHref = (currentLocation: {
	pathname: string;
	search: string;
	hash: string;
}): string => {
	const nextPath = `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`;
	return `${LOGIN_ROUTE}?next=${encodeURIComponent(nextPath)}`;
};

const clearTrackedBeforeUnloadHandlers = (windowObj: AuthSessionRedirectWindow, state: AuthSessionRedirectState) => {
	const trackedHandlers = state.trackedBeforeUnloadListeners.splice(0);
	windowObj.onbeforeunload = null;

	for (const { listener, capture } of trackedHandlers) {
		state.originalRemoveEventListener.call(windowObj, 'beforeunload', listener, capture);
	}
};

const createRedirectingFetch =
	(windowObj: AuthSessionRedirectWindow, state: AuthSessionRedirectState) =>
	async (input: RequestInfo | URL, init?: RequestInit) => {
		const requestUrl = resolveRequestUrl(input, windowObj.location.origin);
		const response = await state.originalFetch.call(windowObj, input, init);

		if (!state.redirectInProgress && requestUrl && isSameOriginUrl(requestUrl, windowObj.location.origin) && response.status === 401) {
			state.redirectInProgress = true;
			clearTrackedBeforeUnloadHandlers(windowObj, state);
			windowObj.location.replace(buildLoginRedirectHref(windowObj.location));
		}

		return response;
	};

const patchAddEventListener = (
	windowObj: AuthSessionRedirectWindow,
	state: AuthSessionRedirectState
) => {
	windowObj.addEventListener = ((type, listener, options) => {
		if (type === 'beforeunload') {
			state.trackedBeforeUnloadListeners.push({
				listener,
				capture: getCaptureFlag(options)
			});
		}

		return state.originalAddEventListener.call(windowObj, type, listener, options);
	}) as AuthSessionRedirectWindowLike['addEventListener'];
};

const patchRemoveEventListener = (
	windowObj: AuthSessionRedirectWindow,
	state: AuthSessionRedirectState
) => {
	windowObj.removeEventListener = ((type, listener, options) => {
		if (type === 'beforeunload') {
			const capture = getCaptureFlag(options);
			const matchIndex = state.trackedBeforeUnloadListeners.findIndex(
				(entry) => entry.listener === listener && entry.capture === capture
			);
			if (matchIndex !== -1) {
				state.trackedBeforeUnloadListeners.splice(matchIndex, 1);
			}
		}

		return state.originalRemoveEventListener.call(windowObj, type, listener, options);
	}) as AuthSessionRedirectWindowLike['removeEventListener'];
};

export const installAuthSessionRedirect = (
	windowObj: AuthSessionRedirectWindowLike = window as unknown as AuthSessionRedirectWindowLike
): (() => void) => {
	const existingState = (windowObj as AuthSessionRedirectWindow)[AUTH_SESSION_REDIRECT_STATE_KEY];
	if (existingState) {
		return () => {};
	}

	const state: AuthSessionRedirectState = {
		originalFetch: windowObj.fetch,
		originalAddEventListener: windowObj.addEventListener,
		originalRemoveEventListener: windowObj.removeEventListener,
		trackedBeforeUnloadListeners: [],
		redirectInProgress: false
	};

	const wrappedFetch = createRedirectingFetch(windowObj as AuthSessionRedirectWindow, state);
	windowObj.fetch = wrappedFetch as typeof fetch;
	patchAddEventListener(windowObj as AuthSessionRedirectWindow, state);
	patchRemoveEventListener(windowObj as AuthSessionRedirectWindow, state);
	(windowObj as AuthSessionRedirectWindow)[AUTH_SESSION_REDIRECT_STATE_KEY] = state;

	return () => {
		const currentState = (windowObj as AuthSessionRedirectWindow)[AUTH_SESSION_REDIRECT_STATE_KEY];
		if (!currentState) {
			return;
		}

		clearTrackedBeforeUnloadHandlers(windowObj as AuthSessionRedirectWindow, currentState);
		windowObj.fetch = currentState.originalFetch;
		windowObj.addEventListener = currentState.originalAddEventListener;
		windowObj.removeEventListener = currentState.originalRemoveEventListener;
		delete (windowObj as AuthSessionRedirectWindow)[AUTH_SESSION_REDIRECT_STATE_KEY];
	};
};
