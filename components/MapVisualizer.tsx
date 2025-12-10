import React, { useEffect, useRef } from 'react';
import { Activity, ActivityStatus } from '../types';

// We need to declare L (Leaflet) because it's loaded via CDN
declare const L: any;

interface MapVisualizerProps {
  activities: Activity[];
}

const MapVisualizer: React.FC<MapVisualizerProps> = ({ activities }) => {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      // Mbalmayo, Cameroon Coordinates
      const mbalmayoLat = 3.5167;
      const mbalmayoLng = 11.5000;

      mapInstanceRef.current = L.map(mapRef.current).setView([mbalmayoLat, mbalmayoLng], 13);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      // Cleanup map on unmount if needed, though usually fine to keep for SPA
    };
  }, []);

  // Update Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => mapInstanceRef.current.removeLayer(marker));
    markersRef.current = [];

    // Add new markers
    activities.forEach(activity => {
      const color = getActivityColor(activity.status);
      
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const marker = L.marker([activity.coordinates.lat, activity.coordinates.lng], { icon: customIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div class="text-slate-800">
            <strong>${activity.title}</strong><br/>
            <span class="text-xs text-slate-500">${activity.timestamp}</span><br/>
            ${activity.description}<br/>
            <span class="inline-block px-2 py-1 mt-1 rounded text-xs text-white" style="background-color: ${color}">
              ${activity.status}
            </span>
          </div>
        `);
      
      markersRef.current.push(marker);
    });

    // Fit bounds if activities exist
    if (activities.length > 0) {
        const group = new L.featureGroup(markersRef.current);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }

  }, [activities]);

  const getActivityColor = (status: ActivityStatus) => {
    switch (status) {
      case ActivityStatus.ALERT: return '#ef4444'; // Red
      case ActivityStatus.IN_PROGRESS: return '#3b82f6'; // Blue
      case ActivityStatus.COMPLETED: return '#22c55e'; // Green
      default: return '#fbbf24'; // Amber
    }
  };

  return (
    <div className="h-full w-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 relative">
      <div ref={mapRef} className="h-full w-full z-0" />
      <div className="absolute top-4 right-4 z-[400] bg-slate-900/90 backdrop-blur p-4 rounded-lg border border-slate-700 text-xs">
        <h4 className="font-bold text-slate-200 mb-2">Légende Carte</h4>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Alert/Panne</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> En Cours</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-green-500"></div> Terminé</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div> En Attente</div>
      </div>
    </div>
  );
};

export default MapVisualizer;
