import { dev } from '$app/environment';

if ('serviceWorker' in navigator) {
	if (dev) {
		navigator.serviceWorker.getRegistrations().then((regs) => {
			regs.forEach((reg) => reg.unregister());
		});
	} else {
		navigator.serviceWorker.register('/service-worker.js', { type: 'module' });
	}
}
