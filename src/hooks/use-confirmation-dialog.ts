import { useI18n } from '@wordpress/react-i18n';
import { getIpcApi } from '../lib/get-ipc-api';

interface ConfirmationDialogOptions {
	message: string;
	detail?: string;
	checkboxLabel?: string;
	confirmButtonLabel: string;
	cancelButtonLabel?: string;
	localStorageKey: string;
}

export function useConfirmationDialog( options: ConfirmationDialogOptions ) {
	const { __ } = useI18n();
	const {
		message,
		detail,
		checkboxLabel = __( "Don't ask again" ),
		confirmButtonLabel,
		cancelButtonLabel = __( 'Cancel' ),
		localStorageKey,
	} = options;

	return async ( onConfirm: () => void, { detail: detailOverride }: { detail?: string } = {} ) => {
		if ( localStorage.getItem( localStorageKey ) === 'true' ) {
			onConfirm();
			return;
		}

		const CONFIRM_BUTTON_INDEX = 0;
		const CANCEL_BUTTON_INDEX = 1;
		const { response, checkboxChecked } = await getIpcApi().showMessageBox( {
			message,
			detail: detailOverride ?? detail,
			checkboxLabel,
			buttons: [ confirmButtonLabel, cancelButtonLabel ],
			cancelId: CANCEL_BUTTON_INDEX,
		} );

		if ( response === CONFIRM_BUTTON_INDEX ) {
			// Confirm button is always the first button
			if ( checkboxChecked ) {
				localStorage.setItem( localStorageKey, 'true' );
			}
			onConfirm();
		}
	};
}
