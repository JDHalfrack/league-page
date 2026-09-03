import { json } from '@sveltejs/kit';
import { buildOwnerPowerRatings } from '$lib/server/powerRating';

export async function GET({ setHeaders }) {
  try {
    const data = await buildOwnerPowerRatings();
    setHeaders({ 'cache-control': 'public, s-maxage=21600, stale-while-revalidate=86400' });
    return json(data);
  } catch (err) {
    console.error('Owner Power Rating error:', err);
    return json({ error: true, message: err?.message || 'Owner Power Rating could not be generated.' }, { status: 500 });
  }
}
