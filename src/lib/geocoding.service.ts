/**
 * Geocoding Service
 * 
 * Converts addresses to coordinates using Mapbox Geocoding API.
 * Used for both student and school address geocoding.
 */

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export interface GeocodingResult {
    latitude: number;
    longitude: number;
    placeName: string;
}

/**
 * Geocode an address string to lat/lng coordinates.
 * Prioritizes results in Brazil.
 * Returns null if the address cannot be geocoded.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
    if (!address || address.trim().length < 5) return null;
    if (!MAPBOX_TOKEN) {
        console.warn('[Geocoding] VITE_MAPBOX_TOKEN not set');
        return null;
    }

    try {
        const encoded = encodeURIComponent(address.trim());
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&country=br&language=pt&limit=1`;

        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        const feature = data.features?.[0];

        if (!feature) return null;

        const [longitude, latitude] = feature.center;
        return {
            latitude,
            longitude,
            placeName: feature.place_name || address,
        };
    } catch (error) {
        console.error('[Geocoding] Error:', error);
        return null;
    }
}

/**
 * Calculate distance in km between two coordinates using the Haversine formula.
 */
export function calcularDistanciaKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // 2 decimal places
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}
