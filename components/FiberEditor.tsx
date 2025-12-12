
import React, { useState, useEffect } from 'react';
import { Liaison, FiberStrand, InfrastructureType, LiaisonStatus, LiaisonCategory, CableSection, InfrastructurePoint, LiaisonType, Operator } from '../types';
import TronconEditor from './TronconEditor';
import ManchonEditor from './ManchonEditor';

interface FiberEditorProps {
  liaison: Liaison | null; // Null implies creating a new liaison
  onSave: (updatedLiaison: Liaison) => void;
  onClose: () => void;
}

const FiberEditor: React.FC<FiberEditorProps> = ({ liaison: initialLiaison, onSave, onClose }) => {
  // --- STATE INIT ---
  const isNew = !initialLiaison;
  
  // Base State
  const [name, setName] = useState(initialLiaison?.name || 'Nouvelle Liaison');
  const [distanceKm, setDistanceKm] = useState(initialLiaison?.distanceKm || 0);
  const [status, setStatus] = useState<LiaisonStatus>(initialLiaison?.status || LiaisonStatus.MAINTENANCE);
  const [category, setCategory] = useState<LiaisonCategory>(initialLiaison?.category || LiaisonCategory.LAST_MILE);
  
  // Topology State
  const [sections, setSections] = useState<CableSection[]>(initialLiaison?.sections || []);
  const [infraPoints, setInfraPoints] = useState<InfrastructurePoint[]>(initialLiaison?.infrastructurePoints || []);

  // Helpers needed early
  const fiberColors = ["Bleu", "Orange", "Vert", "Marron", "Gris", "Blanc", "Rouge", "Noir", "Jaune", "Violet", "Rose", "Aqua"];
  const generateStandardFibers = (count: number): FiberStrand[] => {
      const arr: FiberStrand[] = [];
      for (let i = 0; i < count; i++) {
          arr.push({
              id: `f-${Date.now()}-${Math.random()}`,
              number: i + 1,
              colorCode: fiberColors[i % 12],
              status: 'CONTINU',
              serviceName: '',
              client: ''
          });
      }
      return arr;
  };

  // Construct current liaison object for child components context
  const currentLiaisonObj: Liaison = {
      id: initialLiaison?.id || `liaison-${Date.now()}`,
      name,
      type: LiaisonType.FIBER,
      status,
      category,
      startCoordinates: initialLiaison?.startCoordinates || { lat: 0, lng: 0 },
      endCoordinates: initialLiaison?.endCoordinates || { lat: 0, lng: 0 },
      distanceKm,
      sections,
      infrastructurePoints: infraPoints,
      fiberCount: sections.length > 0 ? sections[0].fiberCount : 12,
      controlledByCttId: initialLiaison?.controlledByCttId || 'ctt-mbalmayo', // Default to current CTT context
      associatedBtsIds: initialLiaison?.associatedBtsIds || []
  };
  
  // --- NAVIGATION STATE ---
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // --- DERIVED STATE ---
  const activeSection = activeViewId ? sections.find(s => s.id === activeViewId) : null;
  const activeFiberCount = activeSection ? activeSection.fiberCount : (currentLiaisonObj.fiberCount || 12);
  
  // FIX 1: Auto-generate strands if missing in data but section exists (Fixes "Aucune donnée")
  const activeStrands = activeSection 
    ? (activeSection.fiberStrands && activeSection.fiberStrands.length > 0 
        ? activeSection.fiberStrands 
        : generateStandardFibers(activeSection.fiberCount)) 
    : (initialLiaison?.fiberStrands || []);

  // Modals state
  const [editingSection, setEditingSection] = useState<CableSection | null>(null);
  const [editingInfra, setEditingInfra] = useState<InfrastructurePoint | null>(null);

  const getFiberColorHex = (colorName: string) => {
    const map: Record<string, string> = {
      'Bleu': '#3b82f6', 'Orange': '#f97316', 'Vert': '#22c55e', 'Marron': '#854d0e',
      'Gris': '#94a3b8', 'Blanc': '#f8fafc', 'Rouge': '#ef4444', 'Noir': '#000000',
      'Jaune': '#eab308', 'Violet': '#a855f7', 'Rose': '#ec4899', 'Aqua': '#06b6d4'
    };
    return map[colorName] || '#fff';
  };

  const tubeConfig = { fibersPerTube: activeFiberCount >= 18 ? (activeFiberCount % 12 === 0 ? 12 : 6) : 12 }; // Simple approximation
  const tubesCount = Math.ceil(activeFiberCount / tubeConfig.fibersPerTube);

  const handleStrandChange = (id: string, field: keyof FiberStrand, value: any) => {
      if (activeSection) {
          const updatedStrands = activeStrands.map(s => s.id === id ? { ...s, [field]: value } : s);
          setSections(prev => prev.map(sec => sec.id === activeSection.id ? { ...sec, fiberStrands: updatedStrands } : sec));
      }
  };

  const handleSaveLiaison = () => {
    onSave(currentLiaisonObj);
  };

  const handleSaveSection = (updatedSection: CableSection) => {
      let finalSection = updatedSection;
      if (updatedSection.fiberCount !== (sections.find(s => s.id === updatedSection.id)?.fiberCount || 0)) {
           if (!updatedSection.fiberStrands || updatedSection.fiberStrands.length !== updatedSection.fiberCount) {
               finalSection = { ...updatedSection, fiberStrands: generateStandardFibers(updatedSection.fiberCount) };
           }
      }
      if (sections.find(s => s.id === finalSection.id)) {
          setSections(prev => prev.map(s => s.id === finalSection.id ? finalSection : s));
      } else {
          setSections(prev => [...prev, finalSection]);
      }
      setEditingSection(null);
  };

  const handleCreateSection = (startNodeId?: string) => {
      // FIX 2: Better naming convention
      const newSec: CableSection = {
          id: `sec-${Date.now()}`,
          name: startNodeId ? `Nouveau Câble (Départ)` : `Nouveau Tronçon ${sections.length + 1}`,
          fiberCount: 12, 
          cableType: 'Standard Souterrain',
          lengthKm: 0,
          startPointId: startNodeId,
          fiberStrands: generateStandardFibers(12)
      };
      setEditingSection(newSec);
  };

  const handleSaveInfra = (updatedInfra: InfrastructurePoint) => {
      if (infraPoints.find(i => i.id === updatedInfra.id)) {
          setInfraPoints(prev => prev.map(i => i.id === updatedInfra.id ? updatedInfra : i));
      } else {
          setInfraPoints(prev => [...prev, updatedInfra]);
      }
      setEditingInfra(null);
  };

  const handleCreateInfra = () => {
      setEditingInfra({
          id: `infra-${Date.now()}`,
          name: 'Nouvelle Chambre',
          type: InfrastructureType.CHAMBRE,
          coordinates: { lat: 0, lng: 0 }, 
          parentLiaisonId: currentLiaisonObj.id,
          description: ''
      });
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-7xl h-[95vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        
        {/* TOP HEADER */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded bg-cyan-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </span>
              {isNew ? 'Création de Liaison' : `Édition: ${name}`}
              <span className="text-sm font-normal text-slate-400 ml-2 border-l border-slate-600 pl-2">
                  {status} • {distanceKm} km
              </span>
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT COLUMN: NAVIGATION & STRUCTURE */}
          <div className="w-1/3 bg-slate-900 border-r border-slate-700 flex flex-col overflow-y-auto">
             
             {/* General Config */}
             <div className="p-4 border-b border-slate-800 space-y-3">
                 <h3 className="text-xs font-bold text-blue-400 uppercase">Configuration Liaison</h3>
                 <div>
                    <label className="text-[10px] text-slate-500 uppercase">Nom</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-sm text-white focus:border-cyan-500 outline-none" placeholder="Ex: Backbone Mbalmayo-Ebolowa" />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase">Distance (Km)</label>
                        <input type="number" value={distanceKm} onChange={e => setDistanceKm(parseFloat(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-sm text-white" />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase">Catégorie</label>
                        <select value={category} onChange={e => setCategory(e.target.value as LiaisonCategory)} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-sm text-white">
                            <option value={LiaisonCategory.BACKBONE}>Backbone</option>
                            <option value={LiaisonCategory.LAST_MILE}>Last Mile</option>
                        </select>
                    </div>
                 </div>
             </div>

             {/* SECTION LIST */}
             <div className="flex-1 p-4 space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-teal-400 uppercase">Architecture & Tronçons</h3>
                    <button onClick={() => handleCreateSection()} className="text-[10px] bg-teal-700 hover:bg-teal-600 text-white px-2 py-0.5 rounded">+ Tronçon</button>
                 </div>
                 
                 {/* Virtual "Global" View */}
                 <div 
                    onClick={() => setActiveViewId(null)}
                    className={`p-3 rounded border cursor-pointer transition-colors ${activeViewId === null ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                 >
                     <div className="flex justify-between items-center">
                         <span className="font-bold text-sm text-white">VUE GLOBALE (Bout-en-Bout)</span>
                         <span className="text-[10px] bg-slate-900 px-1 rounded text-slate-400">Théorique</span>
                     </div>
                 </div>

                 {/* Real Sections */}
                 <div className="space-y-2 relative">
                     {sections.map((sec, idx) => {
                         const isActive = activeViewId === sec.id;
                         return (
                            <div key={sec.id} className="relative pl-4 border-l-2 border-slate-700">
                                <div className="absolute -left-[9px] top-4 w-4 h-0.5 bg-slate-700"></div>
                                <div 
                                    onClick={() => setActiveViewId(sec.id)}
                                    className={`p-2 rounded border cursor-pointer group ${isActive ? 'bg-teal-900/20 border-teal-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                                                <span className="text-slate-500 font-mono">#{idx+1}</span>
                                                {sec.name}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                {sec.fiberCount} FO • {sec.cableType} • {sec.lengthKm}km
                                            </div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingSection(sec); }} className="text-slate-500 hover:text-white p-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                         );
                     })}
                 </div>

                 {/* Infrastructure Nodes (Manchons) */}
                 <div className="pt-4 border-t border-slate-800">
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-orange-400 uppercase">Manchons & Épissures</h3>
                        <button onClick={handleCreateInfra} className="text-[10px] bg-orange-700 hover:bg-orange-600 text-white px-2 py-0.5 rounded">+ Infra</button>
                     </div>
                     <div className="space-y-2">
                        {infraPoints.map((infra) => (
                            <div key={infra.id} onClick={() => setEditingInfra(infra)} className="bg-slate-800 p-2 rounded border border-slate-700 hover:border-orange-500 cursor-pointer flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rotate-45 ${infra.category === 'ARTERE' ? 'bg-red-500' : (infra.category === 'SEMI_ARTERE' ? 'bg-orange-500' : 'bg-purple-500')}`}></div>
                                    <div className="text-xs text-slate-300">{infra.name}</div>
                                </div>
                                <span className="text-[9px] bg-slate-900 px-1 rounded text-orange-300">Éditer</span>
                            </div>
                        ))}
                     </div>
                 </div>

             </div>
          </div>

          {/* RIGHT COLUMN: DYNAMIC MATRIX */}
          <div className="flex-1 flex flex-col bg-slate-950 relative">
             <div className="p-4 bg-slate-800/30 border-b border-slate-700 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-slate-200">
                        {activeSection ? `Matrice du Tronçon : ${activeSection.name}` : "Vue Globale (Théorique)"}
                    </h3>
                    <p className="text-xs text-slate-400">
                        {activeFiberCount} Fibres • {tubesCount} Tubes • {activeSection ? activeSection.cableType : 'Vue agrégée'}
                    </p>
                </div>
                {activeSection && (
                    <div className="px-3 py-1 bg-teal-900/30 border border-teal-500/30 text-teal-400 text-xs rounded font-bold animate-pulse">
                        ÉDITION LOCALE
                    </div>
                )}
             </div>
             
             {/* MATRIX CONTENT */}
             <div className="flex-1 overflow-y-auto p-4 space-y-6">
                 {activeStrands.length === 0 && <div className="text-center text-slate-500 py-10">Aucune donnée de fibre pour ce tronçon.</div>}
                 
                 {Array.from({ length: tubesCount }).map((_, tubeIndex) => {
                     const tubeNumber = tubeIndex + 1;
                     const tubeColor = fiberColors[tubeIndex % 12];
                     const fibersInThisTube = activeStrands.filter(s => Math.ceil(s.number / tubeConfig.fibersPerTube) === tubeNumber);

                     if(fibersInThisTube.length === 0) return null;

                     return (
                         <div key={tubeIndex} className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                             {/* Tube Header */}
                             <div className="px-3 py-2 flex items-center gap-3 border-b border-slate-700" style={{ backgroundColor: `${getFiberColorHex(tubeColor)}15` }}>
                                 <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm border border-white/20" style={{ backgroundColor: getFiberColorHex(tubeColor) }}>
                                     T{tubeNumber}
                                 </div>
                                 <div className="text-sm font-bold text-slate-200">Tube {tubeColor}</div>
                                 <div className="text-xs text-slate-500 ml-auto">{fibersInThisTube.length} Brins</div>
                             </div>

                             {/* Fibers List */}
                             <div className="divide-y divide-slate-800">
                                 {fibersInThisTube.map(strand => (
                                     <div key={strand.id} className="grid grid-cols-12 gap-2 p-2 items-center hover:bg-slate-800/50">
                                         {/* Brin Color */}
                                         <div className="col-span-1 flex justify-center">
                                             <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: getFiberColorHex(strand.colorCode) }} title={`Brin ${strand.colorCode}`}></div>
                                         </div>
                                         <div className="col-span-1 text-xs text-slate-500 font-mono text-center">{strand.number}</div>
                                         
                                         {/* Status */}
                                         <div className="col-span-2">
                                             <select 
                                                value={strand.status} 
                                                onChange={(e) => handleStrandChange(strand.id, 'status', e.target.value)}
                                                disabled={!activeSection} // Disable edit in global view (optional safety)
                                                className={`w-full text-[10px] font-bold py-0.5 rounded border bg-transparent ${
                                                    strand.status === 'USE' ? 'text-green-400 border-green-900' : 
                                                    strand.status === 'DISCONTINU' ? 'text-red-400 border-red-900' : 'text-slate-500 border-slate-700'
                                                }`}>
                                                <option value="USE">ACTIF</option>
                                                <option value="CONTINU">LIBRE</option>
                                                <option value="DISCONTINU">COUPÉ</option>
                                             </select>
                                         </div>

                                         {/* Service Name */}
                                         <div className="col-span-4">
                                             <input 
                                                value={strand.serviceName || ''} 
                                                onChange={(e) => handleStrandChange(strand.id, 'serviceName', e.target.value)}
                                                disabled={!activeSection}
                                                placeholder={activeSection ? "Nom du Service..." : "Voir section spécifique"}
                                                className="w-full bg-transparent border-b border-slate-800 focus:border-cyan-500 text-xs text-slate-300 outline-none px-1"
                                             />
                                         </div>

                                          {/* Client */}
                                          <div className="col-span-4">
                                             <input 
                                                value={strand.client || ''} 
                                                onChange={(e) => handleStrandChange(strand.id, 'client', e.target.value)}
                                                disabled={!activeSection}
                                                placeholder="Client..."
                                                className="w-full bg-transparent border-b border-slate-800 focus:border-cyan-500 text-xs text-slate-400 outline-none px-1"
                                             />
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     );
                 })}
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end gap-3 z-20">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">Annuler</button>
          <button onClick={handleSaveLiaison} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-lg">Enregistrer Tout</button>
        </div>

        {/* Sub-Modals - FIX 3: Reordered so TronconEditor is ON TOP of ManchonEditor if triggered from it */}
        {editingInfra && (
            <ManchonEditor 
                infra={editingInfra}
                liaisonContext={currentLiaisonObj} // Pass full context for topology
                onSave={handleSaveInfra} 
                onAddSection={(nodeId) => handleCreateSection(nodeId)} // Callback to create cable
                onClose={() => setEditingInfra(null)} 
            />
        )}
        {editingSection && (
            <TronconEditor 
                section={editingSection} 
                onSave={handleSaveSection} 
                onClose={() => setEditingSection(null)} 
            />
        )}

      </div>
    </div>
  );
};

export default FiberEditor;
