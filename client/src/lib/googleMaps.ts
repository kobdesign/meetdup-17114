import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let isInitialized = false;
let placesService: google.maps.places.PlacesService | null = null;

export const initGoogleMapsAPI = () => {
  if (isInitialized) {
    return;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key not found');
  }

  setOptions({
    key: apiKey,
    v: 'weekly',
    language: 'th',
    region: 'TH',
  });

  isInitialized = true;
};

export const loadGoogleMapsAPI = async (): Promise<typeof google> => {
  initGoogleMapsAPI();
  await importLibrary('places');
  return google;
};

export const getPlacesAutocompleteService = async (): Promise<google.maps.places.AutocompleteService> => {
  const google = await loadGoogleMapsAPI();
  return new google.maps.places.AutocompleteService();
};

export const getPlacesService = async (): Promise<google.maps.places.PlacesService> => {
  if (placesService) {
    return placesService;
  }

  const google = await loadGoogleMapsAPI();
  const div = document.createElement('div');
  placesService = new google.maps.places.PlacesService(div);
  return placesService;
};

export interface PlaceAutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export const searchPlaces = async (query: string): Promise<PlaceAutocompleteResult[]> => {
  if (!query || query.length < 3) {
    return [];
  }

  const autocompleteService = await getPlacesAutocompleteService();

  return new Promise((resolve, reject) => {
    autocompleteService.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: 'th' },
        language: 'th',
      },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          const results: PlaceAutocompleteResult[] = predictions.map((prediction) => ({
            placeId: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting.main_text,
            secondaryText: prediction.structured_formatting.secondary_text || '',
          }));
          resolve(results);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          reject(new Error(`Places search failed: ${status}`));
        }
      }
    );
  });
};

export interface PlaceDetails {
  lat: number;
  lng: number;
  formattedAddress: string;
  name: string;
}

export const getPlaceDetails = async (placeId: string): Promise<PlaceDetails> => {
  const placesService = await getPlacesService();

  return new Promise((resolve, reject) => {
    placesService.getDetails(
      {
        placeId,
        fields: ['geometry', 'name', 'formatted_address'],
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          resolve({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            formattedAddress: place.formatted_address || '',
            name: place.name || '',
          });
        } else {
          reject(new Error(`Place details fetch failed: ${status}`));
        }
      }
    );
  });
};
