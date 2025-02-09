import { Icon } from '@wordpress/components';
import { sprintf } from '@wordpress/i18n';
import { cloudUpload, cloudDownload } from '@wordpress/icons';
import { useI18n } from '@wordpress/react-i18n';
import { useMemo } from 'react';
import { useSyncSites } from '../hooks/sync-sites';
import { useConfirmationDialog } from '../hooks/use-confirmation-dialog';
import { SyncSite } from '../hooks/use-fetch-wpcom-sites';
import { useSyncStatesProgressInfo } from '../hooks/use-sync-states-progress-info';
import { getIpcApi } from '../lib/get-ipc-api';
import { ArrowIcon } from './arrow-icon';
import { Badge } from './badge';
import Button from './button';
import ProgressBar from './progress-bar';
import { SyncPullPushClear } from './sync-pull-push-clear';
import Tooltip from './tooltip';
import { WordPressLogoCircle } from './wordpress-logo-circle';

interface ConnectedSiteSection {
	id: number;
	name: string;
	provider: 'wpcom';
	connectedSites: SyncSite[];
}

export function SyncConnectedSites( {
	connectedSites,
	openSitesSyncSelector,
	disconnectSite,
	selectedSite,
}: {
	connectedSites: SyncSite[];
	openSitesSyncSelector: () => void;
	disconnectSite: ( id: number ) => void;
	selectedSite: SiteDetails;
} ) {
	const { __ } = useI18n();
	const {
		pullSite,
		clearPullState,
		getPullState,
		isAnySitePulling,
		isAnySitePushing,
		pushSite,
		getPushState,
		clearPushState,
	} = useSyncSites();
	const { isKeyPulling, isKeyFinished, isKeyFailed } = useSyncStatesProgressInfo();
	const showPushStagingConfirmation = useConfirmationDialog( {
		localStorageKey: 'dontShowPushConfirmation',
		message: __( 'Overwrite Staging site' ),
		detail: __(
			'Pushing will replace the existing files and database with a copy from your local site.\n\n The staging site will be backed-up before any changes are applied.'
		),
		confirmButtonLabel: __( 'Push' ),
	} );
	const showPushProductionConfirmation = useConfirmationDialog( {
		localStorageKey: 'dontShowPushConfirmation',
		message: __( 'Overwrite Production site' ),
		detail: __(
			'Pushing will replace the existing files and database with a copy from your local site.\n\n The production site will be backed-up before any changes are applied.'
		),
		confirmButtonLabel: __( 'Push' ),
	} );
	const siteSections: ConnectedSiteSection[] = useMemo( () => {
		const siteSections: ConnectedSiteSection[] = [];
		const processedSites = new Set< number >();

		connectedSites.forEach( ( connectedSite ) => {
			if ( processedSites.has( connectedSite.id ) ) {
				return; // Skip if we've already processed this site
			}

			const section: ConnectedSiteSection = {
				id: connectedSite.id,
				name: connectedSite.name,
				provider: 'wpcom',
				connectedSites: [ connectedSite ],
			};

			processedSites.add( connectedSite.id );

			if ( connectedSite.stagingSiteIds ) {
				for ( const id of connectedSite.stagingSiteIds ) {
					const stagingSite = connectedSites.find( ( site ) => site.id === id );
					if ( stagingSite ) {
						section.connectedSites.push( stagingSite );
						processedSites.add( stagingSite.id );
					}
				}
			}

			siteSections.push( section );
		} );

		return siteSections;
	}, [ connectedSites ] );

	const showPullConfirmation = useConfirmationDialog( {
		localStorageKey: 'dontShowPullConfirmation',
		message: __( 'Overwrite Studio site' ),
		confirmButtonLabel: __( 'Pull' ),
	} );

	const handleDisconnectSite = async ( sectionId: number, sectionName?: string ) => {
		const dontShowDisconnectWarning = localStorage.getItem( 'dontShowDisconnectWarning' );
		if ( ! dontShowDisconnectWarning ) {
			const CANCEL_BUTTON_INDEX = 1;
			const DISCONNECT_BUTTON_INDEX = 0;

			const disconnectMessage = sectionName
				? sprintf( __( 'Disconnect %s' ), sectionName )
				: __( 'Disconnect site' );

			const { response, checkboxChecked } = await getIpcApi().showMessageBox( {
				message: disconnectMessage,
				detail: __(
					'Your WordPress.com site will not be affected by disconnecting it from Studio.'
				),
				buttons: [ __( 'Disconnect' ), __( 'Cancel' ) ],
				cancelId: CANCEL_BUTTON_INDEX,
				checkboxLabel: __( "Don't ask again" ),
			} );

			if ( response === DISCONNECT_BUTTON_INDEX ) {
				if ( checkboxChecked ) {
					localStorage.setItem( 'dontShowDisconnectWarning', 'true' );
				}
				disconnectSite( sectionId );
				siteSections
					.find( ( section ) => section.id === sectionId )
					?.connectedSites.forEach( ( connectedSite ) => {
						clearPullState( selectedSite.id, connectedSite.id );
					} );
			}
		} else {
			disconnectSite( sectionId );
		}
	};

	const handlePushSite = async ( connectedSite: SyncSite ) => {
		if ( connectedSite.isStaging ) {
			showPushStagingConfirmation( () => pushSite( connectedSite, selectedSite ) );
		} else {
			showPushProductionConfirmation( () => pushSite( connectedSite, selectedSite ) );
		}
	};

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex flex-col flex-1 pt-8 overflow-y-auto">
				{ siteSections.map( ( section ) => (
					<div key={ section.id } className="flex flex-col gap-2 mb-6">
						<div className="flex items-center gap-2 py-2.5 border-b border-a8c-gray-0 px-8">
							<WordPressLogoCircle />
							<div className="a8c-label-semibold">{ section.name }</div>
							<Button
								variant="link"
								className="!ml-auto !text-a8c-gray-70 hover:!text-a8c-red-50 "
								onClick={ () => handleDisconnectSite( section.id, section.name ) }
								disabled={ isAnySitePulling || isAnySitePushing }
							>
								{ __( 'Disconnect' ) }
							</Button>
						</div>
						{ section.connectedSites.map( ( connectedSite ) => {
							const sitePullState = getPullState( selectedSite.id, connectedSite.id );
							const isPulling = sitePullState && isKeyPulling( sitePullState.status.key );
							const isError = sitePullState && isKeyFailed( sitePullState.status.key );
							const hasPullFinished = sitePullState && isKeyFinished( sitePullState.status.key );

							const pushState = getPushState( selectedSite.id, connectedSite.id );
							return (
								<div
									key={ connectedSite.id }
									className="flex items-center gap-2 min-h-14 border-b border-a8c-gray-0 px-8"
								>
									<div className="flex items-left min-w-20 mr-6 shrink-0">
										{ connectedSite.isStaging ? (
											<Badge>{ __( 'Staging' ) }</Badge>
										) : (
											<Badge className="bg-a8c-green-5 text-a8c-green-80">
												{ __( 'Production' ) }
											</Badge>
										) }
									</div>

									<Tooltip text={ connectedSite.url } className="overflow-hidden">
										<Button
											variant="link"
											className="!text-a8c-gray-70 hover:!text-a8c-blueberry max-w-[100%]"
											onClick={ () => {
												getIpcApi().openURL( connectedSite.url );
											} }
										>
											<span className="truncate">{ connectedSite.url }</span> <ArrowIcon />
										</Button>
									</Tooltip>
									<div className="flex gap-2 pl-4 ml-auto shrink-0">
										{ isPulling && (
											<div className="flex flex-col gap-2 min-w-44">
												<div className="a8c-body-small">{ sitePullState.status.message }</div>
												<ProgressBar value={ sitePullState.status.progress } maxValue={ 100 } />
											</div>
										) }
										{ isError && (
											<SyncPullPushClear
												onClick={ () => clearPullState( selectedSite.id, connectedSite.id ) }
												isError
											>
												{ __( 'Error pulling changes' ) }
											</SyncPullPushClear>
										) }
										{ hasPullFinished && (
											<SyncPullPushClear
												onClick={ () => clearPullState( selectedSite.id, connectedSite.id ) }
											>
												{ __( 'Pull complete' ) }
											</SyncPullPushClear>
										) }
										{ pushState.status && pushState.isInProgress && (
											<div className="flex flex-col gap-2 min-w-44">
												<div className="a8c-body-small">{ pushState.status.message }</div>
												<ProgressBar value={ pushState.status.progress } maxValue={ 100 } />
											</div>
										) }

										{ pushState.status && pushState.hasFinished && (
											<SyncPullPushClear
												onClick={ () => clearPushState( selectedSite.id, connectedSite.id ) }
											>
												{ pushState.status.message }
											</SyncPullPushClear>
										) }
										{ ! isPulling &&
											! hasPullFinished &&
											! isError &&
											! pushState.isInProgress &&
											! pushState.isError &&
											! pushState.hasFinished && (
												<div className="flex gap-2 pl-4 ml-auto shrink-0 h-5">
													<Button
														variant="link"
														className="!text-black hover:!text-a8c-blueberry"
														onClick={ () => {
															const detail = connectedSite.isStaging
																? __(
																		"Pulling will replace your Studio site's files and database with a copy from your staging site."
																  )
																: __(
																		"Pulling will replace your Studio site's files and database with a copy from your production site."
																  );
															showPullConfirmation( () => pullSite( connectedSite, selectedSite ), {
																detail,
															} );
														} }
														disabled={ isAnySitePulling || isAnySitePushing }
													>
														<Icon icon={ cloudDownload } />
														{ __( 'Pull' ) }
													</Button>
													<Button
														variant="link"
														className="!text-black hover:!text-a8c-blueberry"
														onClick={ () => handlePushSite( connectedSite ) }
														disabled={ isAnySitePulling || isAnySitePushing }
													>
														<Icon icon={ cloudUpload } />
														{ __( 'Push' ) }
													</Button>
												</div>
											) }
									</div>
								</div>
							);
						} ) }
					</div>
				) ) }
			</div>

			<div className="flex mt-auto gap-4 py-5 px-8 border-t border-a8c-gray-5 flex-shrink-0">
				<Button
					onClick={ openSitesSyncSelector }
					variant="secondary"
					className="!text-a8c-blueberry !shadow-a8c-blueberry"
				>
					{ __( 'Connect site' ) }
				</Button>
				<Button
					onClick={ () => {
						getIpcApi().openURL( 'https://wordpress.com/start/new-site' );
					} }
					variant="secondary"
					className="!text-a8c-blueberry !shadow-a8c-blueberry"
				>
					{ __( 'Create new site' ) }
					<ArrowIcon />
				</Button>
			</div>
		</div>
	);
}
