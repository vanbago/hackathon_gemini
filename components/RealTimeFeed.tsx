import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

interface RealTimeFeedProps {
  onMessageReceived: (msg: ChatMessage) => void;
  messages: ChatMessage[];
}

const SAMPLE_MESSAGES = [
  "Équipe Alpha arrivée au Pylône Nord. Début inspection.",
  "Panne signalée au quartier Oyack. Câble rompu.",
  "Maintenance terminée sur le site Central. Tout est OK.",
  "Besoin de renfort zone École de Police. Accès difficile.",
  "Retour vidéo confirmé sur le canal 4.",
  "Incendie mineur signalé près du transformateur Sud."
];

const RealTimeFeed: React.FC<RealTimeFeedProps> = ({ onMessageReceived, messages }) => {
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleConnection = () => {
    if (isConnected) {
      setIsConnected(false);
    } else {
      setIsConnected(true);
    }
  };

  // Simulate incoming messages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        const randomMsg = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)];
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          sender: Math.random() > 0.5 ? "Tech Marc" : "Chef Ops Jean",
          content: randomMsg,
          timestamp: new Date().toLocaleTimeString(),
          processed: false
        };
        onMessageReceived(newMessage);
      }, 8000); // New message every 8 seconds
    }
    return () => clearInterval(interval);
  }, [isConnected, onMessageReceived]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
          <span className="text-green-400 text-xl">●</span> Flux WhatsApp (Simulé)
        </h3>
        <button
          onClick={toggleConnection}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
            isConnected ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          {isConnected ? 'EN LIGNE' : 'HORS LIGNE'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="text-center text-slate-500 text-sm mt-10">En attente de connexion au groupe...</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1 animate-fadeIn">
            <div className={`text-xs font-medium ${msg.sender.includes("Chef") ? "text-purple-400" : "text-blue-400"}`}>
              {msg.sender} <span className="text-slate-600 ml-1">{msg.timestamp}</span>
            </div>
            <div className="bg-slate-800 p-3 rounded-lg rounded-tl-none border border-slate-700 text-sm text-slate-300">
              {msg.content}
            </div>
            {msg.processed && (
              <div className="text-[10px] text-green-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Analysé & Cartographié
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Simulation input for testing specific scenarios */}
      <div className="p-3 bg-slate-800 border-t border-slate-700">
        <input 
            type="text" 
            placeholder="Simuler un message..." 
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => {
                if(e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    const val = target.value;
                    if(!val) return;
                    onMessageReceived({
                        id: Date.now().toString(),
                        sender: "Admin Sim",
                        content: val,
                        timestamp: new Date().toLocaleTimeString(),
                        processed: false
                    });
                    target.value = '';
                }
            }}
        />
      </div>
    </div>
  );
};

export default RealTimeFeed;
