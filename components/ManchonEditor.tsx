
import React, { useState, useEffect } from 'react';
import { InfrastructurePoint, InfrastructureType, InfrastructureCategory, Liaison, CableSection, FiberStrand, SplicingConnection } from '../types';

interface ManchonEditorProps {
  infra: InfrastructurePoint;
  liaisonContext?: Liaison; // To find cables
  onSave: (updatedInfra: InfrastructurePoint) => void;
  onClose: () => void;
}

const ManchonEditor: React.FC<ManchonEditorProps> = ({ infra, liaisonContext, onSave, onClose }) => {
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

  // Context Discovery
  const [incomingSection, setIncomingSection] = useState<CableSection | null>(null);
  const [outgoingSection, setOutgoingSection] = useState<CableSection | null>(null);

  useEffect(() => {
      if (!liaisonContext || !liaisonContext.sections) return;
      if (liaisonContext.sections.length >= 1) setIncomingSection(liaisonContext.sections[0]);
      if (liaisonContext.sections.length >= 2) setOutgoingSection(liaisonContext.sections[1]);
  }, [liaisonContext, infra.id]);

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

  // --- ROBUST SPLICING LOGIC ---

  const handleIncomingClick = (strandId: string) => {
      // Toggle selection
      setSelectedIncomingStrand(prev => prev === strandId ? null : strandId);
  };

  const handleOutgoingClick = (outgoingStrandId: string) => {
      if (!selectedIncomingStrand) return;

      // Check if connection already exists for this pair
      const existingIndex = connections.findIndex(c => c.incomingStrandId === selectedIncomingStrand);

      let newConnections = [...connections];

      if (existingIndex !== -1) {
          // If clicking the same one -> Disconnect
          if (connections[existingIndex].outgoingStrandId === outgoingStrandId) {
              newConnections.splice(existingIndex, 1);
          } else {
              // Switch connection to new outgoing strand
              newConnections[existingIndex] = {
                  incomingStrandId: selectedIncomingStrand,
                  outgoingStrandId: outgoingStrandId,
                  status: 'SPLICED'
              };
          }
      } else {
          // Create new connection
          newConnections.push({
              incomingStrandId: selectedIncomingStrand,
              outgoingStrandId: outgoingStrandId,
              status: 'SPLICED'
          });
      }

      setConnections(newConnections);
      setSelectedIncomingStrand(null); // Reset selection after action
  };

  const isConnected = (incomingId: string) => {
      return connections.some(c => c.incomingStrandId === incomingId);
  };

  const getConnectedOutgoingId = (incomingId: string) => {
      return connections.find(c => c.incomingStrandId === incomingId)?.outgoingStrandId;
  };

  const autoSplice = () => {
      if (!incomingSection?.fiberStrands || !outgoingSection?.fiberStrands) return;
      const newConns: SplicingConnection[] = [];
      const count = Math.min(incomingSection.fiberStrands.length, outgoingSection.fiberStrands.length);
      
      for(let i=0; i<count; i++) {
          newConns.push({
              incomingStrandId: incomingSection.fiberStrands[i].id,
              outgoingStrandId: outgoingSection.fiberStrands[i].id,
              status: 'SPLICED'
          });
      }
      setConnections(newConns);
  };

  const clearAllSplices = () => {
      setConnections([]);
  };

  return (
    <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-600 w-full max-w-6xl h-[90vh] rounded-xl shadow-2xl flex flex-col">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800 rounded-t-xl">
             <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${type === InfrastructureType.CHAMBRE ? 'bg-purple-600' : 'bg-orange-600'}`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                 </div>
                 <div>
                     <h3 className="font-bold text-white text-lg">{name}</h3>
                     <p className="text-xs text-slate-400">Éditeur d'Épissurage & Infrastructure</p>
                 </div>
             </div>
             <div className="flex bg-slate-900 rounded p-1">
                 <button onClick={() => setActiveTab('SPLICING')} className={`px-4 py-1 text-xs font-bold rounded ${activeTab === 'SPLICING' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}>CASSETTE / ÉPISSURES</button>
                 <button onClick={() => setActiveTab('INFO')} className={`px-4 py-1 text-xs font-bold rounded ${activeTab === 'INFO' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>INFOS GÉNÉRALES</button>
             </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-hidden p-0 bg-slate-950">
            
            {/* TAB: SPLICING */}
            {activeTab === 'SPLICING' && (
                <div className="h-full flex flex-col">
                    <div className="bg-slate-800/50 p-2 border-b border-slate-700 flex justify-between items-center px-6">
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Mode d'emploi : Cliquez sur un brin à GAUCHE, puis sur un brin à DROITE pour souder.
                        </div>
                        <div className="flex gap-2">
                             <button onClick={clearAllSplices} className="text-xs bg-red-900/50 hover:bg-red-800 text-red-300 px-3 py-1 rounded border border-red-800">
                                Tout Déconnecter
                            </button>
                            <button onClick={autoSplice} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded border border-slate-500">
                                Auto-Splice (1-to-1)
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        
                        {/* LEFT: INCOMING */}
                        <div className="flex-1 overflow-y-auto border-r border-slate-700 bg-slate-900/50 custom-scrollbar">
                            <div className="sticky top-0 bg-slate-900 p-3 border-b border-slate-700 z-10 shadow-md">
                                <h4 className="font-bold text-slate-200 text-sm text-center">
                                    {incomingSection ? incomingSection.name : "Câble Entrant"}
                                </h4>
                            </div>
                            <div className="p-4 space-y-2">
                                {incomingSection?.fiberStrands?.map(strand => {
                                    const connected = isConnected(strand.id);
                                    const isSelected = selectedIncomingStrand === strand.id;
                                    
                                    return (
                                        <div 
                                            key={strand.id} 
                                            onClick={() => handleIncomingClick(strand.id)}
                                            className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all border ${
                                                isSelected 
                                                ? 'bg-blue-900/40 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
                                                : connected ? 'bg-slate-800 border-slate-700 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: getFiberColorHex(strand.colorCode) }}></div>
                                                <span className="text-xs font-mono text-slate-400 w-6 text-center">{strand.number}</span>
                                                <span className="text-xs text-slate-200 truncate max-w-[120px]">{strand.serviceName || 'Libre'}</span>
                                            </div>
                                            {/* Status Indicator */}
                                            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* CENTER: SPLICE TRAY VISUALIZATION */}
                        <div className="w-24 bg-slate-950 flex flex-col items-center justify-center relative border-r border-slate-700">
                            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent)', backgroundSize: '30px 30px' }}></div>
                            <div className="rotate-90 text-xs font-bold text-slate-600 tracking-widest uppercase">Cassette</div>
                            <svg className="w-12 h-12 text-slate-700 mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        </div>

                        {/* RIGHT: OUTGOING */}
                        <div className="flex-1 overflow-y-auto bg-slate-900/50 custom-scrollbar">
                            <div className="sticky top-0 bg-slate-900 p-3 border-b border-slate-700 z-10 shadow-md">
                                <h4 className="font-bold text-slate-200 text-sm text-center">
                                    {outgoingSection ? outgoingSection.name : "Câble Sortant"}
                                </h4>
                            </div>
                            <div className="p-4 space-y-2">
                                {outgoingSection?.fiberStrands?.map(strand => {
                                    // Check if this specific outgoing strand is connected to ANY incoming
                                    const incomingMatchId = connections.find(c => c.outgoingStrandId === strand.id)?.incomingStrandId;
                                    const isThisConnected = !!incomingMatchId;
                                    
                                    // Highlight if it matches the CURRENT selection
                                    const matchesSelection = selectedIncomingStrand && incomingMatchId === selectedIncomingStrand;

                                    return (
                                        <div 
                                            key={strand.id} 
                                            onClick={() => handleOutgoingClick(strand.id)}
                                            className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all border flex-row-reverse ${
                                                matchesSelection
                                                ? 'bg-green-900/40 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                                                : isThisConnected ? 'bg-slate-800 border-slate-700 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 flex-row-reverse">
                                                <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: getFiberColorHex(strand.colorCode) }}></div>
                                                <span className="text-xs font-mono text-slate-400 w-6 text-center">{strand.number}</span>
                                                <span className="text-xs text-slate-200 truncate max-w-[120px] text-right">{strand.serviceName || 'Libre'}</span>
                                            </div>
                                            {/* Connector Dot */}
                                            <div className={`w-3 h-3 rounded-full border-2 ${isThisConnected ? 'bg-green-500 border-green-700' : 'bg-transparent border-slate-600'}`}></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* TAB: INFO */}
            {activeTab === 'INFO' && (
                <div className="p-8 max-w-2xl mx-auto space-y-6">
                     <div>
                        <label className="block text-xs text-slate-400 mb-1">Nom / Identifiant</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Type Physique</label>
                            <select value={type} onChange={e => setType(e.target.value as InfrastructureType)} className="w-full bg-slate-950 border border-slate-600 rounded p-2 text-sm text-white">
                                {Object.values(InfrastructureType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Catégorie Réseau</label>
                            <select value={category} onChange={e => setCategory(e.target.value as InfrastructureCategory)} className="w-full bg-slate-950 border border-slate-600 rounded p-2 text-sm text-white">
                                {Object.values(InfrastructureCategory).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Description & Localisation</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded p-2 text-sm text-white h-32 focus:border-blue-500 outline-none" />
                    </div>
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end gap-3 rounded-b-xl">
             <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Annuler</button>
             <button onClick={handleSave} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded shadow text-sm font-bold transition-transform active:scale-95">Enregistrer Configuration</button>
        </div>

      </div>
    </div>
  );
};

export default ManchonEditor;
