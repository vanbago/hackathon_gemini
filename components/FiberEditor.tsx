
import React, { useState, useEffect } from 'react';
import { Liaison, FiberStrand, InfrastructureType, LiaisonStatus, LiaisonCategory, CableSection, InfrastructurePoint, LiaisonType, Operator, Bts, Ctt } from '../types';
import TronconEditor from './TronconEditor';
import ManchonEditor from './ManchonEditor';
import { generateFibersFromStandard, getFiberStandard, FIBER_STANDARDS, calculateDistance } from '../storageService';

interface FiberEditorProps {
  liaison: Liaison | null; 
  availableNodes: (Bts | Ctt)[]; 
  externalLiaisons?: Liaison[]; 
  onSave: (updatedLiaison: Liaison) => void;
  onClose: () => void;
}

const FiberEditor: React.FC<FiberEditorProps> = ({ liaison: initialLiaison, availableNodes, externalLiaisons, onSave, onClose }) => {
  const isNew = !initialLiaison;
  
  // Base State
  const [name, setName] = useState(initialLiaison?.name || 'Nouvelle Liaison');
  const [distanceKm, setDistanceKm] = useState(initialLiaison?.distanceKm || 0);
  const [status, setStatus] = useState<LiaisonStatus>(initialLiaison?.status || LiaisonStatus.MAINTENANCE);
  const [category, setCategory] = useState<LiaisonCategory>(initialLiaison?.category || LiaisonCategory.LAST_MILE);
  
  // Topology State
  const [sections, setSections] = useState<CableSection[]>(initialLiaison?.sections || []);
  const [infraPoints, setInfraPoints] = useState<InfrastructurePoint[]>(initialLiaison?.infrastructurePoints || []);

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
      controlledByCttId: initialLiaison?.controlledByCttId || 'ctt-mbalmayo', 
      associatedBtsIds: initialLiaison?.associatedBtsIds || []
  };
  
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const activeSection = activeViewId ? sections.find(s => s.id === activeViewId) : null;
  const activeStandard = activeSection ? (getFiberStandard(activeSection.standardId) || FIBER_STANDARDS[0]) : FIBER_STANDARDS[0];
  const activeFiberCount = activeSection ? activeSection.fiberCount : (currentLiaisonObj.fiberCount || 12);
  
  const activeStrands = activeSection 
    ? (activeSection.fiberStrands && activeSection.fiberStrands.length > 0 
        ? activeSection.fiberStrands 
        : generateFibersFromStandard(activeSection.standardId || 'STD_12_1x12')) 
    : (initialLiaison?.fiberStrands || []);

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

  const handleStrandChange = (id: string, field: keyof FiberStrand, value: any) => {
      if (activeSection) {
          const updatedStrands = activeStrands.map(s => s.id === id ? { ...s, [field]: value } : s);
          setSections(prev => prev.map(sec => sec.id === activeSection.id ? { ...sec, fiberStrands: updatedStrands } : sec));
      }
  };

  const handleCreateSection = (startNodeId?: string) => {
      const newSec: CableSection = {
          id: `sec-${Date.now()}`,
          name: startNodeId ? `Nouveau Câble (Départ)` : `Nouveau Tronçon ${sections.length + 1}`,
          fiberCount: 12, 
          cableType: 'Standard Souterrain',
          lengthKm: 0,
          startPointId: startNodeId,
          standardId: 'STD_12_1x12', 
          fiberStrands: generateFibersFromStandard('STD_12_1x12')
      };
      setEditingSection(newSec);
  };

  const handleSaveSection = (updatedSection: CableSection) => {
      let finalSection = updatedSection;
      const existing = sections.find(s => s.id === updatedSection.id);
      
      const standardChanged = updatedSection.standardId !== existing?.standardId;
      const countChanged = updatedSection.fiberCount !== (existing?.fiberCount || 0);

      if (standardChanged || countChanged) {
           finalSection = { 
               ...updatedSection, 
               fiberStrands: generateFibersFromStandard(updatedSection.standardId || 'STD_12_1x12') 
           };
      }

      if (existing) {
          setSections(prev => prev.map(s => s.id === finalSection.id ? finalSection : s));
      } else {
          setSections(prev => [...prev, finalSection]);
      }
      
      if(finalSection.lengthKm) {
          setDistanceKm(prev => prev + (finalSection.lengthKm || 0));
      }

      setEditingSection(null);
  };

  const handleDeleteSection = (sectionId: string) => {
      if(window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce tronçon ?")) {
          setSections(prev => prev.filter(s => s.id !== sectionId));
          if (activeViewId === sectionId) setActiveViewId(null);
          setEditingSection(null);
      }
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

  // --- LOGIQUE DE CRÉATION ET DIVISION DE TRONÇON ---
  const handleSaveInfra = (updatedInfra: InfrastructurePoint, sectionToSplitId?: string) => {
      // 1. Mise à jour ou ajout du point d'infrastructure
      if (infraPoints.find(i => i.id === updatedInfra.id)) {
          setInfraPoints(prev => prev.map(i => i.id === updatedInfra.id ? updatedInfra : i));
      } else {
          setInfraPoints(prev => [...prev, updatedInfra]);
      }

      // 2. Gestion de la Règle de Coupure (Splitting Rule)
      if (sectionToSplitId) {
          const originalSection = sections.find(s => s.id === sectionToSplitId);
          if (originalSection) {
              // Calcul des distances si coordonnées disponibles
              const distFromStart = originalSection.startCoordinate 
                ? calculateDistance(originalSection.startCoordinate.lat, originalSection.startCoordinate.lng, updatedInfra.coordinates.lat, updatedInfra.coordinates.lng)
                : (originalSection.lengthKm || 10) / 2;
              
              const distToEnd = originalSection.endCoordinate
                ? calculateDistance(updatedInfra.coordinates.lat, updatedInfra.coordinates.lng, originalSection.endCoordinate.lat, originalSection.endCoordinate.lng)
                : (originalSection.lengthKm || 10) / 2;

              // SECTION 1: Ancien Début -> Nouveau Manchon
              const section1: CableSection = {
                  ...originalSection,
                  id: `sec-split-1-${Date.now()}`,
                  name: `${originalSection.name} (Part 1)`,
                  lengthKm: parseFloat(distFromStart.toFixed(3)),
                  endPointId: updatedInfra.id,
                  endCoordinate: updatedInfra.coordinates,
                  fiberStrands: generateFibersFromStandard(originalSection.standardId || 'STD_12_1x12') // Réinitialisation propre
              };

              // SECTION 2: Nouveau Manchon -> Ancienne Fin
              const section2: CableSection = {
                  ...originalSection,
                  id: `sec-split-2-${Date.now()}`,
                  name: `${originalSection.name} (Part 2)`,
                  lengthKm: parseFloat(distToEnd.toFixed(3)),
                  startPointId: updatedInfra.id,
                  startCoordinate: updatedInfra.coordinates,
                  fiberStrands: generateFibersFromStandard(originalSection.standardId || 'STD_12_1x12')
              };

              // On remplace l'ancien tronçon par les 2 nouveaux
              setSections(prev => {
                  const filtered = prev.filter(s => s.id !== sectionToSplitId);
                  return [...filtered, section1, section2];
              });
          }
      }

      setEditingInfra(null);
  };

  // --- LOGIQUE DE SUPPRESSION EN CASCADE ---
  const handleDeleteInfra = (infraId: string) => {
      if(window.confirm("ATTENTION : Supprimer ce manchon supprimera également tous les tronçons de câble qui y sont connectés. Continuer ?")) {
          // 1. Supprimer le point d'infra
          setInfraPoints(prev => prev.filter(i => i.id !== infraId));
          
          // 2. Supprimer automatiquement les tronçons connectés (Start OR End == infraId)
          setSections(prev => prev.filter(s => s.startPointId !== infraId && s.endPointId !== infraId));
          
          // 3. Reset l'édition si ouvert
          if (editingInfra?.id === infraId) {
             setEditingInfra(null);
          }
          
          // 4. Si une vue active portait sur un tronçon supprimé, on reset
          if (activeViewId) {
             const associatedSection = sections.find(s => s.id === activeViewId);
             if (associatedSection && (associatedSection.startPointId === infraId || associatedSection.endPointId === infraId)) {
                 setActiveViewId(null);
             }
          }
      }
  };

  const handleSaveLiaison = () => {
    let finalStart = currentLiaisonObj.startCoordinates;
    let finalEnd = currentLiaisonObj.endCoordinates;
    
    // --- CORRECTION CRITIQUE : ACCÈS SÉCURISÉ ---
    if (sections && sections.length > 0) {
         const firstSec = sections[0];
         // On accède au dernier élément de manière sûre
         const lastSec = sections[sections.length - 1];

         if (firstSec && firstSec.startCoordinate) {
             finalStart = firstSec.startCoordinate;
         }
         
         // Vérification stricte avant d'accéder à endCoordinate
         if (lastSec && lastSec.endCoordinate) {
             finalEnd = lastSec.endCoordinate;
         }
    }
    
    const totalDist = sections.reduce((acc, sec) => acc + (sec.lengthKm || 0), 0);

    onSave({
        ...currentLiaisonObj,
        startCoordinates: finalStart,
        endCoordinates: finalEnd,
        distanceKm: totalDist > 0 ? parseFloat(totalDist.toFixed(3)) : distanceKm
    });
  };
  
  const getTubeHeaderColor = (idx: number) => {
      if(!activeSection) return 'bg-slate-700'; 
      const colorName = activeStandard.colors[idx % activeStandard.colors.length];
      return getFiberColorHex(colorName);
  };
  
  const getTubeColor = (idx: number) => {
      const color = activeStandard.colors[idx % activeStandard.colors.length];
      return getFiberColorHex(color);
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
                  {status} • {distanceKm.toFixed(3)} km
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
                        <label className="text-[10px] text-slate-500 uppercase">Distance Totale (Km)</label>
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
                                    className={`p-2 rounded border cursor-pointer group flex justify-between items-start ${isActive ? 'bg-teal-900/20 border-teal-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div>
                                        <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                                            <span className="text-slate-500 font-mono">#{idx+1}</span>
                                            {sec.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-1 flex gap-2">
                                            <span>{sec.fiberCount} FO</span>
                                            {sec.colorScheme === 'SPECIAL_MENGWA' && <span className="text-purple-400 font-bold bg-purple-900/30 px-1 rounded">Spécial</span>}
                                            <span>{sec.lengthKm}km</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setEditingSection(sec); }} className="text-slate-500 hover:text-white p-1" title="Modifier">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteSection(sec.id); }} className="text-slate-500 hover:text-red-500 p-1" title="Supprimer">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                            <div key={infra.id} onClick={() => setEditingInfra(infra)} className="bg-slate-800 p-2 rounded border border-slate-700 hover:border-orange-500 cursor-pointer flex justify-between items-center group relative">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rotate-45 ${infra.category === 'ARTERE' ? 'bg-red-500' : (infra.category === 'SEMI_ARTERE' ? 'bg-orange-500' : 'bg-purple-500')}`}></div>
                                    <div className="text-xs text-slate-300">{infra.name}</div>
                                </div>
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteInfra(infra.id); }} className="text-slate-500 hover:text-red-500 p-1 z-10" title="Supprimer ce manchon et ses liens">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
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
                    <div className="text-xs text-slate-400 flex gap-2 items-center">
                        {activeSection ? (
                            <span>{activeSection.fiberCount} FO • Standard: {activeStandard.name}</span>
                        ) : (
                            <span>Vue agrégée (Lecture Seule)</span>
                        )}
                    </div>
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
                 
                 {activeSection ? (
                     Array.from({ length: activeStandard.tubes }).map((_, tubeIndex) => {
                         const tubeNumber = tubeIndex + 1;
                         const fibersPerTube = activeStandard.fibersPerTube;
                         const tubeColor = activeStandard.colors[tubeIndex % activeStandard.colors.length];
                         const fibersInThisTube = activeStrands.filter(s => Math.ceil(s.number / fibersPerTube) === tubeNumber);
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
                                 <div className="divide-y divide-slate-800">
                                     {fibersInThisTube.map(strand => (
                                         <div key={strand.id} className="grid grid-cols-12 gap-2 p-2 items-center hover:bg-slate-800/50">
                                             <div className="col-span-1 flex justify-center"><div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: getFiberColorHex(strand.colorCode) }} title={`Brin ${strand.colorCode}`}></div></div>
                                             <div className="col-span-1 text-xs text-slate-500 font-mono text-center">{strand.number}</div>
                                             <div className="col-span-2">
                                                 <select value={strand.status} onChange={(e) => handleStrandChange(strand.id, 'status', e.target.value)} className={`w-full text-[10px] font-bold py-0.5 rounded border bg-transparent ${strand.status === 'USE' ? 'text-green-400 border-green-900' : strand.status === 'DISCONTINU' ? 'text-red-400 border-red-900' : 'text-slate-500 border-slate-700'}`}>
                                                    <option value="USE">ACTIF</option><option value="CONTINU">LIBRE</option><option value="DISCONTINU">COUPÉ</option>
                                                 </select>
                                             </div>
                                             <div className="col-span-4"><input value={strand.serviceName || ''} onChange={(e) => handleStrandChange(strand.id, 'serviceName', e.target.value)} placeholder={activeSection ? "Nom du Service..." : "Voir section spécifique"} className="w-full bg-transparent border-b border-slate-800 focus:border-cyan-500 text-xs text-slate-300 outline-none px-1" /></div>
                                              <div className="col-span-4"><input value={strand.client || ''} onChange={(e) => handleStrandChange(strand.id, 'client', e.target.value)} placeholder="Client..." className="w-full bg-transparent border-b border-slate-800 focus:border-cyan-500 text-xs text-slate-400 outline-none px-1" /></div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         );
                     })
                 ) : (
                     <div className="bg-slate-900 p-4 rounded text-center text-slate-500 italic">Sélectionnez un tronçon pour éditer la matrice.</div>
                 )}
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end gap-3 z-20">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">Annuler</button>
          <button onClick={handleSaveLiaison} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-lg">Enregistrer Tout</button>
        </div>

        {/* Sub-Modals */}
        {editingInfra && (
            <ManchonEditor 
                infra={editingInfra}
                liaisonContext={currentLiaisonObj} 
                availableNodes={availableNodes} 
                externalLiaisons={externalLiaisons} 
                onSave={handleSaveInfra}
                onDelete={() => handleDeleteInfra(editingInfra.id)} 
                onAddSection={(nodeId) => handleCreateSection(nodeId)}
                onClose={() => setEditingInfra(null)} 
            />
        )}
        {editingSection && (
            <TronconEditor 
                section={editingSection} 
                availableNodes={availableNodes}
                onSave={handleSaveSection} 
                onDelete={() => handleDeleteSection(editingSection.id)}
                onClose={() => setEditingSection(null)} 
            />
        )}

      </div>
    </div>
  );
};

export default FiberEditor;
