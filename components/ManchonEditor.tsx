
import React, { useState, useEffect, useMemo } from 'react';
import { InfrastructurePoint, InfrastructureType, InfrastructureCategory, Liaison, CableSection, FiberStrand, SplicingConnection, Bts, Ctt } from '../types';
import { getFiberStandard, FIBER_STANDARDS, generateFibersFromStandard, calculateDistance } from '../storageService';

interface ManchonEditorProps {
  infra: InfrastructurePoint;
  liaisonContext: Liaison; 
  availableNodes?: (Bts | Ctt)[]; 
  externalLiaisons?: Liaison[]; 
  onSave: (updatedInfra: InfrastructurePoint, sectionToSplitId?: string) => void;
  onDelete?: () => void;
  onAddSection: (startNodeId: string) => void; 
  onClose: () => void;
}

const ManchonEditor: React.FC<ManchonEditorProps> = ({ infra, liaisonContext, availableNodes = [], externalLiaisons, onSave, onDelete, onAddSection, onClose }) => {
  const [name, setName] = useState(infra.name);
  const [activeTab, setActiveTab] = useState<'INFO' | 'SPLICING'>('SPLICING');
  
  // Info Data
  const [type, setType] = useState<InfrastructureType>(infra.type);
  const [category, setCategory] = useState<InfrastructureCategory>(infra.category || InfrastructureCategory.STANDARD);
  const [description, setDescription] = useState(infra.description || '');
  
  // Coordinates editing
  const [lat, setLat] = useState(infra.coordinates.lat);
  const [lng, setLng] = useState(infra.coordinates.lng);

  // Splitting Logic State
  const [sectionToSplitId, setSectionToSplitId] = useState<string>('');

  // Splicing Data
  const [connections, setConnections] = useState<SplicingConnection[]>(infra.splicingConfig?.connections || []);

  // UI State for Splicing
  const [selectedIncomingStrand, setSelectedIncomingStrand] = useState<string | null>(null);
  
  // --- COLOR UTILS ---
  const getFiberColorHex = (colorName: string) => {
    const map: Record<string, string> = {
      'Bleu': '#3b82f6', 'Orange': '#f97316', 'Vert': '#22c55e', 'Marron': '#854d0e',
      'Gris': '#94a3b8', 'Blanc': '#f8fafc', 'Rouge': '#ef4444', 'Noir': '#000000',
      'Jaune': '#eab308', 'Violet': '#a855f7', 'Rose': '#ec4899', 'Aqua': '#06b6d4'
    };
    return map[colorName] || '#fff';
  };

  // --- TOPOLOGY LOGIC REFACTOR ---
  
  const connectedSections = useMemo(() => {
      const localSections = liaisonContext?.sections?.filter(s => s.startPointId === infra.id || s.endPointId === infra.id) || [];
      const remoteSections: CableSection[] = [];
      if (externalLiaisons) {
          externalLiaisons.forEach(l => {
              if (l.id === liaisonContext.id) return; 
              l.sections?.forEach(s => {
                  if (s.startPointId === infra.id || s.endPointId === infra.id) {
                      remoteSections.push({ ...s, name: `${s.name} [${l.name}]` });
                  }
              });
          });
      }
      return [...localSections, ...remoteSections];
  }, [liaisonContext, infra.id, externalLiaisons]);

  const getEffectiveStrands = (section: CableSection): FiberStrand[] => {
      if (section.fiberStrands && section.fiberStrands.length === section.fiberCount) {
          return section.fiberStrands;
      }
      return generateFibersFromStandard(section.standardId || 'STD_12_1x12');
  };

  const [incomingSectionId, setIncomingSectionId] = useState<string>('');

  useEffect(() => {
      const currentExists = connectedSections.find(s => s.id === incomingSectionId);
      if (connectedSections.length > 0 && (!incomingSectionId || !currentExists)) {
          const scoredSections = connectedSections.map(sec => {
              let score = 0;
              const strands = getEffectiveStrands(sec);
              const otherNodeId = sec.startPointId === infra.id ? sec.endPointId : sec.startPointId;
              const otherNode = availableNodes.find(n => n.id === otherNodeId);
              const activeServicesCount = strands.filter(f => f.serviceName && f.serviceName.length > 0).length || 0;
              score += (activeServicesCount * 5); 
              if (otherNode?.id.includes('ctt')) score += 50; 
              if (sec.endPointId === infra.id) score += 10;
              score += (sec.fiberCount / 10); 
              return { id: sec.id, score, services: activeServicesCount };
          });
          scoredSections.sort((a, b) => b.score - a.score);
          if(scoredSections.length > 0) {
              setIncomingSectionId(scoredSections[0].id);
          }
      }
  }, [connectedSections, infra.id, availableNodes]); 

  const incomingSection = connectedSections.find(s => s.id === incomingSectionId) || null;
  const outgoingSections = connectedSections.filter(s => s.id !== incomingSectionId);
  const [activeOutgoingTabId, setActiveOutgoingTabId] = useState<string | null>(null);

  useEffect(() => {
      if (outgoingSections.length > 0 && (!activeOutgoingTabId || !outgoingSections.find(s => s.id === activeOutgoingTabId))) {
          setActiveOutgoingTabId(outgoingSections[0].id);
      }
  }, [outgoingSections, activeOutgoingTabId]);

  const handleSave = () => {
    // If splitting is selected but user didn't select a section, warn or ignore? Assuming logic handles it.
    onSave({
        ...infra,
        name,
        type,
        category,
        description,
        coordinates: { lat, lng },
        splicingConfig: {
            connections
        }
    }, sectionToSplitId || undefined);
  };

  const getCableOriginName = (sec: CableSection) => {
      const originId = sec.startPointId === infra.id ? sec.endPointId : sec.startPointId;
      if (!originId) return 'Inconnu';
      const node = availableNodes.find(n => n.id === originId);
      if (node) return node.name;
      const infraPoint = liaisonContext.infrastructurePoints?.find(p => p.id === originId);
      if (infraPoint) return infraPoint.name;
      return 'Point Distant';
  };

  const handleIncomingClick = (strandId: string) => {
      setSelectedIncomingStrand(prev => prev === strandId ? null : strandId);
  };

  const handleIncomingSectionChange = (val: string) => {
      if (val === '__NEW__') {
          onAddSection(infra.id); 
      } else {
          setIncomingSectionId(val);
      }
  };

  const handleOutgoingClick = (outgoingStrandId: string) => {
      if (!selectedIncomingStrand) return;
      const existingIndex = connections.findIndex(c => c.incomingStrandId === selectedIncomingStrand);
      let newConnections = [...connections];
      if (existingIndex !== -1) {
          if (connections[existingIndex].outgoingStrandId === outgoingStrandId) {
              newConnections.splice(existingIndex, 1);
          } else {
              newConnections[existingIndex] = {
                  incomingStrandId: selectedIncomingStrand,
                  outgoingStrandId: outgoingStrandId,
                  status: 'SPLICED'
              };
          }
      } else {
          newConnections.push({
              incomingStrandId: selectedIncomingStrand,
              outgoingStrandId: outgoingStrandId,
              status: 'SPLICED'
          });
      }
      setConnections(newConnections);
      setSelectedIncomingStrand(null);
  };

  const isConnected = (incomingId: string) => connections.some(c => c.incomingStrandId === incomingId);
  
  const autoSplice = () => {
      if (!incomingSection) return;
      const targetSection = outgoingSections.find(s => s.id === activeOutgoingTabId);
      if (!targetSection) return;
      const incomingStrands = getEffectiveStrands(incomingSection);
      const targetStrands = getEffectiveStrands(targetSection);
      const newConns = [...connections];
      const count = Math.min(incomingStrands.length, targetStrands.length);
      for(let i=0; i<count; i++) {
          const incId = incomingStrands[i].id;
          const outId = targetStrands[i].id;
          if (!newConns.find(c => c.incomingStrandId === incId)) {
               newConns.push({ incomingStrandId: incId, outgoingStrandId: outId, status: 'SPLICED' });
          }
      }
      setConnections(newConns);
  };
  
  const getStrandInfo = (strandId: string) => {
      for(const sec of connectedSections) {
          const strands = getEffectiveStrands(sec);
          const found = strands.find(f => f.id === strandId);
          if(found) return { section: sec, strand: found };
      }
      return null;
  };

  // --- RENDER LOGIC ---
  const renderStrandList = (strands: FiberStrand[], section: CableSection | undefined | null, side: 'LEFT' | 'RIGHT') => {
      if (!section || strands.length === 0) return null;
      const standard = getFiberStandard(section.standardId) || FIBER_STANDARDS[0];
      const fibersPerTube = standard.fibersPerTube;
      const isMultiTube = standard.tubes > 1;

      return Array.from({ length: standard.tubes }).map((_, tubeIdx) => {
          const tubeNum = tubeIdx + 1;
          const tubeColor = standard.colors[tubeIdx % standard.colors.length];
          const tubeStrands = strands.filter(s => Math.ceil(s.number / fibersPerTube) === tubeNum);
          if (tubeStrands.length === 0) return null;

          return (
              <div key={tubeNum} className="mb-3">
                  {isMultiTube && (
                      <div className={`text-[10px] font-bold uppercase mb-1 px-2 py-0.5 rounded flex items-center gap-2 ${side === 'LEFT' ? 'bg-slate-800 text-slate-400' : 'bg-slate-800 text-slate-400 justify-end'}`}>
                          {side === 'LEFT' && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getFiberColorHex(tubeColor) }}></div>}
                          <span>Tube {tubeNum} ({tubeColor})</span>
                          {side === 'RIGHT' && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getFiberColorHex(tubeColor) }}></div>}
                      </div>
                  )}
                  <div className="space-y-1">
                      {tubeStrands.map(strand => {
                          if (side === 'LEFT') {
                              const connected = isConnected(strand.id);
                              const isSelected = selectedIncomingStrand === strand.id;
                              const hasService = strand.serviceName && strand.serviceName.length > 0;
                              return (
                                  <div 
                                      key={strand.id} 
                                      onClick={() => handleIncomingClick(strand.id)}
                                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all border ${
                                          isSelected 
                                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg scale-[1.02]' 
                                          : connected ? 'bg-slate-800 border-slate-700 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                                      }`}
                                  >
                                      <div className="flex items-center gap-2 overflow-hidden">
                                          <div className="w-3 h-3 rounded-full border border-white/20 shadow-sm shrink-0" style={{ backgroundColor: getFiberColorHex(strand.colorCode) }}></div>
                                          <span className="text-xs font-mono opacity-70 w-6 text-center shrink-0">{strand.number}</span>
                                          <div className="flex flex-col overflow-hidden">
                                              <span className={`text-xs truncate font-medium ${hasService ? 'text-white font-bold' : 'text-slate-500'}`}>
                                                  {hasService ? strand.serviceName : 'Libre / Réserve'}
                                              </span>
                                          </div>
                                      </div>
                                      {connected && <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                  </div>
                              );
                          } else {
                              const incomingSourceId = connections.find(c => c.outgoingStrandId === strand.id)?.incomingStrandId;
                              const isConnected = !!incomingSourceId;
                              const isMatch = selectedIncomingStrand && incomingSourceId === selectedIncomingStrand;
                              return (
                                  <div 
                                      key={strand.id} 
                                      onClick={() => handleOutgoingClick(strand.id)}
                                      className={`flex items-center justify-between p-2 mb-1 rounded cursor-pointer transition-all border flex-row-reverse ${
                                          isMatch
                                          ? 'bg-teal-600 border-teal-400 text-white shadow-lg scale-[1.02]'
                                          : isConnected ? 'bg-slate-800 border-slate-700 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                                      }`}
                                  >
                                      <div className="flex items-center gap-2 flex-row-reverse">
                                          <div className="w-3 h-3 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: getFiberColorHex(strand.colorCode) }}></div>
                                          <span className="text-xs font-mono opacity-70 w-6 text-center">{strand.number}</span>
                                          <span className="text-xs truncate max-w-[150px] text-right font-medium">{strand.serviceName || 'Brin Libre'}</span>
                                      </div>
                                      <div className={`w-3 h-3 rounded-full border-2 ${isConnected ? 'bg-green-500 border-green-700' : 'bg-transparent border-slate-600'}`}></div>
                                  </div>
                              );
                          }
                      })}
                  </div>
              </div>
          );
      });
  };

  const isSemiArtereInvalid = category === InfrastructureCategory.SEMI_ARTERE && outgoingSections.length < 2;
  const incomingStrandsList = incomingSection ? getEffectiveStrands(incomingSection) : [];
  const activeOutgoingSection = outgoingSections.find(s => s.id === activeOutgoingTabId);
  const activeOutgoingStrandsList = activeOutgoingSection ? getEffectiveStrands(activeOutgoingSection) : [];

  return (
    <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-600 w-full max-w-6xl h-[90vh] rounded-xl shadow-2xl flex flex-col">
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800 rounded-t-xl shrink-0">
             <div className="flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-lg flex items-center justify-center border-2 shadow-lg ${
                     category === InfrastructureCategory.ARTERE ? 'bg-red-600 border-yellow-400' :
                     category === InfrastructureCategory.SEMI_ARTERE ? 'bg-orange-600 border-white' :
                     'bg-purple-600 border-slate-500'
                 }`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                 </div>
                 <div>
                     <h3 className="font-bold text-white text-xl flex items-center gap-2">
                         {name}
                         <span className="text-[10px] bg-slate-900 border border-slate-600 px-2 py-0.5 rounded text-slate-300 uppercase">{category.replace('_', ' ')}</span>
                     </h3>
                     <p className="text-xs text-slate-400">
                         {incomingSection ? (
                             <span className="flex items-center gap-1 text-blue-300">Source: {incomingSection.name}</span>
                         ) : 'Non raccordé'} 
                         <span className="mx-2">•</span> 
                         {outgoingSections.length} Départ(s)
                     </p>
                 </div>
             </div>
             <div className="flex bg-slate-900 rounded p-1 border border-slate-700">
                 <button onClick={() => setActiveTab('SPLICING')} className={`px-6 py-2 text-xs font-bold rounded transition-all ${activeTab === 'SPLICING' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>CASSETTE / ÉPISSURES</button>
                 <button onClick={() => setActiveTab('INFO')} className={`px-6 py-2 text-xs font-bold rounded transition-all ${activeTab === 'INFO' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>CONFIGURATION INFRA</button>
             </div>
        </div>

        <div className="flex-1 overflow-hidden p-0 bg-slate-950 flex flex-col min-h-0">
            {isSemiArtereInvalid && (
                <div className="bg-orange-900/50 border-b border-orange-500/50 p-2 text-center text-xs text-orange-200 font-bold flex items-center justify-center gap-2 animate-pulse shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Configuration Semi-Artère Incomplète
                </div>
            )}

            {activeTab === 'SPLICING' && (
                <div className="flex-1 flex flex-col min-h-0">
                     <div className="bg-slate-800/50 p-2 border-b border-slate-700 flex justify-between items-center px-6 shrink-0">
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Sélectionnez un brin Entrant (Gauche), puis une destination (Droite).
                        </div>
                        <div className="flex gap-2">
                            <button onClick={autoSplice} className="text-xs bg-teal-900/40 hover:bg-teal-800 text-teal-200 px-3 py-1 rounded border border-teal-700 flex items-center gap-1">Auto-Splice (1-1)</button>
                             <button onClick={() => setConnections([])} className="text-xs bg-red-900/40 hover:bg-red-800 text-red-200 px-3 py-1 rounded border border-red-700">Reset</button>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* LEFT: INCOMING CABLE */}
                        <div className="w-1/3 overflow-y-auto border-r border-slate-700 bg-slate-900/30 custom-scrollbar flex flex-col">
                            <div className="sticky top-0 bg-slate-900 p-3 border-b border-slate-700 z-10 shadow-md">
                                <div className="text-[10px] uppercase font-bold text-blue-500 mb-2">Câble Arrivée (Source)</div>
                                <select 
                                    value={incomingSectionId} 
                                    onChange={(e) => handleIncomingSectionChange(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-xs text-white font-bold focus:border-blue-500 outline-none mb-1"
                                >
                                    <option value="" disabled>-- Choisir Câble --</option>
                                    {connectedSections.map(s => {
                                        const count = s.fiberStrands?.filter(f=>f.serviceName).length || 0;
                                        return <option key={s.id} value={s.id}>{s.name} ({count} Services)</option>;
                                    })}
                                    <option value="__NEW__" className="text-green-400 font-bold bg-slate-700">++ Créer Nouveau Câble ++</option>
                                </select>
                            </div>
                            <div className="p-2">
                                {renderStrandList(incomingStrandsList, incomingSection, 'LEFT')}
                            </div>
                        </div>

                        {/* CENTER: SPLICE TRAY */}
                        <div className="w-20 bg-slate-950 flex flex-col items-center justify-center relative border-r border-slate-700 shadow-inner shrink-0">
                            <div className="-rotate-90 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase whitespace-nowrap mb-8">Cassette</div>
                            <div className="space-y-4">
                                <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-lg"><svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></div>
                                <div className="w-0.5 h-16 bg-slate-800 mx-auto"></div>
                                <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-lg"><svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></div>
                            </div>
                        </div>

                        {/* RIGHT: OUTGOING CABLES (TABS) */}
                        <div className="flex-1 flex flex-col bg-slate-900/30">
                            <div className="flex overflow-x-auto bg-slate-900 border-b border-slate-700 no-scrollbar shrink-0">
                                {outgoingSections.map((sec) => (
                                    <button
                                        key={sec.id}
                                        onClick={() => setActiveOutgoingTabId(sec.id)}
                                        className={`px-4 py-3 text-xs font-bold border-r border-slate-700 whitespace-nowrap flex items-center gap-2 transition-colors ${activeOutgoingTabId === sec.id ? 'bg-slate-800 text-teal-400 border-b-2 border-b-teal-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-teal-500"></div>{sec.name}
                                    </button>
                                ))}
                                <button onClick={() => onAddSection(infra.id)} className="px-4 py-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-1 border-r border-slate-700 transition-colors">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Nouveau
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar relative">
                                {outgoingSections.length === 0 && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-6 text-center"><p className="text-sm font-bold">Aucun câble de départ.</p></div>
                                )}
                                {renderStrandList(activeOutgoingStrandsList, activeOutgoingSection, 'RIGHT')}
                            </div>
                        </div>
                    </div>
                    {/* Plan de Boîte Summary... (Existing Code) */}
                    <div className="h-40 bg-slate-900 border-t border-slate-700 shrink-0 flex flex-col">
                        <div className="bg-slate-800 p-2 px-4 border-b border-slate-700 flex justify-between items-center">
                             <div className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2">Plan de Boîte ({connections.length})</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-2">
                                {connections.map((conn, idx) => {
                                    const source = getStrandInfo(conn.incomingStrandId);
                                    const dest = getStrandInfo(conn.outgoingStrandId);
                                    if(!source || !dest) return null;
                                    return (
                                        <div key={idx} className="bg-slate-800/50 p-2 rounded border border-slate-700 flex justify-between items-center text-[10px]">
                                            <div className="flex items-center gap-2 flex-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: getFiberColorHex(source.strand.colorCode) }}></div><span className="font-bold text-slate-300 truncate w-16">{source.section.name}</span></div>
                                            <div className="px-2 text-slate-600">⟷</div>
                                            <div className="flex items-center gap-2 flex-1 justify-end"><span className="font-bold text-slate-300 truncate w-16 text-right">{dest.section.name}</span><div className="w-2 h-2 rounded-full" style={{ backgroundColor: getFiberColorHex(dest.strand.colorCode) }}></div></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'INFO' && (
                <div className="p-8 max-w-2xl mx-auto space-y-6 animate-fadeIn">
                     <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nom du Manchon/Chambre</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Type Physique</label>
                            <select value={type} onChange={e => setType(e.target.value as InfrastructureType)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white outline-none">
                                {Object.values(InfrastructureType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                             <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Catégorie Topologie</label>
                             <select value={category} onChange={e => setCategory(e.target.value as InfrastructureCategory)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white outline-none">
                                {Object.values(InfrastructureCategory).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {/* SPLIT SECTION LOGIC UI */}
                    <div className="bg-slate-800/80 p-4 rounded border border-slate-700 border-l-4 border-l-teal-500">
                        <label className="block text-xs font-bold text-teal-400 uppercase mb-2 flex items-center gap-2">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>
                             Division de Tronçon Existant (Optionnel)
                        </label>
                        <p className="text-[10px] text-slate-400 mb-2">
                            Si ce manchon est posé en coupure sur un câble existant, sélectionnez-le ici. Cela divisera automatiquement le câble en 2 tronçons distincts.
                        </p>
                        <select 
                            value={sectionToSplitId} 
                            onChange={e => setSectionToSplitId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white outline-none"
                        >
                            <option value="">-- Ne pas diviser (Nouveau Point Isolé) --</option>
                            {liaisonContext.sections?.map(s => (
                                <option key={s.id} value={s.id}>Couper: {s.name} ({s.lengthKm} km)</option>
                            ))}
                        </select>
                        {sectionToSplitId && (
                            <div className="mt-2 text-[10px] text-teal-300 font-bold bg-teal-900/20 p-2 rounded">
                                ℹ️ Le tronçon sera coupé en deux segments. Le début du 1er restera l'ancien début, la fin sera ce manchon. Le 2ème partira de ce manchon vers l'ancienne fin.
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Coordonnées GPS</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500">Latitude</label>
                                <input type="number" step="0.000001" value={lat} onChange={e => setLat(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" />
                            </div>
                             <div>
                                <label className="text-[10px] text-slate-500">Longitude</label>
                                <input type="number" step="0.000001" value={lng} onChange={e => setLng(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        
        {/* FOOTER */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between gap-3 rounded-b-xl shrink-0">
             {onDelete && <button onClick={onDelete} type="button" className="px-4 py-2 bg-red-900/40 text-red-500 hover:text-white border border-red-900/50 rounded text-xs font-bold">Supprimer</button>}
             <div className="flex gap-3 ml-auto">
                 <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Fermer</button>
                 <button onClick={handleSave} className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded text-sm font-bold shadow-lg">Enregistrer & Appliquer</button>
             </div>
        </div>
      </div>
    </div>
  );
};

export default ManchonEditor;
