import { useEffect, useRef, useState } from 'react';

interface MapDisplayProps {
  lat: number;
  lng: number;
  venue?: string;
  locationDetails?: string;
}

declare global {
  interface Window {
    initMap?: () => void;
  }
}

const MapDisplay = ({ lat, lng, venue, locationDetails }: MapDisplayProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerInstance = useRef<google.maps.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found');
      return;
    }

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => console.error('Error loading Google Maps');
    document.head.appendChild(script);

    return () => {
      // Cleanup script if component unmounts before loading
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapContainer.current) return;

    // Create map
    const map = new google.maps.Map(mapContainer.current, {
      center: { lat, lng },
      zoom: 15,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    // Create marker
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: venue || 'สถานที่ประชุม',
    });

    // Create info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 200px;">
          ${venue ? `<h3 style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">${venue}</h3>` : ''}
          ${locationDetails ? `<p style="font-size: 12px; color: #666; margin: 0;">${locationDetails}</p>` : ''}
        </div>
      `,
    });

    // Show info window by default
    infoWindow.open(map, marker);

    // Open info window on marker click
    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    mapInstance.current = map;
    markerInstance.current = marker;

    // Cleanup
    return () => {
      markerInstance.current?.setMap(null);
      mapInstance.current = null;
    };
  }, [isLoaded, lat, lng, venue, locationDetails]);

  return (
    <div className="relative w-full h-[300px] rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="absolute inset-0" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-sm text-muted-foreground">กำลังโหลดแผนที่...</p>
        </div>
      )}
    </div>
  );
};

export default MapDisplay;
