'use client';

import React, { useEffect, useState } from 'react';

interface DeliveryMapProps {
  lat?: number;
  lng?: number;
  riderName?: string;
}

export default function DeliveryMap({ lat, lng, riderName }: DeliveryMapProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load Leaflet CSS
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    style.id = 'leaflet-css';
    
    if (!document.getElementById('leaflet-css')) {
        document.head.appendChild(style);
    }

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.id = 'leaflet-js';
    
    if (!document.getElementById('leaflet-js')) {
        document.head.appendChild(script);
        script.onload = () => setMapLoaded(true);
    } else {
        setMapLoaded(true);
    }

    return () => {
      // We don't necessarily want to remove scripts if other components use them
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded || !lat || !lng) return;

    const L = (window as any).L;
    if (!L) return;

    // Initialize map if not already done
    if (!mapRef.current) {
      mapRef.current = L.map('delivery-live-map', {
          zoomControl: false,
          scrollWheelZoom: false
      }).setView([lat, lng], 15);

      L.tileLayer('https://{s}.tile.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      }).addTo(mapRef.current);

      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    }

    // Update or create marker
    if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        mapRef.current.panTo([lat, lng]);
    } else {
        const riderIcon = L.divIcon({
            className: 'rider-marker',
            html: `
                <div style="background: var(--primary); width: 40px; height: 40px; border-radius: 50%; border: 3px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18h14M15 6a3 3 0 1 0-6 0v4H7a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2V6z"/></svg>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        markerRef.current = L.marker([lat, lng], { icon: riderIcon }).addTo(mapRef.current);
        markerRef.current.bindPopup(`<strong>${riderName || 'Delivery Rider'}</strong><br/>Live Movement`).openPopup();
    }

  }, [mapLoaded, lat, lng, riderName]);

  return (
    <div className="map-wrapper" style={{ position: 'relative', height: '100%', width: '100%' }}>
        {!mapLoaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-200)', zIndex: 1 }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>Initializing Live Tracking Map...</p>
            </div>
        )}
        <div id="delivery-live-map" style={{ height: '100%', width: '100%', borderRadius: '16px', background: 'var(--bg-300)' }} />
    </div>
  );
}
