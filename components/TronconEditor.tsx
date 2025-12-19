
import React, { useState, useEffect } from 'react';
import { CableSection, Bts, Ctt } from '../types';
import { getRouteStats, searchLocation } from '../services/routingService';
import { FIBER_STANDARDS, getFiberStandard } from '../storageService';

interface TronconEditorProps {
  section: CableSection;
  availableNodes: (Bts | Ctt)[]; // List of available sites
  onSave: (updatedSection: CableSection) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const TronconEditor: React.FC<TronconEditorProps> = ({ section, availableNodes, onSave, onDelete, onClose }) => {
  const [name, setName] = useState(section.name);
  const [cableType, setCableType] = useState(section.cableType);
  const [lengthKm, setLengthKm] = useState(section.lengthKm || 0);
  const [isHosted, setIsHosted] = useState(section.isHosted || false);
  
  // NEW: Standard Selection
  const [selectedStandardId, setSelectedStandardId] = useState<string>(section.standardId || 'STD_12_1x12');

  // GPS Coordinates State
  const [startLat, setStartLat] = useState(section.startCoordinate?.lat || 0);
  const [startLng, setStartLng] = useState(section.startCoordinate?.lng || 0);
  const [endLat, setEndLat] = useState(section.endCoordinate?.lat || 0);
  const [endLng, setEndLng] = useState(section.endCoordinate?.lng || 0);

  // Selection Modes
  type SelectionMode = 'EXISTING' | 'SEARCH' | 'MANUAL';
  const [startMode, setStartMode] = useState<SelectionMode>('EXISTING');
  const [endMode, setEndMode] = useState<SelectionMode>('EXISTING');

  // Site Selection State
  const [selectedStartNode, setSelectedStartNode] = useState<string>(section.startPointId || '');
  const [selectedEndNode, setSelectedEndNode] = useState<string>(section.endPointId || '');
  const [isCalculating, setIsCalculating] = useState(false);

  // Search State
  const [startSearchQuery, setStartSearchQuery] = useState('');
  const [endSearchQuery, setEndSearchQuery] = useState('');
  const [startSearchResults, setStartSearchResults] = useState<{name:string, lat:number, lng:number}[]>([]);
  const [endSearchResults, setEndSearchResults] = useState<{name:string, lat:number, lng:number}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Active Standard for Preview
  const activeStandard = getFiberStandard(selectedStandardId) || FIBER_STANDARDS[0];

  // Handle Node Selection Logic
  useEffect(() => {
      if (selectedStartNode && startMode === 'EXISTING') {
          const node = availableNodes.find(n => n.id === selectedStartNode);
          if (node) {
              setStartLat(node.coordinates.lat);
              setStartLng(node.coordinates.lng);
          }
      }
  }, [selectedStartNode, availableNodes, startMode]);

  useEffect(() => {
      if (selectedEndNode && endMode === 'EXISTING') {
          const node = availableNodes.find(n => n.id === selectedEndNode);
          if (node) {
              setEndLat(node.coordinates.lat);
              setEndLng(node.coordinates.lng);
          }
      }
  }, [selectedEndNode, availableNodes, endMode]);

  // --- SEARCH HANDLERS ---
  const handleSearch = async (point: 'START' | 'END', query: string) => {
      if(point === 'START') setStartSearchQuery(query); else setEndSearchQuery(query);
      
      if(query.length < 3) return;
      
      setIsSearching(true);
      const results = await searchLocation(query);
      setIsSearching(false);

      if(point === 'START') setStartSearchResults(results);
      else setEndSearchResults(results);
  };

  const selectSearchResult = (point: 'START' | 'END', res: {name: string, lat: number, lng: number}) => {
      if(point === 'START') {
          setStartLat(res.lat);
          setStartLng(res.lng);
          setStartSearchQuery(res.name); // Keep name visible
          setStartSearchResults([]);
      } else {
          setEndLat(res.lat);
          setEndLng(res.lng);
          setEndSearchQuery(res.name);
          setEndSearchResults([]);
      }
  };

  // --- ROUTING ---
  const handleCalculateRoute = async () => {
      if (!startLat || !startLng || !endLat || !endLng) return;
      setIsCalculating(true);
      
      const stats = await getRouteStats(
          { lat: startLat, lng: startLng },
          { lat: endLat, lng: endLng }
      );
      
      if (stats) {
          setLengthKm(stats.distanceKm);
      }
      setIsCalculating(false);
  };

  const handleSave = () => {
    onSave({
        ...section,
        name,
        cableType,
        fiberCount: activeStandard.fiberCount,
        lengthKm,
        isHosted,
        standardId: selectedStandardId,
        startCoordinate: (startLat && startLng) ? { lat: startLat, lng: startLng } : undefined,
        endCoordinate: (endLat && endLng) ? { lat: endLat, lng: endLng } : undefined,
        startPointId: selectedStartNode || section.startPointId,
        endPointId: selectedEndNode || section.endPointId
    });
  };

  const getTubeColorHex = (colorName: string) => {
    const map: Record<string, string> = {
      'Bleu': '#3b82f6', 'Orange': '#f97316', 'Vert': '#22c55e', 'Marron': '#854d0e',
      'Gris': '#94a3b8', 'Blanc': '#f8fafc', 'Rouge': '#ef4444', 'Noir': '#000000',
      'Jaune': '#eab308', 'Violet': '#a855f7', 'Rose': '#ec4899', 'Aqua': '#06b6d4'
    };
    return map[colorName] || '#64748b';
  };
  
  // Logic to determine Tube Colors based on standard sequence (usually same as fibers)
  const getTubeColor = (idx: number) => {
      const color = activeStandard.colors[idx % activeStandard.colors.length];
      return getTubeColorHex(color);
  };

  // Sub-component for coordinate selection box
  const LocationSelector = (label: string, point: 'START' | 'END') => {
      const mode = point === 'START' ? startMode : endMode;
      const setMode = point === 'START' ? setStartMode : setEndMode;
      const lat = point === 'START' ? startLat : endLat;
      const lng = point === 'START' ? startLng : endLng;
      const setLat = point === 'START' ? setStartLat : setEndLat;
      const setLng = point === 'START' ? setStartLng : setEndLng;
      const selectedNode = point === 'START' ? selectedStartNode : selectedEndNode;
      const setSelectedNode = point === 'START' ? setSelectedStartNode : setSelectedEndNode;
      const searchQuery = point === 'START' ? startSearchQuery : endSearchQuery;
      const searchResults = point === 'START' ? startSearchResults : endSearchResults;

      return (
        <div>
            <div className="flex justify-between items-center mb-1">
                 <div className="text-[10px] text-slate-400 font-bold uppercase">{label}</div>
                 <div className="flex gap-1 bg-slate-900 rounded p-0.5 border border-slate-700">
                     <button onClick={() => setMode('EXISTING')} className={`px-2 py-0.5 text-[9px] rounded ${mode === 'EXISTING' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Site</button>
                     <button onClick={() => setMode('SEARCH')} className={`px-2 py-0.5 text-[9px] rounded ${mode === 'SEARCH' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}>Ville/Map</button>
                     <button onClick={() => setMode('MANUAL')} className={`px-2 py-0.5 text-[9px] rounded ${mode === 'MANUAL' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>GPS</button>
                 </div>
            </div>

            {mode === 'EXISTING' && (
                <select 
                    value={selectedNode} 
                    onChange={e => setSelectedNode(e.target.value)} 
                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white mb-2 focus:border-blue-500"
                >
                    <option value="">-- Choisir un site existant --</option>
                    {availableNodes.map(node => (
                        <option key={node.id} value={node.id}>{node.name} ({node.id.includes('ctt') ? 'CTT' : 'BTS'})</option>
                    ))}
                </select>
            )}

            {mode === 'SEARCH' && (
                <div className="relative mb-2">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => handleSearch(point, e.target.value)}
                        placeholder="Rechercher ville, quartier..."
                        className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-teal-500 outline-none pl-8"
                    />
                    <svg className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    
                    {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full bg-slate-800 border border-slate-600 rounded mt-1 shadow-xl max-h-40 overflow-y-auto">
                            {searchResults.map((res, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => selectSearchResult(point, res)}
                                    className="p-2 hover:bg-teal-600 hover:text-white cursor-pointer text-xs border-b border-slate-700 last:border-0"
                                >
                                    <div className="font-bold">{res.name.split(',')[0]}</div>
                                    <div className="text-[10px] opacity-70 truncate">{res.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            <div className="bg-slate-950/50 p-2 rounded border border-slate-700/50">
                <div className="flex justify-between items-center mb-1">
                     <label className="text-[9px] text-slate-500">Coordonnées (Lat, Lng)</label>
                     {lat && lng ? <span className="text-[9px] text-green-500">✔ Valide</span> : <span className="text-[9px] text-slate-600">En attente</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <input 
                            type="number" step="0.000001" 
                            value={lat} 
                            onChange={e => {setLat(parseFloat(e.target.value)); if(mode==='EXISTING') setSelectedNode('');}} 
                            placeholder="Lat" 
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white" 
                        />
                    </div>
                    <div>
                        <input 
                            type="number" step="0.000001" 
                            value={lng} 
                            onChange={e => {setLng(parseFloat(e.target.value)); if(mode==='EXISTING') setSelectedNode('');}} 
                            placeholder="Lng" 
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white" 
                        />
                    </div>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-600 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Éditeur de Tronçon & Géolocalisation
            </h3>
            <div className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">ID: {section.id.slice(-6)}</div>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
            
            {/* Identification */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nom du Tronçon</label>
                <input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Ex: Mbalmayo -> PK 12 (Carrefour)"
                    className="w-full bg-slate-950 border border-slate-600 rounded p-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" 
                />
            </div>

            {/* GPS Coordinates & Routing Section */}
            <div className="bg-slate-800/30 p-4 rounded border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-yellow-500 uppercase flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Géolocalisation & Tracé Automatique
                    </h4>
                </div>

                <div className="grid grid-cols-2 gap-6 relative">
                    {/* START POINT */}
                    {LocationSelector("Point de Départ (A)", 'START')}

                    {/* END POINT */}
                    {LocationSelector("Point d'Arrivée (B)", 'END')}
                </div>

                {/* AUTO CALCULATE BUTTON */}
                <div className="mt-4 flex justify-center">
                    <button 
                        onClick={handleCalculateRoute}
                        disabled={!startLat || !endLat || isCalculating}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 transition-all hover:scale-105"
                    >
                        {isCalculating ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Calcul Itinéraire & Distance...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                                Tracer Route & Calculer Distance
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Capacity Engine */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <label className="block text-xs font-bold text-teal-400 uppercase mb-3">Définition Physique (Standard de Fibre)</label>
                
                <div className="mb-4">
                     <label className="block text-[10px] text-slate-400 mb-1">Standard / Structure du Câble</label>
                     <select 
                        value={selectedStandardId}
                        onChange={e => setSelectedStandardId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white font-bold"
                     >
                        {FIBER_STANDARDS.map(std => (
                            <option key={std.id} value={std.id}>{std.name}</option>
                        ))}
                     </select>
                     <div className="text-[9px] text-slate-500 mt-1 flex justify-between">
                         <span>Config: {activeStandard.tubes} Tubes de {activeStandard.fibersPerTube} Fibres ({activeStandard.fiberCount} FO total)</span>
                         <span className="italic">Couleurs: {activeStandard.colors.slice(0, 6).join(', ')}...</span>
                     </div>
                </div>

                {/* Visualizer */}
                <div className="mb-2">
                    <label className="block text-[10px] text-slate-500 mb-2">Prévisualisation Coupe Transversale</label>
                    <div className="flex flex-wrap gap-2 bg-slate-900 p-3 rounded-lg border border-slate-700 justify-center min-h-[60px] items-center">
                        {Array.from({ length: activeStandard.tubes }).map((_, i) => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-600 shadow-lg flex items-center justify-center relative" style={{backgroundColor: getTubeColor(i)}} title={`Tube ${i+1}`}>
                                <span className={`text-[9px] font-bold ${['Blanc', 'Jaune'].includes(activeStandard.colors[i % activeStandard.colors.length]) ? 'text-slate-900' : 'text-white'}`}>{activeStandard.fibersPerTube}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Physical Specs */}
            <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Type de Gaine</label>
                    <input 
                        value={cableType} 
                        onChange={e => setCableType(e.target.value)} 
                        placeholder="Ex: G.652D Souterrain"
                        className="w-full bg-slate-950 border border-slate-600 rounded p-2 text-sm text-white" 
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Longueur Réelle (km)</label>
                    <input 
                        type="number" 
                        step="0.001" 
                        value={lengthKm} 
                        onChange={e => setLengthKm(parseFloat(e.target.value))} 
                        className="w-full bg-slate-950 border border-slate-600 rounded p-2 text-sm text-white font-bold text-teal-400" 
                    />
                </div>
            </div>

            <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={isHosted} 
                        onChange={e => setIsHosted(e.target.checked)} 
                        className="w-4 h-4 rounded bg-slate-900 border-slate-500 text-teal-600 focus:ring-teal-500" 
                    />
                    <div>
                        <span className="text-sm font-bold text-slate-200">Mode "Hébergé" (Gaine Partagée)</span>
                        <p className="text-[10px] text-slate-500">Cochez si ces brins circulent dans un câble appartenant à une autre liaison (ex: Backone existant).</p>
                    </div>
                </label>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between gap-3">
            {onDelete && (
                <button onClick={onDelete} className="px-4 py-2 bg-red-900/40 text-red-500 hover:bg-red-600 hover:text-white border border-red-900/50 rounded shadow text-xs font-bold transition-colors">
                    Supprimer ce Tronçon
                </button>
            )}
            <div className="flex gap-3 ml-auto">
                <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
                <button onClick={handleSave} className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded shadow-lg text-sm font-bold transition-transform active:scale-95">Valider & Enregistrer</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TronconEditor;
