
import React, { useState, useEffect } from 'react';
import { Bts, Ctt, Equipment, EquipmentType, Liaison, LiaisonType, LiaisonCategory, PowerStatus, PowerSource, InfrastructureType, LiaisonStatus, SiteType } from '../types';

interface NodeEditorProps {
  node: Bts | Ctt;
  nodeType: 'BTS' | 'CTT';
  liaisons: Liaison[]; 
  onSave: (updatedNode: Bts | Ctt) => void;
  onClose: () => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({ node, nodeType, liaisons, onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState<'EQUIPMENT' | 'ODF' | 'POWER' | 'LAST_MILE'>('EQUIPMENT');
  const [equipments, setEquipments] = useState<Equipment[]>(node.equipments || []);
  const [name, setName] = useState(node.name);
  const [nodeBts, setNodeBts] = useState<Bts | null>(nodeType === 'BTS' ? (node as Bts) : null);

  // New Equipment Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEqName, setNewEqName] = useState('');
  const [newEqModel, setNewEqModel] = useState('');
  const [newEqType, setNewEqType] = useState<EquipmentType>(EquipmentType.WDM);

  // --- LOGIC: FIND FEEDING LIAISON & STATUS ---
  // Assuming "Feeding" is the one coming from CTT or having Backbone category, or simply the one connected.
  // We prioritize Backbone connections or the first operational fiber link.
  const connectedLiaisons = liaisons.filter(l => {
      const distStart = Math.hypot(l.startCoordinates.lat - node.coordinates.lat, l.startCoordinates.lng - node.coordinates.lng);
      const distEnd = Math.hypot(l.endCoordinates.lat - node.coordinates.lat, l.endCoordinates.lng - node.coordinates.lng);
      return (distStart < 0.001 || distEnd < 0.001);
  });

  const feedingLiaison = connectedLiaisons.find(l => l.category === LiaisonCategory.BACKBONE) || connectedLiaisons[0];
  const isLastMile = connectedLiaisons.some(l => l.category === LiaisonCategory.LAST_MILE) && nodeType === 'BTS';

  // Check Transmission Equipment Presence
  const hasTransmissionEq = equipments.some(eq => 
      [EquipmentType.WDM, EquipmentType.SDH, EquipmentType.IP_MPLS, EquipmentType.MICROWAVE].includes(eq.type)
  );

  // Check Global Power Status
  const isPowerDown = equipments.some(eq => eq.powerStatus === PowerStatus.DOWN);

  // Derive Node Connectivity Status
  let nodeConnectivityStatus: 'OK' | 'WARNING' | 'DOWN' = 'OK';
  let statusReason = "Opérationnel";

  if (feedingLiaison?.status === LiaisonStatus.FAULTY) {
      nodeConnectivityStatus = 'DOWN';
      statusReason = "Coupure Liaison Fibre";
  } else if (isPowerDown) {
      nodeConnectivityStatus = 'DOWN';
      statusReason = "Énergie HS (Site Isolé)";
  } else if (!hasTransmissionEq && nodeType !== 'CTT') { // CTT usually exists conceptually
      nodeConnectivityStatus = 'DOWN';
      statusReason = "Absence Éq. Transmission";
  } else if (feedingLiaison?.status === LiaisonStatus.MAINTENANCE) {
      nodeConnectivityStatus = 'WARNING';
      statusReason = "Maintenance en cours";
  }

  const handleAddEquipment = () => {
      if(!newEqName) return;
      const newEq: Equipment = {
          id: `eq-${Date.now()}`,
          name: newEqName,
          model: newEqModel || 'Standard',
          type: newEqType,
          status: 'OPERATIONAL',
          powerStatus: PowerStatus.STABLE,
          powerSource: PowerSource.GRID
      };
      setEquipments([...equipments, newEq]);
      setShowAddForm(false);
      setNewEqName('');
      setNewEqModel('');
  };

  const handleRemoveEquipment = (id: string) => {
      setEquipments(equipments.filter(e => e.id !== id));
  };

  const handlePowerChange = (eqId: string, status: PowerStatus) => {
      setEquipments(prev => prev.map(eq => eq.id === eqId ? { ...eq, powerStatus: status } : eq));
  };
  
  const handlePowerSourceChange = (eqId: string, source: PowerSource) => {
      setEquipments(prev => prev.map(eq => eq.id === eqId ? { ...eq, powerSource: source } : eq));
  };

  const handleSave = () => {
      const updatedNode = { ...node, name, equipments };
      onSave(updatedNode);
  };

  const getFiberColorHex = (colorName: string) => {
    const map: Record<string, string> = {
      'Bleu': '#3b82f6', 'Orange': '#f97316', 'Vert': '#22c55e', 'Marron': '#854d0e',
      'Gris': '#94a3b8', 'Blanc': '#f8fafc', 'Rouge': '#ef4444', 'Noir': '#000000',
      'Jaune': '#eab308', 'Violet': '#a855f7', 'Rose': '#ec4899', 'Aqua': '#06b6d4'
    };
    return map[colorName] || '#fff';
  };

  return (
    <div className="fixed inset-0 z-[1400] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[90vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="h-20 bg-slate-800 border-b border-slate-700 flex justify-between items-center px-6">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-lg relative ${nodeType === 'CTT' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    {/* Power Status Dot on Icon */}
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-800 ${isPowerDown ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        {name}
                        {nodeConnectivityStatus === 'DOWN' && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded animate-pulse">OFFLINE</span>}
                    </h2>
                    <div className="text-xs text-slate-400 flex gap-3 mt-1">
                        <span className="bg-slate-700 px-2 py-0.5 rounded text-white">{nodeType}</span>
                        {feedingLiaison && (
                             <span className={`flex items-center gap-1 border px-2 py-0.5 rounded ${
                                 nodeConnectivityStatus === 'OK' ? 'border-green-500/30 text-green-400 bg-green-900/10' : 
                                 nodeConnectivityStatus === 'WARNING' ? 'border-orange-500/30 text-orange-400 bg-orange-900/10' :
                                 'border-red-500/30 text-red-400 bg-red-900/10'
                             }`}>
                                 <div className={`w-2 h-2 rounded-full ${nodeConnectivityStatus === 'OK' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                 Liaison: {statusReason}
                             </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Fermer</button>
                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-lg shadow-blue-900/50">Enregistrer</button>
            </div>
        </div>

        {/* BODY */}
        <div className="flex-1 flex overflow-hidden">
            {/* SIDEBAR TABS */}
            <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 space-y-2">
                <button onClick={() => setActiveTab('EQUIPMENT')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'EQUIPMENT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                    Baies & Équipements
                </button>
                <button onClick={() => setActiveTab('ODF')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'ODF' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Câblage & ODF
                </button>
                 <button onClick={() => setActiveTab('POWER')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'POWER' ? 'bg-yellow-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Énergie & Alim.
                </button>
                {isLastMile && (
                    <button onClick={() => setActiveTab('LAST_MILE')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'LAST_MILE' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Last Mile & Accès
                    </button>
                )}
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-y-auto bg-slate-900 p-6">
                
                {/* TAB: EQUIPMENT */}
                {activeTab === 'EQUIPMENT' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Rack Virtuel</h3>
                            <button onClick={() => setShowAddForm(true)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Ajouter Équipement
                            </button>
                        </div>

                        {showAddForm && (
                             <div className="bg-slate-800 p-4 rounded-lg border border-slate-600 mb-4 animate-fadeIn">
                                <div className="grid grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Type</label>
                                        <select value={newEqType} onChange={e => setNewEqType(e.target.value as EquipmentType)} className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm">
                                            {Object.values(EquipmentType).map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-slate-400 mb-1">Nom (ex: OSN 8800)</label>
                                        <input value={newEqName} onChange={e => setNewEqName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm" placeholder="Nom de l'équipement" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Modèle</label>
                                        <input value={newEqModel} onChange={e => setNewEqModel(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm" placeholder="Modèle" />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-white px-3 text-sm">Annuler</button>
                                    <button onClick={handleAddEquipment} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold">Confirmer</button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {equipments.map(eq => (
                                <div key={eq.id} className={`bg-slate-800 border-2 rounded-lg p-4 relative group hover:border-blue-500 transition-colors ${eq.powerStatus === PowerStatus.DOWN ? 'border-red-500/50' : 'border-slate-700'}`}>
                                    <div className="absolute top-2 right-2 flex gap-1 items-center">
                                         <div className={`w-2 h-2 rounded-full ${eq.status === 'OPERATIONAL' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-bold uppercase mb-1">{eq.type}</div>
                                    <div className="text-lg font-bold text-white mb-1">{eq.name}</div>
                                    <div className="text-sm text-slate-400 mb-4">{eq.model}</div>
                                    
                                    {/* Connectivity Preview */}
                                    {eq.type !== EquipmentType.ACCESS && (
                                        <div className="mb-4">
                                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Connectivité</div>
                                            <div className="text-xs text-slate-300">
                                                {connectedLiaisons.length > 0 ? (
                                                    <span className="text-green-400">● {connectedLiaisons.length} Liens détectés</span>
                                                ) : <span className="text-slate-500">Non connecté</span>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Power Mini-Status */}
                                    <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded text-xs mt-2">
                                        <span className={`${eq.powerStatus === PowerStatus.STABLE ? 'text-green-400' : 'text-red-400'}`}>
                                            {eq.powerSource === PowerSource.GRID ? '⚡ SECTEUR' : '⛽ GE'}
                                        </span>
                                        <span className="text-slate-500">|</span>
                                        <span className={`${eq.powerStatus === PowerStatus.STABLE ? 'text-slate-300' : 'text-red-500 font-bold'}`}>
                                            {eq.powerStatus}
                                        </span>
                                    </div>

                                    <button onClick={() => handleRemoveEquipment(eq.id)} className="absolute bottom-4 right-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold hover:underline">
                                        Supprimer
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB: POWER MANAGEMENT */}
                {activeTab === 'POWER' && (
                    <div className="space-y-6">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-white mb-1">Gestion de l'Énergie</h3>
                            <p className="text-slate-400 text-sm">Configurez les sources d'alimentation par équipement. Si une source est HS, la liaison associée passera "DOWN".</p>
                        </div>
                        
                        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                                    <tr>
                                        <th className="p-3">Équipement</th>
                                        <th className="p-3">Source</th>
                                        <th className="p-3">État Alimentation</th>
                                        <th className="p-3">Impact Liaison</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {equipments.map(eq => (
                                        <tr key={eq.id} className="hover:bg-slate-700/30">
                                            <td className="p-3 font-bold text-slate-200">{eq.name} <span className="text-xs font-normal text-slate-500">({eq.type})</span></td>
                                            <td className="p-3">
                                                <select 
                                                    value={eq.powerSource} 
                                                    onChange={(e) => handlePowerSourceChange(eq.id, e.target.value as PowerSource)}
                                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 outline-none">
                                                    {Object.values(PowerSource).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handlePowerChange(eq.id, PowerStatus.STABLE)}
                                                        className={`px-2 py-1 rounded text-xs font-bold ${eq.powerStatus === PowerStatus.STABLE ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                                        STABLE
                                                    </button>
                                                    <button 
                                                        onClick={() => handlePowerChange(eq.id, PowerStatus.UNSTABLE)}
                                                        className={`px-2 py-1 rounded text-xs font-bold ${eq.powerStatus === PowerStatus.UNSTABLE ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                                        PERTURBÉ
                                                    </button>
                                                    <button 
                                                        onClick={() => handlePowerChange(eq.id, PowerStatus.DOWN)}
                                                        className={`px-2 py-1 rounded text-xs font-bold ${eq.powerStatus === PowerStatus.DOWN ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                                        HS
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {eq.powerStatus === PowerStatus.DOWN ? (
                                                    <span className="text-red-500 font-bold flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                                        LINK DOWN
                                                    </span>
                                                ) : <span className="text-green-500 text-xs">OK</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: ODF / CABLING DETAILED */}
                {activeTab === 'ODF' && (
                    <div className="flex flex-col h-full space-y-8">
                         <div>
                            <h3 className="text-xl font-bold text-white mb-1">Câblage & ODF Détaillé</h3>
                            <p className="text-slate-400 text-sm">Visualisation des connexions fibre optique par équipement de transmission.</p>
                         </div>

                         {/* Filter out Access equipment from detailed ODF view as requested */}
                         {equipments.filter(eq => eq.type !== EquipmentType.ACCESS).map(eq => (
                             <div key={eq.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                                 <div className="bg-slate-700/50 p-3 border-b border-slate-600 flex justify-between items-center">
                                     <h4 className="font-bold text-white flex items-center gap-2">
                                         <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                         {eq.name} <span className="text-slate-400 text-sm font-normal">({eq.model})</span>
                                     </h4>
                                     <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">{eq.type} CABLING</span>
                                 </div>
                                 
                                 <div className="p-4 grid grid-cols-2 gap-6">
                                     {/* INCOMING / FEEDING SIDE */}
                                     <div>
                                         <div className="text-xs font-bold text-green-400 uppercase mb-2 border-b border-slate-700 pb-1">Câbles Entrants (Backbone/Amont)</div>
                                         {connectedLiaisons.length === 0 && <p className="text-slate-500 text-xs italic">Aucune liaison connectée.</p>}
                                         {connectedLiaisons.filter(l => l.category === LiaisonCategory.BACKBONE || l.category === LiaisonCategory.LAST_MILE).map(l => (
                                             <div key={l.id} className="mb-4">
                                                 <div className="text-sm font-bold text-slate-200">{l.name}</div>
                                                 <div className="text-xs text-slate-500 mb-2 flex gap-2">
                                                     <span>Capacité: {l.fiberCount} FO</span>
                                                     <span>•</span>
                                                     <span>Dist: {l.distanceKm} km</span>
                                                 </div>
                                                 <div className="space-y-1">
                                                     {l.fiberStrands?.slice(0, 6).map(f => (
                                                         <div key={f.id} className="flex items-center gap-2 text-[10px] bg-slate-900/40 p-1 rounded">
                                                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getFiberColorHex(f.colorCode) }}></div>
                                                             <span className="w-4 text-slate-400">{f.number}</span>
                                                             <span className="flex-1 truncate text-slate-300">{f.serviceName || 'Libre'}</span>
                                                             <span className="text-slate-500">{f.status}</span>
                                                         </div>
                                                     ))}
                                                 </div>
                                             </div>
                                         ))}
                                     </div>

                                     {/* OUTGOING / DISTRIBUTION SIDE */}
                                     <div>
                                         <div className="text-xs font-bold text-blue-400 uppercase mb-2 border-b border-slate-700 pb-1">Distribution & Voisins</div>
                                         <div className="space-y-2">
                                             {node.coordinates && connectedLiaisons.map(l => {
                                                 // Determine neighbor name
                                                 const isStart = Math.hypot(l.startCoordinates.lat - node.coordinates.lat, l.startCoordinates.lng - node.coordinates.lng) < 0.001;
                                                 // This is a simplification, ideally we need neighbor IDs
                                                 return (
                                                     <div key={l.id} className="bg-slate-900 p-2 rounded border border-slate-700/50">
                                                         <div className="text-xs text-slate-400">Vers Voisin via <span className="text-slate-200 font-bold">{l.name}</span></div>
                                                         <div className="mt-1 flex gap-2">
                                                             <span className="text-[10px] bg-slate-700 px-1 rounded text-white">{l.type}</span>
                                                             <span className="text-[10px] bg-slate-700 px-1 rounded text-white">{l.fiberCount} FO</span>
                                                         </div>
                                                     </div>
                                                 );
                                             })}
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         ))}

                         {equipments.filter(eq => eq.type !== EquipmentType.ACCESS).length === 0 && (
                             <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded text-slate-500">
                                 Aucun équipement de transmission (WDM/SDH/FH) pour afficher l'ODF complexe.
                             </div>
                         )}
                    </div>
                )}

                {/* TAB: LAST MILE SPECIFICS */}
                {activeTab === 'LAST_MILE' && isLastMile && (
                    <div className="space-y-6">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-white mb-1">Infrastructure Last Mile</h3>
                            <p className="text-slate-400 text-sm">Détails du raccordement et services mobiles délivrés.</p>
                        </div>

                        {/* Connection Details */}
                        {feedingLiaison && (
                             <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 grid grid-cols-2 gap-8">
                                 <div>
                                     <h4 className="text-xs font-bold text-amber-500 uppercase mb-3">Point de Piquage (Raccordement)</h4>
                                     
                                     {feedingLiaison.infrastructurePoints?.filter(p => p.type === InfrastructureType.CHAMBRE || p.type === InfrastructureType.MANCHON).map(infra => (
                                         <div key={infra.id} className="bg-slate-900 p-3 rounded border border-slate-600 mb-2">
                                             <div className="flex items-center gap-2 mb-1">
                                                 <div className="w-2 h-2 bg-amber-500 rotate-45"></div>
                                                 <div className="font-bold text-sm text-white">{infra.name}</div>
                                             </div>
                                             <div className="text-xs text-slate-400 font-mono pl-4 mb-2">
                                                 {infra.coordinates.lat.toFixed(6)}, {infra.coordinates.lng.toFixed(6)}
                                             </div>
                                             <div className="flex justify-between text-xs border-t border-slate-700 pt-2 pl-4">
                                                 <span className="text-slate-500">Distance CTT:</span>
                                                 <span className="text-slate-200">{feedingLiaison.backboneDistanceKm} km</span>
                                             </div>
                                         </div>
                                     ))}
                                     {(!feedingLiaison.infrastructurePoints || feedingLiaison.infrastructurePoints.length === 0) && (
                                         <div className="text-xs text-slate-500 italic">Aucune chambre de piquage définie sur la liaison.</div>
                                     )}
                                 </div>

                                 <div>
                                     <h4 className="text-xs font-bold text-teal-500 uppercase mb-3">Services Mobiles & Capacité</h4>
                                     
                                     <div className="bg-slate-900 p-3 rounded border border-slate-600 mb-3">
                                         <div className="text-xs text-slate-400 mb-1">Technologie Mobile</div>
                                         <div className="flex gap-2 flex-wrap">
                                             {nodeBts?.mobileTechnologies?.map(tech => (
                                                 <span key={tech} className="px-2 py-1 bg-teal-900/30 border border-teal-500/30 text-teal-400 rounded text-xs font-bold">
                                                     {tech}
                                                 </span>
                                             ))}
                                             {(!nodeBts?.mobileTechnologies || nodeBts.mobileTechnologies.length === 0) && <span className="text-slate-500 text-xs">Non spécifié</span>}
                                         </div>
                                     </div>

                                     <div className="bg-slate-900 p-3 rounded border border-slate-600">
                                         <div className="text-xs text-slate-400 mb-1">Liaison d'Accès</div>
                                         <div className="flex justify-between items-center mb-1">
                                             <span className="text-slate-300 text-xs">Distance Last Mile</span>
                                             <span className="font-bold text-white text-sm">{feedingLiaison.distanceKm} km</span>
                                         </div>
                                         <div className="flex justify-between items-center">
                                             <span className="text-slate-300 text-xs">Capacité Fibre</span>
                                             <span className="font-bold text-white text-sm">{feedingLiaison.fiberCount} FO</span>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default NodeEditor;
