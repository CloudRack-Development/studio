import * as Sentry from '@sentry/electron/renderer';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from './use-auth';
import { useOffline } from './use-offline';

type SyncSupport = 'unsupported' | 'syncable' | 'needs-transfer' | 'already-connected';

export type SyncSite = {
	id: number;
	localSiteId: string;
	name: string;
	url: string;
	isStaging: boolean;
	stagingSiteIds: number[];
	syncSupport: SyncSupport;
};

type SitesEndpointSite = {
	ID: number;
	is_wpcom_atomic: boolean;
	is_wpcom_staging_site: boolean;
	name: string;
	URL: string;
	options?: {
		created_at: string;
		wpcom_staging_blog_ids: number[];
	};
	plan?: {
		expired: boolean;
		features: {
			active: string[];
			available: Record< string, string[] >;
		};
		is_free: boolean;
		product_id: number;
		product_name_short: string;
		product_slug: string;
		user_is_owner: boolean;
	};
};

type SitesEndpointResponse = {
	sites: SitesEndpointSite[];
};

const STUDIO_SYNC_FEATURE_NAME = 'studio-sync';

function getSyncSupport( site: SitesEndpointSite, connectedSiteIds: number[] ): SyncSupport {
	if ( connectedSiteIds.some( ( id ) => id === site.ID ) ) {
		return 'already-connected';
	}
	if ( ! site.plan || ! site.plan.features.active.includes( STUDIO_SYNC_FEATURE_NAME ) ) {
		return 'unsupported';
	}
	if ( ! site.is_wpcom_atomic ) {
		return 'needs-transfer';
	}
	return 'syncable';
}

function transformSiteResponse(
	sites: SitesEndpointSite[],
	connectedSiteIds: number[]
): SyncSite[] {
	return sites.map( ( site ) => {
		return {
			id: site.ID,
			localSiteId: '',
			name: site.name,
			url: site.URL,
			isStaging: site.is_wpcom_staging_site,
			stagingSiteIds: site.options?.wpcom_staging_blog_ids ?? [],
			syncSupport: getSyncSupport( site, connectedSiteIds ),
		};
	} );
}

export const useFetchWpComSites = ( connectedSiteIds: number[] ) => {
	const [ syncSites, setSyncSites ] = useState< SyncSite[] >( [] );
	const { isAuthenticated, client } = useAuth();
	const isFetchingSites = useRef( false );
	const isOffline = useOffline();

	const joinedConnectedSiteIds = connectedSiteIds.join( ',' );
	// we need this trick to avoid unnecessary re-renders,
	// as a result different instances of the same array don't trigger refetching
	const memoizedConnectedSiteIds: number[] = useMemo(
		() => joinedConnectedSiteIds.split( ',' ).map( ( id ) => parseInt( id, 10 ) ),
		[ joinedConnectedSiteIds ]
	);

	const fetchSites = useCallback( () => {
		if ( ! client?.req || isFetchingSites.current || ! isAuthenticated || isOffline ) {
			return;
		}

		isFetchingSites.current = true;

		client.req
			.get< SitesEndpointResponse >(
				{
					apiNamespace: 'rest/v1.2',
					path: `/me/sites`,
				},
				{
					fields: 'name,ID,URL,plan,is_wpcom_staging_site,is_wpcom_atomic,options',
					filter: 'atomic,wpcom',
					options: 'created_at,wpcom_staging_blog_ids',
					site_visibility: 'visible',
				}
			)
			.then( ( response ) => {
				setSyncSites( transformSiteResponse( response.sites, memoizedConnectedSiteIds ) );
			} )
			.catch( ( error ) => {
				Sentry.captureException( error );
				console.error( error );
			} )
			.finally( () => {
				isFetchingSites.current = false;
			} );
	}, [ client?.req, memoizedConnectedSiteIds, isAuthenticated, isOffline ] );

	useEffect( () => {
		fetchSites();
	}, [ fetchSites ] );

	const refetchSites = useCallback( () => {
		fetchSites();
	}, [ fetchSites ] );

	// Map syncSites to reflect whether they are already connected
	const syncSitesWithConnectionStatus = useMemo(
		() =>
			syncSites.map( ( site ) => ( {
				...site,
				syncSupport: memoizedConnectedSiteIds.some(
					( connectedSiteId ) => connectedSiteId === site.id
				)
					? 'already-connected'
					: site.syncSupport,
			} ) ),
		[ syncSites, memoizedConnectedSiteIds ]
	);

	return {
		syncSites: syncSitesWithConnectionStatus,
		isFetching: isFetchingSites.current,
		refetchSites,
	};
};
