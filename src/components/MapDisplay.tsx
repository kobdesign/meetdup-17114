import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapDisplayProps {
  lat: number;
  lng: number;
  venue?: string;
  locationDetails?: string;
}

const MapDisplay = ({ lat, lng, venue, locationDetails }: MapDisplayProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Get Mapbox token from environment
    const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: 15,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl(),
      'top-right'
    );

    // Add marker
    const popupContent = `
      <div class="p-2">
        ${venue ? `<h3 class="font-semibold">${venue}</h3>` : ''}
        ${locationDetails ? `<p class="text-sm text-muted-foreground">${locationDetails}</p>` : ''}
      </div>
    `;

    marker.current = new mapboxgl.Marker({ color: '#1e40af' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setHTML(popupContent))
      .addTo(map.current);

    // Show popup by default
    marker.current.getPopup().addTo(map.current);

    // Cleanup
    return () => {
      marker.current?.remove();
      map.current?.remove();
    };
  }, [lat, lng, venue, locationDetails]);

  return (
    <div className="relative w-full h-[300px] rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default MapDisplay;