// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

interface StoppedSiteDetails {
	running: false;

	id: string;
	name: string;
	path: string;
	port?: number;
}

interface StartedSiteDetails extends StoppedSiteDetails {
	running: true;

	port: number;
	url: string;
}

type SiteDetails = StartedSiteDetails | StoppedSiteDetails;

interface Snapshot {
	url: string;
	atomicSiteId: number;
	localSiteId: string;
	date: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tail< T extends any[] > = ( ( ...args: T ) => any ) extends ( _: any, ...tail: infer U ) => any
	? U
	: never;

// IpcApi functions have the same signatures as the functions in ipc-handlers.ts, except
// with the first parameter removed.
type IpcApi = {
	[ K in keyof typeof import('./ipc-handlers') ]: (
		...args: Tail< Parameters< ( typeof import('./ipc-handlers') )[ K ] > >
	) => ReturnType< ( typeof import('./ipc-handlers') )[ K ] >;
};

interface AppGlobals {
	platform: NodeJS.Platform;
}
