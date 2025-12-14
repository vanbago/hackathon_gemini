
import React, { useState, useEffect, useMemo } from 'react';
import { InfrastructurePoint, InfrastructureType, InfrastructureCategory, Liaison, CableSection, FiberStrand, SplicingConnection, Bts, Ctt } from '../types';

interface ManchonEditorProps {
  infra: InfrastructurePoint;
  liaisonContext: Liaison; 
  availableNodes?: (Bts | Ctt)[]; 
  externalLiaisons?: Liaison[]; // NEW: All other liaisons
  onSave: (updatedInfra: InfrastructurePoint) => void;
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

  // Splicing Data
  const [connections, setConnections] = useState<SplicingConnection[]>(infra.splicingConfig?.connections || []);

  // UI State for Splicing
  const [selectedIncomingStrand, setSelectedIncomingStrand] = useState<string | null>(null);
  
  // --- TOPOLOGY LOGIC REFACTOR ---
  
  // 1. Find ALL sections connected to this infrastructure point (Start or End)
  const connectedSections = useMemo(() => {
      // 1. Current Liaison Sections (Local State)
      const localSections = liaisonContext?.sections?.filter(s => s.startPointId === infra.id || s.endPointId === infra.id) || [];

      // 2. External Liaison Sections (Global State)
      const remoteSections: CableSection[] = [];
      if (externalLiaisons) {
          externalLiaisons.forEach(l => {
              if (l.id === liaisonContext.id) return; // Skip self
              l.sections?.forEach(s => {
                  if (s.startPointId === infra.id || s.endPointId === infra.id) {
                      // Clone and tag name for clarity
                      remoteSections.push({
                          ...s,
                          name: `${s.name} [${l.name}]` // Visual Hint
                      });
                  }
              });
          });
      }

      // Combine and filter duplicates if any (though ID check prevents self)
      return [...localSections, ...remoteSections];
  }, [liaisonContext, infra.id, externalLiaisons]);

  // 2. State to manually select which section is "Incoming" (Source)
  const [incomingSectionId, setIncomingSectionId] = useState<string>('');

  // 3. IMPROVED Auto-detect default incoming on load using SCORING based on SERVICES
  useEffect(() => {
      // Only run auto-detect if we haven't selected one yet, or if the current selection is invalid
      const currentExists = connectedSections.find(s => s.id === incomingSectionId);
      
      if (connectedSections.length > 0 && (!incomingSectionId || !currentExists)) {
          
          // SCORING LOGIC to find the best candidate for "Source"
          const scoredSections = connectedSections.map(sec => {
              let score = 0;
              
              // Identify the other endpoint of the cable
              const otherNodeId = sec.startPointId === infra.id ? sec.endPointId : sec.startPointId;
              const otherNode = availableNodes.find(n => n.id === otherNodeId);

              // 1. SERVICE CONTENT (Critère Principal demandé)
              // Compter le nombre de brins qui portent un service (Nom ou Client défini)
              const activeServicesCount = sec.fiberStrands?.filter(f => f.serviceName && f.serviceName.length > 0).length || 0;
              score += (activeServicesCount * 5); // +5 points par service actif transporté

              // 2. Network Hierarchy (From CTT)
              if (otherNode?.id.includes('ctt')) score += 50; // Huge weight for CTT source

              // 3. Topology Direction: Does this section physically END at this infra? (Convention: Start -> End)
              if (sec.endPointId === infra.id) score += 10;

              // 4. Fiber Count: Higher count usually implies upstream/backbone
              score += (sec.fiberCount / 10); 

              return { id: sec.id, score, services: activeServicesCount };
          });

          // Sort by score descending
          scoredSections.sort((a, b) => b.score - a.score);
          
          // Select winner automatically
          if(scoredSections.length > 0) {
              setIncomingSectionId(scoredSections[0].id);
          }
      }
  }, [connectedSections, infra.id, availableNodes]); 

  // 4. Derived Lists based on selection
  const incomingSection = connectedSections.find(s => s.id === incomingSectionId) || null;
  // All other connected sections are treated as "Outgoing" (Destination)
  const outgoingSections = connectedSections.filter(s => s.id !== incomingSectionId);
  
  const [activeOutgoingTabId, setActiveOutgoingTabId] = useState<string | null>(null);

  // Set default active tab for outgoing
  useEffect(() => {
      if (outgoingSections.length > 0 && (!activeOutgoingTabId || !outgoingSections.find(s => s.id === activeOutgoingTabId))) {
          setActiveOutgoingTabId(outgoingSections[0].id);
      }
  }, [outgoingSections, activeOutgoingTabId]);

