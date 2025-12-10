import React, { useState, useCallback } from 'react';
import MapVisualizer from './MapVisualizer';
import RealTimeFeed from './RealTimeFeed';
import { Activity, ActivityStatus, ChatMessage } from '../types';
import { extractActivityFromText, findLocationCoordinates, generateWeeklyReport, chatWithAgent } from '../services/geminiService';
import { GoogleGenAI } from "@google/genai";

const Dashboard: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  
  // Chat Bot State
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: string, parts: {text: string}[]}[]>([]);
  const [isChatting, setIsChatting] = useState(false);

  // Handle new incoming message from "WhatsApp"
  const handleNewMessage = useCallback(async (msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
    
    // Process with Gemini to see if it contains map-worthy data
    try {
      const extracted = await extractActivityFromText(msg.content);
      
      if (extracted && extracted.locationName && extracted.title) {
        // Grounding: Find coordinates
        const coords = await findLocationCoordinates(extracted.locationName);
        
        if (coords) {
          const newActivity: Activity = {
            id: Date.now().toString(),
            title: extracted.title || "Activité Inconnue",
            description: extracted.description || msg.content,
            status: (extracted.status as ActivityStatus) || ActivityStatus.IN_PROGRESS,
            locationName: extracted.locationName,
            coordinates: coords,
            timestamp: new Date().toISOString(),
            source: 'WHATSAPP',
            technician: extracted.technician || msg.sender
          };

          setActivities(prev => [...prev, newActivity]);
          
          // Mark message as processed in UI
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, processed: true } : m));
        }
      }
    } catch (e) {
      console.error("Auto-process error", e);
    }
  }, []);

  // Handle File Upload (Simulation of ingestion)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsProcessing(true);
      // In a real app, we'd read the file content. 
      // Here, we simulate reading a "Report" or "Log"
      setTimeout(async () => {
        const dummyText = "Rapport d'intervention: Le technicien Paul a réparé l'antenne au site Carrefour Mbalmayo. Statut: Terminé. Également, une alerte de voltage a été détectée à l'Hôpital de District.";
        
        // Process dummy text
        const extracted = await extractActivityFromText(dummyText);
        // We might get multiple, but let's handle one for simplicity in this demo or loop if we split text
        // Let's manually mock two findings for the demo based on the dummy text
        
        const loc1 = await findLocationCoordinates("Carrefour Mbalmayo");
        if (loc1) {
            setActivities(prev => [...prev, {
                id: Date.now().toString() + '1',
                title: "Réparation Antenne",
                description: "Intervention technique sur antenne principale.",
                status: ActivityStatus.COMPLETED,
                locationName: "Carrefour Mbalmayo",
                coordinates: loc1,
                timestamp: new Date().toISOString(),
                source: 'UPLOAD',
                technician: "Paul"
            }]);
        }

        const loc2 = await findLocationCoordinates("Hôpital de District Mbalmayo");
        if (loc2) {
             setActivities(prev => [...prev, {
                id: Date.now().toString() + '2',
                title: "Alerte Voltage",
                description: "Fluctuation de tension critique détectée.",
                status: ActivityStatus.ALERT,
                locationName: "Hôpital de District",
                coordinates: loc2,
                timestamp: new Date().toISOString(),
                source: 'UPLOAD'
            }]);
        }
        
        setIsProcessing(false);
      }, 1500);
    }
  };

  const handleGenerateReport = async () => {
    setIsProcessing(true);
    const html = await generateWeeklyReport(activities);
    setReportHtml(html);
    setIsProcessing(false);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { role: "user", parts: [{ text: chatInput }] };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatting(true);

    try {
        const responseText = await chatWithAgent([...chatHistory, userMsg], chatInput);
        setChatHistory(prev => [...prev, { role: "model", parts: [{ text: responseText }] }]);
    } catch (err) {
        console.error(err);
    } finally {
        setIsChatting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">T</div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-teal-300 bg-clip-text text-transparent">
            Centre de Transmission AI
          </h1>
          <span className="text-xs text-slate-500 border border-slate-700 px-2 py-0.5 rounded">Mbalmayo Node</span>
        </div>
        <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors text-sm border border-slate-600">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span>Ingérer Données</span>
                <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
            <button 
                onClick={handleGenerateReport}
                className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 font-medium shadow-lg shadow-teal-900/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Générer Rapport Hebdo
            </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 overflow-hidden p-4 grid grid-cols-12 gap-4">
        
        {/* Left Column: Map (7 cols) */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4 relative">
            {/* Map Container */}
            <div className="flex-1 relative min-h-[400px]">
                <MapVisualizer activities={activities} />
                {isProcessing && (
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-[500] flex items-center justify-center">
                        <div className="bg-slate-800 p-4 rounded-lg shadow-xl flex items-center gap-3 border border-slate-600">
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-slate-200 font-medium">Analyse IA en cours...</span>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Quick Stats Row */}
            <div className="h-24 grid grid-cols-4 gap-4">
                <StatCard title="Total Activités" value={activities.length} color="bg-slate-800" />
                <StatCard title="En Cours" value={activities.filter(a => a.status === ActivityStatus.IN_PROGRESS).length} color="bg-blue-900/30" textColor="text-blue-400" />
                <StatCard title="Alertes" value={activities.filter(a => a.status === ActivityStatus.ALERT).length} color="bg-red-900/30" textColor="text-red-400" />
                <StatCard title="Terminés" value={activities.filter(a => a.status === ActivityStatus.COMPLETED).length} color="bg-green-900/30" textColor="text-green-400" />
            </div>
        </div>

        {/* Right Column: Feeds & Tools (5 cols) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 h-full overflow-hidden">
            
            {/* Tab/View Switcher Logic could go here, for now split vertically */}
            
            {/* Top Right: WhatsApp Feed */}
            <div className="flex-1 min-h-0">
                <RealTimeFeed onMessageReceived={handleNewMessage} messages={messages} />
            </div>

            {/* Bottom Right: AI Chat / Agent */}
            <div className="h-1/3 bg-slate-900 border border-slate-700 rounded-xl flex flex-col overflow-hidden">
                <div className="p-2 border-b border-slate-700 bg-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Assistant IA - Centre Ops
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-900">
                    {chatHistory.length === 0 && <p className="text-slate-600 text-xs italic">Posez des questions sur les procédures ou les données...</p>}
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                {msg.parts[0].text}
                            </div>
                        </div>
                    ))}
                    {isChatting && <div className="text-slate-500 text-xs animate-pulse">L'IA réfléchit...</div>}
                </div>
                <form onSubmit={handleChatSubmit} className="p-2 border-t border-slate-700 flex gap-2">
                    <input 
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none text-slate-200"
                        placeholder="Demander une procédure..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm transition-colors">
                        Envoyer
                    </button>
                </form>
            </div>
        </div>
      </main>

      {/* Report Modal Overlay */}
      {reportHtml && (
        <div className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm">
            <div className="bg-white text-slate-900 w-full max-w-4xl max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 sticky top-0">
                    <h2 className="text-xl font-bold text-slate-800">Rapport Hebdomadaire Généré</h2>
                    <button onClick={() => setReportHtml(null)} className="text-slate-500 hover:text-red-500 p-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-8 prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: reportHtml }} />
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                    <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700">Imprimer / PDF</button>
                    <button onClick={() => setReportHtml(null)} className="bg-slate-200 text-slate-800 px-4 py-2 rounded hover:bg-slate-300">Fermer</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, color, textColor = "text-white" }: any) => (
    <div className={`${color} rounded-lg p-3 flex flex-col justify-center border border-slate-700/50`}>
        <span className="text-slate-400 text-xs uppercase tracking-wide">{title}</span>
        <span className={`text-2xl font-bold ${textColor}`}>{value}</span>
    </div>
);

export default Dashboard;
