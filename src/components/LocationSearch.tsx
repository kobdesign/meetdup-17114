import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';

interface LocationResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface LocationSearchProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (lat: number, lng: number, placeName: string) => void;
  label?: string;
  placeholder?: string;
}

const LocationSearch = ({ value, onChange, onLocationSelect, label, placeholder }: LocationSearchProps) => {
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocation = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&language=th&components=country:th&key=${apiKey}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch locations');
      
      const data = await response.json();
      setSuggestions(data.predictions || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(newValue);
    }, 500);
  };

  const handleSelectLocation = async (result: LocationResult) => {
    onChange(result.structured_formatting.main_text);
    
    // Get place details to retrieve lat/lng
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    try {
      const detailsResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${result.place_id}&fields=geometry,name,formatted_address&key=${apiKey}`
      );
      
      if (!detailsResponse.ok) throw new Error('Failed to fetch place details');
      
      const detailsData = await detailsResponse.json();
      const place = detailsData.result;
      
      if (place?.geometry?.location) {
        onLocationSelect(
          place.geometry.location.lat,
          place.geometry.location.lng,
          place.formatted_address || result.description
        );
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
    
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="space-y-2 relative">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((result) => (
            <button
              key={result.place_id}
              type="button"
              onClick={() => handleSelectLocation(result)}
              className="w-full px-4 py-3 text-left hover:bg-accent flex items-start gap-3 transition-colors"
            >
              <MapPin className="h-4 w-4 mt-1 flex-shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{result.structured_formatting.main_text}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {result.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
