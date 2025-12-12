
import { Coordinates } from "../types";

// OSRM Public API endpoint
const OSRM_API_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetches the road path between start and end coordinates, optionally passing through waypoints.
 * Returns an array of [lat, lng] arrays suitable for Leaflet.
 */
export const getRoadPath = async (start: Coordinates, end: Coordinates, waypoints?: Coordinates[]): Promise<[number, number][] | null> => {
  try {
    // Format coordinates as "lng,lat"
    const startStr = `${start.lng},${start.lat}`;
    const endStr = `${end.lng},${end.lat}`;
    
    let urlCoords = `${startStr}`;

    // Add waypoints to the URL string
    if (waypoints && waypoints.length > 0) {
        const wpStr = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
        urlCoords += `;${wpStr}`;
    }

    urlCoords += `;${endStr}`;
    
    // Request full geometry in GeoJSON format
    const url = `${OSRM_API_URL}/${urlCoords}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates;
      // Map from [lng, lat] (GeoJSON) to [lat, lng] (Leaflet)
      return coordinates.map((coord: number[]) => [coord[1], coord[0]]);
    }
    
    return null;
  } catch (error) {
    console.warn("Error fetching road path:", error);
    return null; // Fallback to straight line handled by consumer
  }
};
