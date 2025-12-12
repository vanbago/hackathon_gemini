
import React, { useState, useEffect } from 'react';
import { FormType, MaintenanceDocument, DocumentStatus, Bts, Liaison } from '../types';

interface FormGeneratorProps {
  document: MaintenanceDocument;
  site?: Bts;
  liaison?: Liaison;
  onSave: (doc: MaintenanceDocument) => void;
  onClose: () => void;
}

const FormGenerator: React.FC<FormGeneratorProps> = ({ document, site, liaison, onSave, onClose }) => {
  const [formData, setFormData] = useState<any>(document.data || {});
  const [technicianInput, setTechnicianInput] = useState(document.technicians.join(', '));

  // --- HEADER COMMON TO ALL FORMS ---
  const CamtelHeader = ({ title, code, version = '1' }: { title: string, code: string, version?: string }) => (
    <div className="border-2 border-slate-800 mb-6 bg-white text-slate-900">
      <div className="flex">
        {/* LOGO AREA */}
        <div className="w-1/4 border-r-2 border-slate-800 p-4 flex items-center justify-center">
            {/* Simple CSS Logo for Camtel */}
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                    <div className="w-8 h-8 rounded-full border-4 border-blue-600 flex items-center justify-center">
                        <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
                    </div>
                    <span className="text-2xl font-bold text-blue-700 tracking-tighter">camtel</span>
                </div>
            </div>
        </div>
        
        {/* TITLE AREA */}
        <div className="w-1/2 border-r-2 border-slate-800 flex flex-col items-center justify-center p-2 text-center">
            <h2 className="font-bold text-sm uppercase">Fiche de Maintenance Préventive des Réseaux et Ateliers d'Énergie et Environnement</h2>
            <div className="mt-2 text-lg font-black uppercase border-t-2 border-slate-800 w-full pt-1">
                {title}
            </div>
        </div>

        {/* METADATA AREA */}
        <div className="w-1/4 p-2 text-xs font-semibold flex flex-col justify-center gap-1">
            <div>Code : {code}</div>
            <div>Version : {version}</div>
            <div>Date : {new Date().toLocaleDateString()}</div>
            <div>Page : 1/1</div>
        </div>
      </div>
    </div>
  );

  // --- SPECIFIC FORM CONTENTS ---

  // 1. FICHE DE CONTRÔLE PHYSIQUE SEGMENT FIBRE OPTIQUE
  const FiberCheckContent = () => (
    <div className="space-y-4 text-slate-900">
      <div className="border border-slate-800 p-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex gap-2"><strong>Segment :</strong> {liaison?.name || 'N/A'}</div>
            <div className="flex gap-2"><strong>Nombre total de chambres :</strong> <input className="border-b border-slate-400 outline-none w-20" type="number" value={formData.totalChambers} onChange={e => setFormData({...formData, totalChambers: e.target.value})} /></div>
            
            <div className="flex gap-2"><strong>Date et heure :</strong> {new Date().toLocaleString()}</div>
            <div className="flex gap-2"><strong>Distance du segment :</strong> {liaison?.distanceKm} km</div>
            
            <div className="flex gap-2"><strong>Nombre de brins :</strong> {liaison?.fiberCount || 'N/A'}</div>
            <div className="flex gap-2"><strong>Documentation :</strong> Plan As-built</div>
        </div>
      </div>

      <div className="text-sm font-bold border border-slate-800 p-2 bg-slate-100">
        Matériel: GPS, Vélomètre, Véhicule
      </div>

      <div className="text-sm border border-slate-800 p-2">
        <strong>Tâches à mener :</strong> Identifier les points d’exposition de câble, érosion, chambres exposées, absence de marqueur...
      </div>

      <table className="w-full border-collapse border border-slate-800 text-sm">
        <thead>
            <tr className="bg-slate-200">
                <th className="border border-slate-800 p-2 w-1/3">Défauts</th>
                <th className="border border-slate-800 p-2 w-1/3">Coordonnées GPS / Lieu dit</th>
                <th className="border border-slate-800 p-2 w-1/3">Actions menées / Solutions</th>
            </tr>
        </thead>
        <tbody>
            {[0, 1, 2, 3, 4].map(i => (
                <tr key={i}>
                    <td className="border border-slate-800 p-1"><input className="w-full outline-none" placeholder="..." value={formData[`defaut_${i}`] || ''} onChange={e => setFormData({...formData, [`defaut_${i}`]: e.target.value})} /></td>
                    <td className="border border-slate-800 p-1"><input className="w-full outline-none" placeholder="..." value={formData[`gps_${i}`] || ''} onChange={e => setFormData({...formData, [`gps_${i}`]: e.target.value})} /></td>
                    <td className="border border-slate-800 p-1"><input className="w-full outline-none" placeholder="..." value={formData[`action_${i}`] || ''} onChange={e => setFormData({...formData, [`action_${i}`]: e.target.value})} /></td>
                </tr>
            ))}
        </tbody>
      </table>
    </div>
  );

  // 2. FICHE DE MAINTENANCE DES STATIONS
  const StationMaintContent = () => (
     <div className="space-y-4 text-slate-900">
        <div className="border border-slate-800 p-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
                <div><strong>Station :</strong> {site?.name}</div>
                <div><strong>Coordonnées GPS :</strong> {site?.coordinates.lat.toFixed(5)}, {site?.coordinates.lng.toFixed(5)}</div>
            </div>
        </div>

        <div className="text-sm font-bold border border-slate-800 p-2 bg-slate-100">
            MATERIEL : Souffleur, Etiquettes, Raticide, Balai
        </div>

        <table className="w-full border-collapse border border-slate-800 text-xs text-center">
            <thead>
                <tr className="bg-slate-200 font-bold">
                    <th className="border border-slate-800 p-2">Equipement</th>
                    <th className="border border-slate-800 p-2">Nettoyage filtres (OK/NOK)</th>
                    <th className="border border-slate-800 p-2">Contrôle visuel (OK/NOK)</th>
                    <th className="border border-slate-800 p-2">Mise à la terre (OK/NOK)</th>
                    <th className="border border-slate-800 p-2">Environnement Ext (OK/NOK)</th>
                </tr>
            </thead>
            <tbody>
                 <tr>
                    <td className="border border-slate-800 p-2 font-bold">Général / Site</td>
                    <td className="border border-slate-800 p-1"><input type="checkbox" checked={formData.filtersClean} onChange={e => setFormData({...formData, filtersClean: e.target.checked})} /></td>
                    <td className="border border-slate-800 p-1"><input type="checkbox" checked={formData.visualCheck} onChange={e => setFormData({...formData, visualCheck: e.target.checked})} /></td>
                    <td className="border border-slate-800 p-1"><input type="checkbox" checked={formData.groundingOK} onChange={e => setFormData({...formData, groundingOK: e.target.checked})} /></td>
                    <td className="border border-slate-800 p-1"><input type="checkbox" checked={formData.envOK} onChange={e => setFormData({...formData, envOK: e.target.checked})} /></td>
                </tr>
            </tbody>
        </table>

        <div className="border border-slate-800 p-2 h-24">
            <strong className="text-sm block mb-1">Observations :</strong>
            <textarea className="w-full h-full outline-none text-sm resize-none" value={formData.observations || ''} onChange={e => setFormData({...formData, observations: e.target.value})} />
        </div>
     </div>
  );

  // 3. FICHE DE CONTRÔLE PHYSIQUE DES ÉQUIPEMENTS RADIO FH
  const RadioFHContent = () => (
      <div className="space-y-4 text-slate-900">
        <div className="border border-slate-800 p-2 text-sm bg-slate-50">
             <div><strong>Station :</strong> {site?.name}</div>
             <div><strong>Liaison :</strong> {formData.linkName || 'Liaison FH'}</div>
        </div>

        <table className="w-full border-collapse border border-slate-800 text-xs text-center">
             <thead>
                <tr className="bg-slate-200">
                    <th className="border border-slate-800 p-2">Equipement</th>
                    <th className="border border-slate-800 p-2">Vérifier ODU</th>
                    <th className="border border-slate-800 p-2">Température Site</th>
                    <th className="border border-slate-800 p-2">Vérifier Antenne</th>
                    <th className="border border-slate-800 p-2">Câble IF</th>
                    <th className="border border-slate-800 p-2">Étanchéité Connecteurs</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="border border-slate-800 p-2 font-bold">BBU / RTN</td>
                     <td className="border border-slate-800 p-1"><select value={formData.oduCheck ? 'OK' : 'NOK'} onChange={e => setFormData({...formData, oduCheck: e.target.value === 'OK'})}><option>OK</option><option>NOK</option></select></td>
                     <td className="border border-slate-800 p-1"><input className="w-10 text-center border-b" value={formData.tempSite || 24} onChange={e => setFormData({...formData, tempSite: e.target.value})} />°C</td>
                     <td className="border border-slate-800 p-1"><select value={formData.antennaCheck ? 'OK' : 'NOK'} onChange={e => setFormData({...formData, antennaCheck: e.target.value === 'OK'})}><option>OK</option><option>NOK</option></select></td>
                     <td className="border border-slate-800 p-1"><select value={formData.cableIF ? 'OK' : 'NOK'} onChange={e => setFormData({...formData, cableIF: e.target.value === 'OK'})}><option>OK</option><option>NOK</option></select></td>
                     <td className="border border-slate-800 p-1"><select value={formData.connectors ? 'OK' : 'NOK'} onChange={e => setFormData({...formData, connectors: e.target.value === 'OK'})}><option>OK</option><option>NOK</option></select></td>
                </tr>
            </tbody>
        </table>
         <div className="border border-slate-800 p-2 h-24">
            <strong className="text-sm block mb-1">Observations :</strong>
            <textarea className="w-full h-full outline-none text-sm resize-none" value={formData.observations || ''} onChange={e => setFormData({...formData, observations: e.target.value})} placeholder="Ex: Liaison Down, RSL faible..." />
        </div>
      </div>
  );

  const handleSaveInternal = () => {
      onSave({
          ...document,
          data: formData,
          technicians: technicianInput.split(',').map(s => s.trim()),
          status: DocumentStatus.VALIDATED // Auto validate on save for demo
      });
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
        <div className="bg-white w-full max-w-4xl min-h-[800px] shadow-2xl rounded-sm p-8 flex flex-col relative text-slate-900">
            {/* Close Button */}
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-red-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Dynamic Header */}
            <CamtelHeader 
                title={document.type === FormType.FIBER_CHECK ? "Fiche de Contrôle Physique Segment Fibre Optique" : 
                       document.type === FormType.STATION_MAINT ? "Fiche de Maintenance des Stations" : 
                       "Fiche de Contrôle Physique des Équipements Radio FH"} 
                code={document.code} 
            />

            {/* Dynamic Content */}
            <div className="flex-1">
                {document.type === FormType.FIBER_CHECK && <FiberCheckContent />}
                {document.type === FormType.STATION_MAINT && <StationMaintContent />}
                {document.type === FormType.RADIO_FH_CHECK && <RadioFHContent />}
            </div>

            {/* Footer / Team */}
            <div className="mt-8 border-t-2 border-slate-800 pt-4">
                <div className="mb-4">
                    <label className="block text-sm font-bold mb-1">Equipe d'intervention :</label>
                    <input 
                        className="w-full border border-slate-300 p-2 rounded" 
                        value={technicianInput}
                        onChange={(e) => setTechnicianInput(e.target.value)}
                        placeholder="Noms des techniciens..."
                    />
                </div>
                <div className="flex justify-between items-center">
                    <div className="text-xs text-slate-500 italic">Généré par CTT Mbalmayo AI System</div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-2 border border-slate-400 text-slate-600 font-bold hover:bg-slate-100 transition-colors">ANNULER</button>
                        <button onClick={handleSaveInternal} className="px-6 py-2 bg-blue-700 text-white font-bold hover:bg-blue-800 transition-colors shadow-lg">ENREGISTRER & VALIDER</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default FormGenerator;
