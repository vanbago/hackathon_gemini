
import React, { useState, useEffect } from 'react';
import { CableSection } from '../types';

interface TronconEditorProps {
  section: CableSection;
  onSave: (updatedSection: CableSection) => void;
  onClose: () => void;
}

const TronconEditor: React.FC<TronconEditorProps> = ({ section, onSave, onClose }) => {
  const [name, setName] = useState(section.name);
  const [cableType, setCableType] = useState(section.cableType);
  const [fiberCount, setFiberCount] = useState(section.fiberCount);
  const [lengthKm, setLengthKm] = useState(section.lengthKm || 0);
  const [isHosted, setIsHosted] = useState(section.isHosted || false);

  // GPS Coordinates State
  const [startLat, setStartLat] = useState(section.startCoordinate?.lat || 0);
  const [startLng, setStartLng] = useState(section.startCoordinate?.lng || 0);
  const [endLat, setEndLat] = useState(section.endCoordinate?.lat || 0);
  const [endLng, setEndLng] = useState(section.endCoordinate?.lng || 0);

  // Calculated State for Cable Structure
  const [structure, setStructure] = useState<{tubes: number, fibersPerTube: number, type: string}>({ tubes: 1, fibersPerTube: 12, type: 'Standard' });

  // Update structure analysis when fiberCount changes
  useEffect(() => {
    let tubes = 1;
    let fpt = 12;
    let type = 'Standard G.652D';

    if (fiberCount <= 6) { tubes = 1; fpt = 6; type = 'Drop Cable / Last Mile'; }
    else if (fiberCount === 8) { tubes = 1; fpt = 8; type = 'Spécial (8 FO)'; } // Cas rare
    else if (fiberCount <= 12) { tubes = 1; fpt = 12; type = 'Monotube Standard'; }
    else if (fiberCount === 18) { tubes = 3; fpt = 6; type = 'Multitube (3x6)'; }
    else if (fiberCount === 24) { tubes = 2; fpt = 12; type = 'Multitube (2x12) ou (4x6)'; } // Souvent 4x6 en distribution
    else if (fiberCount === 36) { tubes = 3; fpt = 12; type = 'Multitube (3x12)'; }
    else if (fiberCount === 48) { tubes = 4; fpt = 12; type = 'Multitube (4x12)'; }
    else if (fiberCount === 72) { tubes = 6; fpt = 12; type = 'Multitube (6x12)'; }
    else if (fiberCount === 96) { tubes = 8; fpt = 12; type = 'Multitube (8x12)'; }
    else if (fiberCount === 144) { tubes = 12; fpt = 12; type = 'Gros porteur (12x12)'; }
    else { tubes = Math.ceil(fiberCount / 12); fpt = 12; type = 'Custom / Hébergé'; }

    setStructure({ tubes, fibersPerTube: fpt, type });
  }, [fiberCount]);

  const handleSave = () => {
    onSave({
        ...section,
        name,
        cableType,
        fiberCount,
        lengthKm,
        isHosted,
        startCoordinate: (startLat && startLng) ? { lat: startLat, lng: startLng } : undefined,
        endCoordinate: (endLat && endLng) ? { lat: endLat, lng: endLng } : undefined
    });
  };

  const getTubeColor = (idx: number) => {
      const colors = ["bg-blue-500", "bg-orange-500", "bg-green-500", "bg-amber-700", "bg-slate-400", "bg-white", "bg-red-500", "bg-black", "bg-yellow-400", "bg-purple-500", "bg-pink-500", "bg-cyan-400"];
      return colors[idx % 12];
  };

  return (
    <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-600 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
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

            {/* GPS Coordinates Section */}
            <div className="bg-slate-800/30 p-4 rounded border border-slate-700">
                <h4 className="text-xs font-bold text-yellow-500 uppercase mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Points d'Extrémité (GPS Manchons)
                </h4>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase">Début Tronçon</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[9px] text-slate-500">Latitude</label>
                                <input type="number" step="0.000001" value={startLat} onChange={e => setStartLat(parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-600 rounded p-1.5 text-xs text-white" />
                            </div>
                            <div>
                                <label className="block text-[9px] text-slate-500">Longitude</label>
                                <input type="number" step="0.000001" value={startLng} onChange={e => setStartLng(parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-600 rounded p-1.5 text-xs text-white" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase">Fin Tronçon</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[9px] text-slate-500">Latitude</label>
                                <input type="number" step="0.000001" value={endLat} onChange={e => setEndLat(parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-600 rounded p-1.5 text-xs text-white" />
                            </div>
                            <div>
                                <label className="block text-[9px] text-slate-500">Longitude</label>
                                <input type="number" step="0.000001" value={endLng} onChange={e => setEndLng(parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-600 rounded p-1.5 text-xs text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Capacity Engine */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <label className="block text-xs font-bold text-teal-400 uppercase mb-3">Définition Physique du Câble</label>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Capacité Totale (FO)</label>
                        <div className="relative">
                            <select 
                                value={fiberCount} 
                                onChange={e => setFiberCount(parseInt(e.target.value))} 
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white appearance-none font-bold"
                            >
                                <option value={6}>6 FO</option>
                                <option value={8}>8 FO</option>
                                <option value={12}>12 FO</option>
                                <option value={18}>18 FO</option>
                                <option value={24}>24 FO</option>
                                <option value={36}>36 FO</option>
                                <option value={48}>48 FO</option>
                                <option value={72}>72 FO</option>
                                <option value={96}>96 FO</option>
                                <option value={144}>144 FO</option>
                            </select>
                            <div className="absolute right-3 top-2.5 pointer-events-none">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                    <div>
                         <label className="block text-[10px] text-slate-400 mb-1">Structure Estimée</label>
                         <div className="text-sm font-mono text-slate-300 bg-slate-900 p-2 rounded border border-slate-600">
                             {structure.tubes} Tubes x {structure.fibersPerTube}
                         </div>
                    </div>
                </div>

                {/* Visualizer */}
                <div className="mb-2">
                    <label className="block text-[10px] text-slate-500 mb-2">Prévisualisation Coupe Transversale</label>
                    <div className="flex flex-wrap gap-2 bg-slate-900 p-3 rounded-lg border border-slate-700 justify-center min-h-[60px] items-center">
                        {Array.from({ length: structure.tubes }).map((_, i) => (
                            <div key={i} className={`w-8 h-8 rounded-full border-2 border-slate-600 shadow-lg flex items-center justify-center relative ${getTubeColor(i)}`} title={`Tube ${i+1}`}>
                                <span className={`text-[9px] font-bold ${i === 5 || i === 1 ? 'text-slate-900' : 'text-white'}`}>{structure.fibersPerTube}</span>
                            </div>
                        ))}
                    </div>
                    <div className="text-center text-[10px] text-slate-500 mt-1 italic">{structure.type}</div>
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
                        className="w-full bg-slate-950 border border-slate-600 rounded p-2 text-sm text-white" 
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
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
            <button onClick={handleSave} className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded shadow-lg text-sm font-bold transition-transform active:scale-95">Valider & Enregistrer</button>
        </div>
      </div>
    </div>
  );
};

export default TronconEditor;
