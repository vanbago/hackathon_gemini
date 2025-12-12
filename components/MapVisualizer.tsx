
import React, { useEffect, useRef, useState } from 'react';
import { Activity, ActivityStatus, Bts, Ctt, Coordinates, Liaison, LiaisonStatus, LiaisonType, Operator, LiaisonCategory, SiteType, InfrastructureType, InfrastructurePoint, EquipmentType, InfrastructureCategory } from '../types';
import { getRoadPath } from '../services/routingService';

declare const L: any;

interface MapVisualizerProps {
  activities: Activity[];
  ctt: Ctt | null;
  btsStations: Bts[];
  liaisons: Liaison[];
  onLiaisonClick?: (liaison: Liaison) => void;
  onNodeClick?: (node: Bts | Ctt, type: 'BTS' | 'CTT') => void;
}

const MapVisualizer: React.FC<MapVisualizerProps> = ({ activities, ctt, btsStations, liaisons, onLiaisonClick, onNodeClick }) => {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const liaisonLayersRef = useRef<any[]>([]);
  const cttMarkersRef = useRef<any[]>([]);
  const infraMarkersRef = useRef<any[]>([]);

  const [roadPaths, setRoadPaths] = useState<Record<string, [number, number][]>>({});

  // Fetch Paths with support for Waypoints
  useEffect(() => {
    const fetchPaths = async () => {
      const newPaths: Record<string, [number, number][]> = {};
      
      // Batch processing could be better, but parallel is fine for small number
      await Promise.all(liaisons.map(async (liaison) => {
        if (liaison.type === LiaisonType.FIBER && !roadPaths[liaison.id]) {
            const path = await getRoadPath(
                liaison.startCoordinates, 
                liaison.endCoordinates,
                liaison.routingWaypoints // Pass specific waypoints (K4, Carrefours)
            );
            
            if (path) {
                // Apply Visual Offset if requested (to simulate sides of road)
                if (liaison.visualOffset) {
                   // This is a simple approximation. For real GIS offset we need turf.js
                   // We shift lat/lng slightly. 0.00005 deg is roughly 5 meters
                   const offsetDeg = liaison.visualOffset * 0.00008; // Increased slightly for visibility
                   const offsetPath = path.map(([lat, lng]) => [lat + offsetDeg, lng + offsetDeg]) as [number, number][];
                   newPaths[liaison.id] = offsetPath;
                } else {
                   newPaths[liaison.id] = path;
                }
            }
        }
      }));

      if (Object.keys(newPaths).length > 0) {
          setRoadPaths(prev => ({ ...prev, ...newPaths }));
      }
    };
    fetchPaths();
  }, [liaisons]);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const initialLat = ctt?.coordinates.lat || 3.5167;
      const initialLng = ctt?.coordinates.lng || 11.5000;
      mapInstanceRef.current = L.map(mapRef.current).setView([initialLat, initialLng], 12); // Zoomed in to see road details
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstanceRef.current);
    }
  }, [ctt]);

  const getEquipmentBadgeColor = (type: EquipmentType) => {
      switch(type) {
          case EquipmentType.WDM: return 'bg-purple-600';
          case EquipmentType.SDH: return 'bg-blue-600';
          case EquipmentType.IP_MPLS: return 'bg-cyan-600';
          case EquipmentType.MICROWAVE: return 'bg-orange-600';
          default: return 'bg-slate-600';
      }
  };

  // Update CTT
  useEffect(() => {
    if (!mapInstanceRef.current || !ctt) return;
    cttMarkersRef.current.forEach(marker => mapInstanceRef.current.removeLayer(marker));
    cttMarkersRef.current = [];
    
    // Generate Equipments HTML
    const equipHtml = ctt.equipments?.map(eq => 
        `<span class="inline-block px-1.5 py-0.5 text-[9px] rounded text-white mr-1 mb-1 ${getEquipmentBadgeColor(eq.type)}">${eq.name}</span>`
    ).join('') || '';

    const cttIcon = L.divIcon({
      className: 'ctt-icon bg-transparent',
      html: `<div class="relative flex items-center justify-center"><div class="absolute inset-0 bg-purple-600 blur-md opacity-50 rounded-full animate-pulse"></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 text-purple-500 drop-shadow-lg z-10 filter"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" /><path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" /></svg></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    
    const popupContent = `
        <div class="font-sans min-w-[150px]">
            <div class="font-bold text-lg text-purple-700 mb-1">${ctt.name}</div>
            <div class="text-xs text-slate-600 font-semibold mb-2">Centre de Transmission Principal</div>
            <div class="border-t border-slate-200 pt-2">
                <div class="text-[10px] uppercase text-slate-500 font-bold mb-1">Équipements</div>
                <div>${equipHtml}</div>
            </div>
            <div class="mt-2 text-center text-xs font-bold text-blue-600 animate-pulse">>>> CLIQUEZ POUR ÉDITER <<<</div>
        </div>
    `;

    const m = L.marker([ctt.coordinates.lat, ctt.coordinates.lng], { icon: cttIcon }).addTo(mapInstanceRef.current).bindPopup(popupContent);
    
    m.on('click', () => {
        if(onNodeClick) onNodeClick(ctt, 'CTT');
    });

    cttMarkersRef.current.push(m);
  }, [ctt, onNodeClick]);

  // Update BTS
  useEffect(() => {
     if (!mapInstanceRef.current) return;
     markersRef.current.forEach(layer => mapInstanceRef.current.removeLayer(layer));
     markersRef.current = [];
     btsStations.forEach(bts => {
         const color = bts.operator === Operator.CAMTEL ? '#06b6d4' : (bts.operator === Operator.MTN ? '#facc15' : '#f97316');
         
         const precisionCircle = L.circle([bts.coordinates.lat, bts.coordinates.lng], {
             radius: 400,
             color: color,
             weight: 1,
             opacity: 0.3,
             fillColor: color,
             fillOpacity: 0.05,
             interactive: false,
             dashArray: '4, 4'
         }).addTo(mapInstanceRef.current);
         markersRef.current.push(precisionCircle);

         const icon = L.divIcon({
            className: 'bg-transparent',
            html: `<div class="relative flex flex-col items-center justify-end h-full group hover:scale-110 transition-transform duration-200">
             <svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1" class="w-8 h-8 drop-shadow-md z-10">
                <path d="M12 2L2 22h20L12 2z" stroke-width="0" opacity="0.4"/>
                <path d="M12 2L4 22M12 2L20 22" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M12 2v20" stroke="white" stroke-width="1.5"/>
             </svg>
             <div class="absolute -bottom-1 w-1.5 h-1.5 bg-white rounded-full shadow-sm z-20" style="border: 1px solid ${color}"></div>
             </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 30],
            popupAnchor: [0, -30]
         });

         // Equipments HTML for BTS
         const equipHtml = bts.equipments?.map(eq => 
            `<span class="inline-block px-1.5 py-0.5 text-[9px] rounded text-white mr-1 mb-1 ${getEquipmentBadgeColor(eq.type)}">${eq.name}</span>`
         ).join('') || '';

         const popupContent = `
            <div class="font-sans min-w-[150px]">
                <div class="font-bold text-sm text-slate-800">${bts.name}</div>
                <div class="text-xs text-slate-500 mb-2">${bts.operator} • ${bts.type}</div>
                ${equipHtml ? `
                <div class="border-t border-slate-200 pt-2 mt-1">
                    <div class="text-[10px] uppercase text-slate-500 font-bold mb-1">Équipements</div>
                    <div>${equipHtml}</div>
                </div>` : ''}
                <div class="mt-2 text-center text-[10px] font-bold text-blue-600 cursor-pointer hover:underline">Modifier le Nœud</div>
            </div>
         `;

         const m = L.marker([bts.coordinates.lat, bts.coordinates.lng], { icon }).addTo(mapInstanceRef.current).bindPopup(popupContent);
         
         m.on('popupopen', () => {
             const el = m.getPopup()?.getElement();
             if(el) {
                 el.addEventListener('click', () => {
                     if(onNodeClick) onNodeClick(bts, 'BTS');
                 });
             }
         });

         markersRef.current.push(m);
     });
  }, [btsStations, onNodeClick]);
  
  // Update Liaisons and Infrastructure Points
  useEffect(() => {
      if (!mapInstanceRef.current) return;
      
      liaisonLayersRef.current.forEach(layer => mapInstanceRef.current.removeLayer(layer));
      liaisonLayersRef.current = [];
      infraMarkersRef.current.forEach(layer => mapInstanceRef.current.removeLayer(layer));
      infraMarkersRef.current = [];

      const getLiaisonColor = (liaison: Liaison) => {
          if (liaison.color) return liaison.color; // USE CUSTOM COLOR IF DEFINED
          if (liaison.status === LiaisonStatus.FAULTY) return '#ef4444';
          if (liaison.status === LiaisonStatus.MAINTENANCE) return '#f97316';
          return '#06b6d4'; // Default Cyan
      };

      const getFiberColorHex = (colorName: string) => {
          const map: Record<string, string> = {
              'Bleu': '#3b82f6', 'Orange': '#f97316', 'Vert': '#22c55e', 'Marron': '#854d0e',
              'Gris': '#94a3b8', 'Blanc': '#f8fafc', 'Rouge': '#ef4444', 'Noir': '#000000',
              'Jaune': '#eab308', 'Violet': '#a855f7', 'Rose': '#ec4899', 'Aqua': '#06b6d4'
          };
          return map[colorName] || '#fff';
      };

      liaisons.forEach(liaison => {
          // Draw Polyline
          const latlngs = (liaison.type === LiaisonType.FIBER && roadPaths[liaison.id]) 
            ? roadPaths[liaison.id] 
            : [[liaison.startCoordinates.lat, liaison.startCoordinates.lng], [liaison.endCoordinates.lat, liaison.endCoordinates.lng]];
          
          const isBackbone = liaison.category === LiaisonCategory.BACKBONE;
          const lineWeight = isBackbone ? 5 : 3;
          const lineOpacity = isBackbone ? 0.9 : 0.7;
          // Radio links are dashed, fiber links are solid (or specific style)
          const dashArray = (liaison.type === LiaisonType.RADIO ? '5, 10' : undefined);
          const zIndexOffset = isBackbone ? 100 : 0; 
          const color = getLiaisonColor(liaison);

          const polyline = L.polyline(latlngs, { 
              color: color, 
              weight: lineWeight,
              opacity: lineOpacity,
              dashArray: dashArray,
              zIndexOffset: zIndexOffset
          }).addTo(mapInstanceRef.current);

          const statusClass = liaison.status === LiaisonStatus.FAULTY ? 'text-red-500 font-bold' : 'text-green-400 font-bold';
          const typeLabel = isBackbone ? 'BACKBONE (Artère)' : 'LAST MILE (Accès)';

          // BUILD SECTIONS HTML IF EXIST
          let sectionsHtml = '';
          if (liaison.sections && liaison.sections.length > 0) {
              sectionsHtml = `
                <div class="mt-2 pt-2 border-t border-slate-600">
                    <div class="text-[10px] uppercase text-slate-400 font-bold mb-1">Détail des Tronçons (Capacité Variable)</div>
                    <div class="space-y-1">
                        ${liaison.sections.map((sec, idx) => `
                            <div class="flex items-center justify-between text-[10px] bg-slate-800 p-1 rounded border border-slate-700">
                                <div class="flex flex-col">
                                    <span class="text-slate-300 font-bold">#${idx+1} ${sec.name}</span>
                                    <span class="text-[9px] text-slate-500">${sec.cableType}</span>
                                </div>
                                <span class="px-1.5 rounded ${sec.isHosted ? 'bg-orange-900/40 text-orange-400 border border-orange-500/30' : 'bg-blue-900/40 text-blue-400'}">
                                    ${sec.isHosted ? 'Hébergé' : `${sec.fiberCount} FO`}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
              `;
          } else {
             sectionsHtml = `<div class="mt-2 text-[10px] text-slate-500 italic">Aucun tronçon défini. Capacité théorique globale: ${liaison.fiberCount} FO.</div>`
          }

          // Build Fiber HTML
          let fibersHtml = '';
          if (liaison.fiberStrands && liaison.fiberStrands.length > 0) {
              fibersHtml = `
                <div class="mt-2 pt-2 border-t border-slate-600">
                    <div class="text-[10px] uppercase text-slate-400 font-bold mb-1">Services / Brins (Logique)</div>
                    <div class="max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                        <table class="w-full text-[10px] text-left border-collapse">
                            <thead><tr class="text-slate-500"><th class="pb-1">#</th><th class="pb-1">Coul.</th><th class="pb-1">Service</th></tr></thead>
                            <tbody>
                                ${liaison.fiberStrands.map(f => `
                                    <tr class="border-b border-slate-700/50">
                                        <td class="py-0.5 text-slate-400">${f.number}</td>
                                        <td class="py-0.5"><span class="inline-block w-2 h-2 rounded-full mr-1" style="background-color:${getFiberColorHex(f.colorCode)}"></span></td>
                                        <td class="py-0.5 ${f.status === 'USE' ? 'text-white' : (f.status === 'DISCONTINU' ? 'text-red-500 italic' : 'text-slate-500')}">${f.serviceName || (f.status === 'DISCONTINU' ? 'Discontinu' : 'Continu/Libre')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-2 text-center text-cyan-400 text-[10px] font-bold animate-pulse">>>> CLIQUEZ POUR MODIFIER <<<</div>
                </div>
              `;
          }

          const detailsHtml = `
              <div class="min-w-[220px] font-sans text-slate-200 bg-slate-900 p-2 rounded shadow-xl border border-slate-600">
                  <div class="font-bold text-sm border-b border-slate-600 pb-1 mb-2" style="color:${color}">${liaison.name}</div>
                  <div class="text-xs space-y-1">
                      <div class="flex justify-between"><span class="text-slate-400">Type:</span> <span class="font-bold text-yellow-500">${typeLabel}</span></div>
                      <div class="flex justify-between"><span class="text-slate-400">Status:</span> <span class="${statusClass}">${liaison.status}</span></div>
                      <div class="flex justify-between"><span class="text-slate-400">Distance Totale:</span> <span class="font-medium">${liaison.distanceKm} km</span></div>
                  </div>
                  ${sectionsHtml}
                  ${fibersHtml}
              </div>
          `;
          
          polyline.bindTooltip(detailsHtml, { sticky: true, opacity: 1, direction: 'auto', className: 'custom-tooltip' });
          
          polyline.on('click', () => {
             if (onLiaisonClick) onLiaisonClick(liaison);
          });

          // Hover Effects
          polyline.on('mouseover', function (e: any) { e.target.setStyle({ weight: isBackbone ? 8 : 6, opacity: 1 }); });
          polyline.on('mouseout', function (e: any) { e.target.setStyle({ weight: lineWeight, opacity: lineOpacity }); });
          
          liaisonLayersRef.current.push(polyline);

          // 3. Render Infrastructure Points
          if (liaison.infrastructurePoints) {
              liaison.infrastructurePoints.forEach(point => {
                  let shapeSvg;
                  let size = [16, 16];
                  
                  if (point.category === InfrastructureCategory.ARTERE) {
                      // Big Red/Gold Square for Artere (K4)
                      shapeSvg = `<rect x="2" y="2" width="20" height="20" fill="#ef4444" stroke="#fcd34d" stroke-width="3" />`; 
                      size = [24, 24];
                  } else if (point.category === InfrastructureCategory.SEMI_ARTERE) {
                      shapeSvg = `<path d="M12 2L22 12L12 22L2 12Z" fill="#f97316" stroke="white" stroke-width="2" />`;
                      size = [20, 20];
                  } else {
                      if (point.type === InfrastructureType.CHAMBRE) {
                           shapeSvg = `<rect x="6" y="6" width="12" height="12" fill="#8b5cf6" stroke="white" stroke-width="2" />`;
                      } else if (point.type === InfrastructureType.MANCHON_ENTERRE) {
                           shapeSvg = `<path d="M6 6L18 6L12 18Z" fill="#b45309" stroke="white" stroke-width="2" />`;
                      } else {
                           shapeSvg = `<path d="M12 2L22 12L12 22L2 12Z" fill="#ec4899" stroke="white" stroke-width="2" />`;
                      }
                  }

                  const icon = L.divIcon({
                      className: 'bg-transparent',
                      html: `<svg viewBox="0 0 24 24" class="w-full h-full drop-shadow-md hover:scale-125 transition-transform">${shapeSvg}</svg>`,
                      iconSize: size,
                      iconAnchor: [size[0]/2, size[1]/2]
                  });

                  const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon })
                    .addTo(mapInstanceRef.current)
                    .bindPopup(`
                        <div class="text-slate-900 font-sans min-w-[180px]">
                            <div class="font-bold text-base flex items-center gap-2">
                                ${point.name}
                            </div>
                            <div class="text-xs text-slate-600 mb-2 font-semibold">
                                ${point.category === InfrastructureCategory.ARTERE ? '<span class="text-red-600 uppercase">★ Artère (Jonction Backbone)</span>' : 
                                  point.category === InfrastructureCategory.SEMI_ARTERE ? '<span class="text-orange-600 uppercase">Semi-Artère (Piquage)</span>' : 
                                  point.type.replace('_', ' ')}
                            </div>
                            <div class="text-xs bg-slate-100 p-1.5 rounded border border-slate-300">
                                <div><strong>Coords:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</div>
                                ${point.description ? `<div class="mt-1 italic text-slate-500 border-t border-slate-300 pt-1">${point.description}</div>` : ''}
                            </div>
                        </div>
                    `);
                  
                  infraMarkersRef.current.push(marker);
              });
          }
      });
  }, [liaisons, roadPaths, onLiaisonClick, onNodeClick]);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 relative bg-slate-900">
      <div ref={mapRef} className="h-full w-full z-0" />
      <div className="absolute top-4 right-4 z-[400] bg-slate-900/95 p-4 rounded-lg border border-slate-600 text-xs shadow-xl backdrop-blur-sm pointer-events-none">
         <div className="font-bold text-slate-200 mb-2 uppercase tracking-wider border-b border-slate-700 pb-1">Légende Infra</div>
         <div className="space-y-1.5">
             <div className="flex items-center gap-2"><div className="w-8 h-1.5 bg-orange-600 rounded"></div> <span className="text-slate-300 font-bold">Mbyo-Mengbwa</span></div>
             <div className="flex items-center gap-2"><div className="w-8 h-1.5 bg-sky-600 rounded"></div> <span className="text-slate-300 font-bold">Mbyo-Ebanga</span></div>
             <div className="flex items-center gap-2"><div className="w-8 h-1.5 bg-purple-600 rounded"></div> <span className="text-slate-300 font-bold">Mbyo-Sangmélima</span></div>
             <div className="h-px bg-slate-700 my-1"></div>
             
             <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 border-2 border-yellow-400"></div> <span className="text-white font-bold">ARTÈRE (Zoatoupsi)</span></div>
             
             <div className="h-px bg-slate-700 my-1"></div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-500 border border-white"></div> <span className="text-slate-300">Chambre</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-pink-500 border border-white rotate-45 transform ml-0.5"></div> <span className="text-slate-300">Manchon</span></div>
         </div>
      </div>
    </div>
  );
};

export default MapVisualizer;