  const handleSave = () => {
    onSave({
        ...infra,
        name,
        type,
        category,
        description,
        splicingConfig: {
            connections
        }
    });
  };

  const getFiberColorHex = (colorName: string) => {
    const map: Record<string, string> = {
      'Bleu': '#3b82f6', 'Orange': '#f97316', 'Vert': '#22c55e', 'Marron': '#854d0e',
      'Gris': '#94a3b8', 'Blanc': '#f8fafc', 'Rouge': '#ef4444', 'Noir': '#000000',
      'Jaune': '#eab308', 'Violet': '#a855f7', 'Rose': '#ec4899', 'Aqua': '#06b6d4'
    };
    return map[colorName] || '#fff';
  };

  // Helper to get friendly name of cable origin
  const getCableOriginName = (sec: CableSection) => {
      const originId = sec.startPointId === infra.id ? sec.endPointId : sec.startPointId;
      if (!originId) return 'Inconnu';
      
      const node = availableNodes.find(n => n.id === originId);
      if (node) return node.name;
      
      const infraPoint = liaisonContext.infrastructurePoints?.find(p => p.id === originId);
      if (infraPoint) return infraPoint.name;

      return 'Point Distant';
  };

  // --- SPLICING LOGIC ---

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
      if (!incomingSection?.fiberStrands) return;
      const targetSection = outgoingSections.find(s => s.id === activeOutgoingTabId);
      if (!targetSection?.fiberStrands) return;

      const newConns = [...connections];
      const count = Math.min(incomingSection.fiberStrands.length, targetSection.fiberStrands.length);
      
