
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { parseWhatsAppExport } from '../services/geminiService';
import { apiService } from '../services/apiService';

interface RealTimeFeedProps {
  onMessageReceived: (msg: ChatMessage) => void;
  messages: ChatMessage[];
}

const RealTimeFeed: React.FC<RealTimeFeedProps> = ({ onMessageReceived, messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (text) {
          const importedMessages = parseWhatsAppExport(text);
          for (const msg of importedMessages) {
              // Persist locally and in DB
              onMessageReceived(msg);
              await apiService.saveMessage(msg);
          }
      }
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl h-full flex flex-col overflow-hidden shadow-inner relative">
      
      {/* HEADER */}
      <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800">
        <div className="flex flex-col">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wide">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                Flux NOC-DRC (Archives)
            </h3>
        </div>
        
        <div className="flex gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt" />
            <button onClick={handleImportClick} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-white border border-slate-600">
                {isImporting ? 'Importation...' : 'IMPORT HISTORIQUE TXT'}
            </button>
        </div>
      </div>

      {/* FEED CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 opacity-50">
             <div className="w-12 h-12 border-2 border-slate-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             </div>
             <p className="text-xs font-mono">Aucun message archivé.</p>
          </div>
        )}

        {messages.map((msg) => {
            return (
              <div key={msg.id} className="flex flex-col gap-0.5 group animate-fadeIn transition-all duration-500">
                <div className="flex items-baseline justify-between">
                    <span className={`text-[11px] font-bold font-mono ${msg.sender.toLowerCase().includes("chef") ? "text-purple-400" : "text-cyan-400"}`}>
                    {msg.sender}
                    </span>
                    <span className="text-[9px] text-slate-600 font-mono">{msg.timestamp}</span>
                </div>
                <div className="relative p-2.5 rounded-lg rounded-tl-none border text-xs shadow-sm bg-slate-800 border-slate-700/50 text-slate-300">
                  {msg.content}
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};

export default RealTimeFeed;
