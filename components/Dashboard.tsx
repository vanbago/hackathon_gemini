
import React, { useState, useEffect, useRef } from 'react';
import MapVisualizer from './MapVisualizer';
import NotificationCenter from './NotificationCenter';
import FiberEditor from './FiberEditor';
import NodeEditor from './NodeEditor'; 

import { Activity, ActivityStatus, Ctt, Bts, Liaison, Ticket, AppNotification, DashboardTab } from '../types';
import { chatWithAgent, analyzeImageContext } from '../services/geminiService';
import { initializeDefaultState } from '../storageService';
import { apiService } from '../services/apiService';

const Dashboard: React.FC = () => {
  // Data State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [ctt, setCtt] = useState<Ctt | null>(null);
  const [btsStations, setBtsStations] = useState<Bts[]>([]);
  const [liaisons, setLiaisons] = useState<Liaison[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]); 
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // UI State
  const [editingLiaison, setEditingLiaison] = useState<Liaison | null>(null);
  const [isCreatingLiaison, setIsCreatingLiaison] = useState(false);
  const [editingNode, setEditingNode] = useState<{ node: Bts | Ctt, type: 'BTS' | 'CTT' } | null>(null); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Chat Bot State
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: string, parts: {text: string}[]}[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  // NEW: Indicator to show AI knowledge is synced
  const [aiSyncStatus, setAiSyncStatus] = useState<'SYNCED' | 'SYNCING'>('SYNCED');

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backend Connection State
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isDatabaseLoading, setIsDatabaseLoading] = useState(true);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Helper for notifications
  const addNotification = (title: string, message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING') => {
      const notif: AppNotification = {
          id: Date.now().toString(),
          title,
          message,
          type,
          date: new Date().toISOString(),
          isRead: false
      };
      setNotifications(prev => [notif, ...prev]);
  };

  // --- INITIAL DATA LOADING ---
  useEffect(() => {
    const initApp = async () => {
        try {
            // 1. Check Backend Health (just for UI indicator)
            const isAlive = await apiService.checkHealth();
            setIsBackendConnected(isAlive);

            // 2. Try to load State (Remote -> Local Fallback)
            const savedState = await apiService.loadFullState();

            if (savedState && (savedState.ctt || savedState.btsStations.length > 0)) {
                console.log("Loaded saved state successfully.");
                setActivities(savedState.activities || []);
                setCtt(savedState.ctt || null);
                setBtsStations(savedState.btsStations || []);
                setLiaisons(savedState.liaisons || []);
                setTickets(savedState.tickets || []);
                
                if (!isAlive) {
                    addNotification("Mode Hors Ligne", "Connexion serveur échouée. Chargement des données locales.", "WARNING");
                }
            } else {
                console.log("No saved state found (New Deployment). Seeding defaults...");
                const defaultState = initializeDefaultState();
                
                // Persist defaults immediately to DB/Local
                await apiService.initializeDefaults(defaultState);
                
                setActivities(defaultState.activities);
                setCtt(defaultState.ctt);
                setBtsStations(defaultState.btsStations);
                setLiaisons(defaultState.liaisons);
                setTickets(defaultState.tickets);
            }
        } catch (e) {
            console.error("Init Error", e);
            addNotification("Erreur Critique", "Impossible de charger l'application.", "ERROR");
        } finally {
            setIsDatabaseLoading(false);
        }
    };

    initApp();
  }, []);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { role: "user", parts: [{ text: chatInput }] };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatting(true);

    try {
        // We pass the FULL live architecture to the AI
        const contextData = { btsStations, liaisons, tickets: [], activities };
        const responseText = await chatWithAgent([...chatHistory, userMsg], chatInput, contextData);
        setChatHistory(prev => [...prev, { role: "model", parts: [{ text: responseText }] }]);
    } catch (err) {
        console.error(err);
        setChatHistory(prev => [...prev, { role: "model", parts: [{ text: "Erreur de connexion à l'IA." }] }]);
        addNotification("Erreur IA", "L'assistant n'a pas pu traiter votre demande.", "ERROR");
    } finally {
        setIsChatting(false);
    }
  };

  // --- PERSISTENCE HANDLERS (SAVE TO DB) ---

  const triggerAiSync = () => {
      setAiSyncStatus('SYNCING');
      setTimeout(() => setAiSyncStatus('SYNCED'), 1500); // Fake delay to show feedback
  };

  const handleSaveLiaison = async (updatedLiaison: Liaison) => {
    setIsSaving(true);
    try {
        // 1. Persist to SQLite / LocalStorage
        const result: any = await apiService.saveLiaison(updatedLiaison);
        
        // With new API, result is never null/false if local save works.
        // It returns { success: true, offline: true } if backend fails.
        if (!result || !result.success) throw new Error("Save failed");

        // 2. Update UI only if save successful (or local fallback worked)
        if (liaisons.find(l => l.id === updatedLiaison.id)) {
            setLiaisons(prev => prev.map(l => l.id === updatedLiaison.id ? updatedLiaison : l));
        } else {
            setLiaisons(prev => [...prev, updatedLiaison]);
        }
        
        setEditingLiaison(null);
        setIsCreatingLiaison(false);
        
        if (result.offline) {
             addNotification('Mode Hors Ligne', `La liaison "${updatedLiaison.name}" a été sauvegardée localement.`, 'WARNING');
        } else {
             addNotification('Sauvegarde Réussie', `La liaison "${updatedLiaison.name}" a été enregistrée.`, 'SUCCESS');
        }
        triggerAiSync();
    } catch (error) {
        console.error("Save Error", error);
        addNotification('Erreur de Sauvegarde', "Impossible d'enregistrer la liaison.", 'ERROR');
    } finally {
        setIsSaving(false);
    }
  };

  const handleSaveNode = async (updatedNode: Bts | Ctt) => {
      setIsSaving(true);
      try {
        const result: any = await apiService.saveSite(updatedNode);
        if (!result || !result.success) throw new Error("Save failed");

        if (editingNode?.type === 'CTT') {
            setCtt(updatedNode as Ctt);
        } else {
            setBtsStations(prev => prev.map(b => b.id === updatedNode.id ? (updatedNode as Bts) : b));
        }
        setEditingNode(null);

        if (result.offline) {
             addNotification('Mode Hors Ligne', `Le site "${updatedNode.name}" a été mis à jour localement.`, 'WARNING');
        } else {
             addNotification('Sauvegarde Réussie', `Le site "${updatedNode.name}" a été mis à jour.`, 'SUCCESS');
        }
        triggerAiSync();
      } catch (error) {
          console.error("Save Error", error);
          addNotification('Erreur de Sauvegarde', "Impossible d'enregistrer le nœud.", 'ERROR');
      } finally {
          setIsSaving(false);
      }
  };

  const handleNodeClick = (node: Bts | Ctt, type: 'BTS' | 'CTT') => {
      setEditingNode({ node, type });
  };

  const handleImportMediaClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            const analysis = await analyzeImageContext(base64Data, file.type);
            
            if (analysis) {
                addNotification(`Média Analysé: ${analysis.title}`, analysis.description, 'INFO');

                if (analysis.detectedCoordinates || analysis.detectedInfrastructure) {
                   const coords = analysis.detectedCoordinates || { lat: 3.5170, lng: 11.5012 };
                   
                   const newActivity: Activity = {
                       id: `act-import-${Date.now()}`,
                       title: analysis.title,
                       description: analysis.description,
                       locationName: 'Localisation Image',
                       coordinates: coords,
                       status: ActivityStatus.PENDING,
                       context: analysis.suggestedContext,
                       timestamp: new Date().toISOString(),
                       source: 'MEDIA'
                   };
                   
                   setActivities(prev => [...prev, newActivity]);
                   await apiService.saveActivity(newActivity);
                   triggerAiSync();
                }
            } else {
                addNotification('Échec Analyse', "L'IA n'a pas pu extraire de données de cette image.", 'WARNING');
            }
            setIsProcessing(false);
        };
        reader.onerror = () => {
            throw new Error("Erreur de lecture du fichier");
        }
    } catch (error) {
        console.error("File processing error", error);
        addNotification('Erreur Import', "Impossible de lire le fichier.", 'ERROR');
        setIsProcessing(false);
    }
  };

  if (isDatabaseLoading) {
      return (
          <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-200">
              <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-lg font-bold">Chargement de l'Architecture...</div>
              </div>
          </div>
      );
  }

  // Combine CTT and BTS for selector
  const availableNodes = ctt ? [ctt, ...btsStations] : btsStations;

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 shadow-lg z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-blue-900/50 shadow-lg">T</div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-teal-300 bg-clip-text text-transparent">
            Centre de Transmission AI
          </h1>
          
          {isBackendConnected ? (
              <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-900/20 px-2 py-0.5 rounded border border-green-500/30">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  DB: NODE.JS
              </span>
          ) : (
             <span className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded border border-orange-500/30">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                  DB: LOCAL
              </span>
          )}
          {isSaving && <span className="text-xs text-blue-400 animate-pulse ml-2">Sauvegarde en cours...</span>}
        </div>
        <div className="flex items-center gap-3">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,application/pdf"
                onChange={handleFileChange}
            />
            <button 
                onClick={handleImportMediaClick}
                disabled={isProcessing}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 font-bold shadow-lg shadow-indigo-900/20 disabled:opacity-50">
                {isProcessing ? 'Analyse...' : 'Importer Plan/Image'}
            </button>
            <button 
                onClick={() => setIsCreatingLiaison(true)}
                className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 font-bold shadow-lg shadow-teal-900/20">
                + Nouvelle Liaison
            </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 overflow-hidden p-3 grid grid-cols-12 gap-3 relative">
        
        {/* Left Column: Map & Topology (8 cols - wider for map) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 relative">
            <div className="flex-1 relative min-h-[400px] border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                <MapVisualizer 
                    activities={activities} 
                    ctt={ctt} 
                    btsStations={btsStations} 
                    liaisons={liaisons} 
                    onLiaisonClick={setEditingLiaison}
                    onNodeClick={handleNodeClick}
                />
                
                {/* Map Overlay Stats */}
                <div className="absolute bottom-4 left-4 flex gap-2 pointer-events-none">
                     <div className="bg-slate-900/80 backdrop-blur border border-slate-600 rounded px-3 py-1 text-xs">
                        <span className="text-slate-400">Sites:</span> <span className="text-white font-bold">{btsStations.length + (ctt ? 1 : 0)}</span>
                     </div>
                     <div className="bg-slate-900/80 backdrop-blur border border-slate-600 rounded px-3 py-1 text-xs">
                        <span className="text-slate-400">Liaisons:</span> <span className="text-white font-bold">{liaisons.length}</span>
                     </div>
                </div>
            </div>
            
            <div className="h-32 bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col">
                 <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Notifications Système</h3>
                 <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                     <NotificationCenter notifications={notifications} />
                 </div>
            </div>
        </div>

        {/* Right Column: AI Assistant (4 cols) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col h-full overflow-hidden bg-slate-900 border border-slate-700 rounded-xl shadow-xl">
            {/* Assistant Header */}
            <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-100 text-sm">Assistant Architecture</h3>
                        <p className="text-[10px] text-slate-400">Expertise Technique & Infrastructure</p>
                    </div>
                </div>
                {/* Sync Indicator */}
                <div className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${aiSyncStatus === 'SYNCED' ? 'text-green-400 border-green-500/30 bg-green-900/20' : 'text-blue-400 border-blue-500/30 bg-blue-900/20 animate-pulse'}`}>
                    {aiSyncStatus === 'SYNCED' ? '● BASE À JOUR' : '↻ ACTUALISATION...'}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-slate-950/50" ref={chatScrollRef}>
                 {chatHistory.length === 0 && (
                     <div className="text-center mt-10 opacity-50 px-6">
                         <p className="text-sm text-slate-400 mb-2">Bonjour. Je suis connecté à votre base de données.</p>
                         <p className="text-xs text-slate-500">Posez-moi des questions sur les câbles, les équipements, les distances ou la topologie.</p>
                         <div className="mt-4 grid grid-cols-1 gap-2 text-xs">
                             <div className="bg-slate-800 p-2 rounded cursor-pointer hover:bg-slate-700">"Liste les équipements du CTT Mbalmayo"</div>
                             <div className="bg-slate-800 p-2 rounded cursor-pointer hover:bg-slate-700">"Quelle est la distance Mbalmayo-Sangmelima ?"</div>
                             <div className="bg-slate-800 p-2 rounded cursor-pointer hover:bg-slate-700">"Détaille les brins du câble Mengbwa"</div>
                         </div>
                     </div>
                 )}
                 {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] p-3 rounded-xl text-sm shadow-md ${
                            msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                        }`}>
                            {/* Render Markdown-like content simply */}
                            <div className="whitespace-pre-wrap leading-relaxed">{msg.parts[0].text}</div>
                        </div>
                    </div>
                ))}
                {isChatting && (
                    <div className="flex justify-start">
                        <div className="bg-slate-800 p-3 rounded-xl rounded-tl-none border border-slate-700 flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleChatSubmit} className="p-3 bg-slate-800 border-t border-slate-700">
                <div className="relative">
                    <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-10 py-3 text-sm text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" 
                        value={chatInput} 
                        onChange={(e) => setChatInput(e.target.value)} 
                        placeholder="Interroger l'architecture..." 
                        disabled={isChatting}
                    />
                    <button 
                        type="submit" 
                        disabled={!chatInput.trim() || isChatting}
                        className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </div>
            </form>
        </div>

        {/* Modal: Fiber Editor for Existing OR New Liaison */}
        {(editingLiaison || isCreatingLiaison) && (
          <FiberEditor 
            liaison={editingLiaison} // Pass null if creating
            availableNodes={availableNodes} // PASS AVAILABLE NODES FOR ROUTING
            onSave={handleSaveLiaison} 
            onClose={() => { setEditingLiaison(null); setIsCreatingLiaison(false); }} 
          />
        )}

        {/* Modal: Node Editor */}
        {editingNode && (
            <NodeEditor
                node={editingNode.node}
                nodeType={editingNode.type}
                liaisons={liaisons}
                onSave={handleSaveNode}
                onClose={() => setEditingNode(null)}
            />
        )}

      </main>
    </div>
  );
};

export default Dashboard;
