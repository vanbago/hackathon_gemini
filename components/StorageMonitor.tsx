

import React, { useState, useEffect, useRef } from 'react';
import { apiService, StorageTransaction } from '../services/apiService';

const StorageMonitor: React.FC = () => {
    const [transactions, setTransactions] = useState<StorageTransaction[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        // Subscribe to API events
        const unsubscribe = apiService.subscribeToStorageEvents((tx) => {
            setTransactions(prev => {
                // If update existing pending transaction
                const existingIdx = prev.findIndex(t => t.id === tx.id);
                if (existingIdx >= 0) {
                    const updated = [...prev];
                    updated[existingIdx] = tx;
                    return updated;
                }
                // Else add new
                return [...prev, tx];
            });
            
            // Auto open on activity if closed? optional.
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transactions]);

    const handleDownloadDb = async () => {
        setIsDownloading(true);
        await apiService.downloadDatabase();
        setIsDownloading(false);
    };

    const getStatusIcon = (status: string) => {
        switch(status) {
            case 'PENDING': return <svg className="w-3 h-3 text-yellow-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
            case 'SUCCESS': return <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
            case 'ERROR': return <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
            case 'OFFLINE_SYNC': return <svg className="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
            default: return null;
        }
    };

    return (
        <div className={`fixed bottom-0 right-10 z-[1500] bg-slate-900 border border-slate-700 rounded-t-lg shadow-2xl transition-all duration-300 w-80 font-mono text-[10px] flex flex-col ${isOpen ? 'h-72' : 'h-8'}`}>
            
            {/* Header */}
            <div 
                className="bg-slate-800 p-2 flex justify-between items-center cursor-pointer hover:bg-slate-700 border-b border-slate-700 rounded-t-lg"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 font-bold text-slate-300">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Moniteur de Persistance DB
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-slate-900 px-1.5 rounded text-slate-400">{transactions.length} ops</span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </div>
            </div>

            {/* Content */}
            {isOpen && (
                <div className="flex-1 flex flex-col">
                    <div className="p-2 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-slate-400">État: Connecté (SQLite)</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDownloadDb(); }}
                            disabled={isDownloading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                        >
                            {isDownloading ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            )}
                            Télécharger Backup BD
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-black/40">
                        {transactions.length === 0 && <div className="text-slate-600 text-center italic mt-4">Aucune transaction enregistrée.</div>}
                        {transactions.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between p-1.5 bg-slate-800/50 rounded border border-slate-700/50">
                                <div className="flex items-center gap-2">
                                    <span className="w-4 flex justify-center">{getStatusIcon(tx.status)}</span>
                                    <div className="flex flex-col">
                                        <span className="text-slate-200 font-bold truncate w-40">{tx.entity}: {tx.name}</span>
                                        <span className="text-slate-500">{tx.action} • {new Date(tx.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                                {tx.duration && (
                                    <span className={`font-bold ${tx.duration > 500 ? 'text-yellow-500' : 'text-slate-500'}`}>{tx.duration}ms</span>
                                )}
                            </div>
                        ))}
                        <div ref={endRef} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default StorageMonitor;