
import React, { useState } from 'react';
import { MaintenanceDocument, DocumentStatus, FormType, Bts, Liaison } from '../types';
import FormGenerator from './FormGenerator';

interface DocumentManagerProps {
  documents: MaintenanceDocument[];
  btsStations: Bts[];
  liaisons: Liaison[];
  onUpdateDocument: (doc: MaintenanceDocument) => void;
  onCreateDocument: (doc: MaintenanceDocument) => void;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ documents, btsStations, liaisons, onUpdateDocument, onCreateDocument }) => {
  const [activeTab, setActiveTab] = useState<'IN_PROGRESS' | 'PROCESSED'>('IN_PROGRESS');
  const [selectedDoc, setSelectedDoc] = useState<MaintenanceDocument | null>(null);
  
  // Filter logic
  const filteredDocs = documents.filter(d => 
      activeTab === 'IN_PROGRESS' 
        ? d.status === DocumentStatus.DRAFT 
        : (d.status === DocumentStatus.VALIDATED || d.status === DocumentStatus.ARCHIVED)
  );

  const getSiteName = (id?: string) => btsStations.find(b => b.id === id)?.name || id || 'Site Inconnu';
  const getLiaisonName = (id?: string) => liaisons.find(l => l.id === id)?.name || id || 'Liaison Inconnue';

  const handleCreateNew = (type: FormType) => {
    const newDoc: MaintenanceDocument = {
        id: `doc-${Date.now()}`,
        type: type,
        title: `Nouvelle Fiche ${type === FormType.STATION_MAINT ? 'Station' : (type === FormType.FIBER_CHECK ? 'Fibre' : 'FH')}`,
        date: new Date().toISOString().split('T')[0],
        status: DocumentStatus.DRAFT,
        technicians: ['Technicien'],
        data: {},
        code: type === FormType.STATION_MAINT ? 'FI-DT-06' : 'EN-DT-03' // Example codes
    };
    onCreateDocument(newDoc);
    setSelectedDoc(newDoc);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl h-full flex flex-col overflow-hidden relative">
      <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Gestion Documentaire
        </h3>
        <div className="flex gap-2">
            <button onClick={() => handleCreateNew(FormType.STATION_MAINT)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">+ Fiche Station</button>
            <button onClick={() => handleCreateNew(FormType.RADIO_FH_CHECK)} className="text-xs bg-teal-600 hover:bg-teal-500 text-white px-2 py-1 rounded">+ Fiche FH</button>
            <button onClick={() => handleCreateNew(FormType.FIBER_CHECK)} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded">+ Fiche FO</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex text-sm font-medium border-b border-slate-700">
        <button 
            onClick={() => setActiveTab('IN_PROGRESS')}
            className={`flex-1 py-3 transition-colors ${activeTab === 'IN_PROGRESS' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            En Cours / Brouillons ({documents.filter(d => d.status === DocumentStatus.DRAFT).length})
        </button>
        <button 
            onClick={() => setActiveTab('PROCESSED')}
            className={`flex-1 py-3 transition-colors ${activeTab === 'PROCESSED' ? 'bg-slate-800 text-green-400 border-b-2 border-green-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            Traités / Archivés
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredDocs.length === 0 && (
            <div className="text-center text-slate-500 mt-10">Aucun document dans ce classeur.</div>
        )}
        {filteredDocs.map(doc => (
            <div key={doc.id} className="bg-slate-800 p-3 rounded border border-slate-700 hover:border-blue-500/50 transition-colors flex justify-between items-center group">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded flex items-center justify-center ${doc.type === FormType.STATION_MAINT ? 'bg-blue-900/30 text-blue-400' : doc.type === FormType.FIBER_CHECK ? 'bg-purple-900/30 text-purple-400' : 'bg-teal-900/30 text-teal-400'}`}>
                        <span className="font-bold text-xs">{doc.code.split('-')[0]}</span>
                    </div>
                    <div>
                        <div className="font-bold text-slate-200 text-sm">{doc.title}</div>
                        <div className="text-xs text-slate-500 flex gap-2">
                            <span>{doc.siteId ? getSiteName(doc.siteId) : getLiaisonName(doc.liaisonId)}</span>
                            <span>•</span>
                            <span>{new Date(doc.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => setSelectedDoc(doc)}
                    className="px-3 py-1 bg-slate-700 hover:bg-blue-600 text-white text-xs rounded transition-colors opacity-0 group-hover:opacity-100">
                    Ouvrir
                </button>
            </div>
        ))}
      </div>

      {/* Modal Generator */}
      {selectedDoc && (
          <FormGenerator 
            document={selectedDoc} 
            site={btsStations.find(b => b.id === selectedDoc.siteId)}
            liaison={liaisons.find(l => l.id === selectedDoc.liaisonId)}
            onSave={(updated) => {
                onUpdateDocument(updated);
                setSelectedDoc(null);
            }}
            onClose={() => setSelectedDoc(null)}
          />
      )}
    </div>
  );
};

export default DocumentManager;
