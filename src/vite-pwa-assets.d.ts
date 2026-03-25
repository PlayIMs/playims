// TypeScript 6 checks side-effect imports more strictly, so this keeps the PWA head injector resolvable.
declare module 'virtual:pwa-assets/head' {
	export {};
}
