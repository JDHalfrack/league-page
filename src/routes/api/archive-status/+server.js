import { json } from '@sveltejs/kit';
import { archiveStatus } from '$lib/server/archiveDb';

export async function GET({ setHeaders }) {
    try {
        const status = await archiveStatus();

        setHeaders({
            'cache-control': 'no-store'
        });

        return json(status);
    } catch (error) {
        console.error('Archive status error:', error);

        return json(
            {
                enabled: false,
                error: true,
                message:
                    error?.message ||
                    'Archive status could not be read.'
            },
            { status: 500 }
        );
    }
}