      for(let i=0; i<count; i++) {
          const incId = incomingSection.fiberStrands[i].id;
          const outId = targetSection.fiberStrands[i].id;
          
          if (!newConns.find(c => c.incomingStrandId === incId)) {
               newConns.push({ incomingStrandId: incId, outgoingStrandId: outId, status: 'SPLICED' });
          }
      }
      setConnections(newConns);
  };
  
  // NEW: Helper to find cable info from strand ID
  const getStrandInfo = (strandId: string) => {
      for(const sec of connectedSections) {
          const found = sec.fiberStrands?.find(f => f.id === strandId);
          if(found) return { section: sec, strand: found };
      }
      return null;
  };

  const isSemiArtereInvalid = category === InfrastructureCategory.SEMI_ARTERE && outgoingSections.length < 2;

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
                             <span className="flex items-center gap-1 text-blue-300">
                                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                 Source: {incomingSection.name} (Depuis {getCableOriginName(incomingSection)})
                             </span>
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

        {/* BODY */}
        <div className="flex-1 overflow-hidden p-0 bg-slate-950 flex flex-col min-h-0">
            
            {/* ALERT FOR SEMI-ARTERE */}
            {isSemiArtereInvalid && (
                <div className="bg-orange-900/50 border-b border-orange-500/50 p-2 text-center text-xs text-orange-200 font-bold flex items-center justify-center gap-2 animate-pulse shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Configuration Semi-Artère Incomplète : Il faut au moins 1 Câble Arrivée + 2 Départs (1 Continuité Backbone + 1 Piquage).
                </div>
            )}

            {/* TAB: SPLICING */}
            {activeTab === 'SPLICING' && (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="bg-slate-800/50 p-2 border-b border-slate-700 flex justify-between items-center px-6 shrink-0">
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Sélectionnez un brin Entrant (Gauche), puis une destination (Droite).
                        </div>
                        <div className="flex gap-2">
                            <button onClick={autoSplice} className="text-xs bg-teal-900/40 hover:bg-teal-800 text-teal-200 px-3 py-1 rounded border border-teal-700 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                Auto-Splice (1-1)
                            </button>
                             <button onClick={() => setConnections([])} className="text-xs bg-red-900/40 hover:bg-red-800 text-red-200 px-3 py-1 rounded border border-red-700">
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        
                        {/* LEFT: INCOMING CABLE (With Selector) */}
                        <div className="w-1/3 overflow-y-auto border-r border-slate-700 bg-slate-900/30 custom-scrollbar flex flex-col">
                            <div className="sticky top-0 bg-slate-900 p-3 border-b border-slate-700 z-10 shadow-md">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-[10px] uppercase font-bold text-blue-500">Câble Arrivée (Source)</div>
                                    <span className="text-[9px] bg-blue-900/50 text-blue-300 px-1 rounded border border-blue-500/30">AMONT</span>
                                </div>
                                
                                {/* CABLE SELECTOR WITH NEW OPTION */}
                                <select 
                                    value={incomingSectionId} 
                                    onChange={(e) => handleIncomingSectionChange(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-xs text-white font-bold focus:border-blue-500 outline-none mb-1"
                                >
                                    <option value="" disabled>-- Choisir Câble --</option>
                                    {connectedSections.map(s => {
                                        const serviceCount = s.fiberStrands?.filter(f => f.serviceName).length || 0;
                                        return (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.fiberCount} FO {serviceCount > 0 ? `• ${serviceCount} Services` : ''})
                                            </option>
                                        );
                                    })}
                                    <option value="__NEW__" className="text-green-400 font-bold bg-slate-700">++ Créer Nouveau Câble ++</option>
                                </select>
                                
                                {incomingSection && (
                                    <div className="text-[10px] text-slate-400 bg-slate-800 p-1.5 rounded border border-slate-700 mt-1 flex justify-between">
                                        <span>Type: {incomingSection.cableType}</span>
                                        <span className="text-blue-300 font-bold">De: {getCableOriginName(incomingSection)}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-2 space-y-1">
                                {!incomingSection && <div className="p-4 text-center text-xs text-slate-500 italic">Veuillez sélectionner ou créer un câble en amont.</div>}
                                {incomingSection?.fiberStrands?.map(strand => {
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
                                                    {strand.client && <span className="text-[9px] text-cyan-400 truncate">{strand.client}</span>}
                                                </div>
                                            </div>
                                            {connected && <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* CENTER: SPLICE TRAY */}
                        <div className="w-20 bg-slate-950 flex flex-col items-center justify-center relative border-r border-slate-700 shadow-inner shrink-0">
                            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundSize: '20px 20px', backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)' }}></div>
                            <div className="-rotate-90 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase whitespace-nowrap mb-8">Cassette Soudure</div>
                            <div className="space-y-4">
                                <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-lg">
                                     <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                </div>
                                <div className="w-0.5 h-16 bg-slate-800 mx-auto"></div>
                                <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-lg">
                                     <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: OUTGOING CABLES (TABS) */}
                        <div className="flex-1 flex flex-col bg-slate-900/30">
                            {/* TABS HEADER */}
                            <div className="flex overflow-x-auto bg-slate-900 border-b border-slate-700 no-scrollbar shrink-0">
                                {outgoingSections.map((sec) => (
                                    <button
                                        key={sec.id}
                                        onClick={() => setActiveOutgoingTabId(sec.id)}
                                        className={`px-4 py-3 text-xs font-bold border-r border-slate-700 whitespace-nowrap flex items-center gap-2 transition-colors ${
                                            activeOutgoingTabId === sec.id 
                                            ? 'bg-slate-800 text-teal-400 border-b-2 border-b-teal-500' 
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                                        {sec.name}
                                    </button>
                                ))}
                                
                                {/* ADD CABLE BUTTON */}
                                <button 
                                    onClick={() => onAddSection(infra.id)}
                                    className="px-4 py-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-1 border-r border-slate-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Nouveau Câble
                                </button>
                            </div>

                            {/* CABLE CONTENT */}
                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar relative">
                                {outgoingSections.length === 0 && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                                        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        <p className="text-sm font-bold">Aucun câble de départ.</p>
                                        <p className="text-xs mb-4">Pour une artère ou un piquage, ajoutez au moins un câble sortant.</p>
                                        <button onClick={() => onAddSection(infra.id)} className="bg-teal-600 text-white px-4 py-2 rounded text-xs font-bold shadow hover:bg-teal-500">
                                            Ajouter Câble Départ
                                        </button>
                                    </div>
                                )}

                                {outgoingSections.find(s => s.id === activeOutgoingTabId)?.fiberStrands?.map(strand => {
                                    // Reverse lookup to find if THIS strand is spliced to selected incoming
                                    const incomingSourceId = connections.find(c => c.outgoingStrandId === strand.id)?.incomingStrandId;
                                    const isConnected = !!incomingSourceId;
                                    
                                    // Is it connected to the CURRENTLY selected incoming strand?
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
                                            {/* Connector Dot */}
                                            <div className={`w-3 h-3 rounded-full border-2 ${isConnected ? 'bg-green-500 border-green-700' : 'bg-transparent border-slate-600'}`}></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* NEW: VISUAL SUMMARY (Plan de Boîte) */}
                    <div className="h-40 bg-slate-900 border-t border-slate-700 shrink-0 flex flex-col">
                        <div className="bg-slate-800 p-2 px-4 border-b border-slate-700 flex justify-between items-center">
                             <div className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2">
                                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                Plan de Boîte / Continuités ({connections.length})
                             </div>
                             <div className="text-[10px] text-slate-500">Vue Globale (Split)</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-2">
                                {connections.length === 0 && <div className="col-span-2 text-center text-slate-500 text-xs italic py-4">Aucune épissure réalisée.</div>}
                                {connections.map((conn, idx) => {
                                    const source = getStrandInfo(conn.incomingStrandId);
                                    const dest = getStrandInfo(conn.outgoingStrandId);
                                    if(!source || !dest) return null;

                                    return (
                                        <div key={idx} className="bg-slate-800/50 p-2 rounded border border-slate-700 flex justify-between items-center text-[10px] hover:border-slate-500 transition-colors">
                                            <div className="flex items-center gap-2 flex-1">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getFiberColorHex(source.strand.colorCode) }}></div>
                                                <span className="font-bold text-slate-300 truncate w-16" title={source.section.name}>{source.section.name}</span>
                                                <span className="text-slate-500">#{source.strand.number}</span>
                                            </div>
                                            
                                            <div className="px-2 text-slate-600">⟷</div>
                                            
                                            <div className="flex items-center gap-2 flex-1 justify-end">
                                                <span className="text-slate-500">#{dest.strand.number}</span>
                                                <span className="font-bold text-slate-300 truncate w-16 text-right" title={dest.section.name}>{dest.section.name}</span>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getFiberColorHex(dest.strand.colorCode) }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: INFO CONFIG */}
            {activeTab === 'INFO' && (
                <div className="p-8 max-w-2xl mx-auto space-y-6 animate-fadeIn">
                     <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nom de l'Infrastructure</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Type Physique</label>
                            <div className="space-y-2">
                                {Object.values(InfrastructureType).map(t => (
                                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="infraType" checked={type === t} onChange={() => setType(t)} className="accent-blue-500" />
                                        <span className="text-sm text-slate-200">{t.replace('_', ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Rôle Topologique</label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                    <input type="radio" name="infraCat" checked={category === InfrastructureCategory.STANDARD} onChange={() => setCategory(InfrastructureCategory.STANDARD)} className="accent-purple-500" />
                                    <div>
                                        <div className="text-sm font-bold text-slate-200">Standard</div>
                                        <div className="text-[10px] text-slate-500">Jonction simple (1 Entrée / 1 Sortie)</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                    <input type="radio" name="infraCat" checked={category === InfrastructureCategory.SEMI_ARTERE} onChange={() => setCategory(InfrastructureCategory.SEMI_ARTERE)} className="accent-orange-500" />
                                    <div>
                                        <div className="text-sm font-bold text-orange-400">Semi-Artère (Piquage)</div>
                                        <div className="text-[10px] text-slate-500">Extraction vers Site (1 Entrée / 2+ Sorties)</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                    <input type="radio" name="infraCat" checked={category === InfrastructureCategory.ARTERE} onChange={() => setCategory(InfrastructureCategory.ARTERE)} className="accent-red-500" />
                                    <div>
                                        <div className="text-sm font-bold text-red-400">Artère Principale</div>
                                        <div className="text-[10px] text-slate-500">Nœud Backbone Critique</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description & Notes</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white h-24 focus:border-blue-500 outline-none" placeholder="Ex: Situé à 5m du carrefour, trappe bloquée..." />
                    </div>
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between gap-3 rounded-b-xl shrink-0">
             {onDelete && (
                <button onClick={onDelete} className="px-4 py-2 bg-red-900/40 text-red-500 hover:bg-red-600 hover:text-white border border-red-900/50 rounded shadow text-xs font-bold transition-colors">
                    Supprimer l'Infrastructure
                </button>
             )}
             <div className="flex gap-3 ml-auto">
                 <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium">Fermer sans sauvegarder</button>
                 <button onClick={handleSave} className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded shadow-lg text-sm font-bold transition-transform active:scale-95">
                     Enregistrer Configuration
                 </button>
             </div>
        </div>

      </div>
    </div>
  );
};

export default ManchonEditor;
