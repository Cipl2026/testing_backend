export interface TravelEstimateInput {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
}

export interface TravelEstimate {
  distanceKm: number;
  durationMinutes: number;
}

export interface TravelEstimateProvider {
  estimateTravel(input: TravelEstimateInput): Promise<TravelEstimate>;
  estimateETA(input: TravelEstimateInput & { departAt?: Date }): Promise<TravelEstimate>;
}

/** Haversine-based fallback — decoupled from external routing APIs. */
export class HaversineTravelEstimateProvider implements TravelEstimateProvider {
  async estimateTravel(input: TravelEstimateInput): Promise<TravelEstimate> {
    const distanceKm = haversineKm(input.fromLat, input.fromLon, input.toLat, input.toLon);
    const durationMinutes = Math.max(5, Math.round((distanceKm / 25) * 60));
    return { distanceKm, durationMinutes };
  }

  async estimateETA(input: TravelEstimateInput & { departAt?: Date }): Promise<TravelEstimate> {
    return this.estimateTravel(input);
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const defaultTravelProvider = new HaversineTravelEstimateProvider();
