

import { GoogleGenAI, Type } from "@google/genai";
import { Activity, ActivityStatus, Bts, Liaison, LiaisonStatus, Ticket, TicketPriority, TicketStatus, TicketType, Operator, ActivityContext, InfrastructureType, ChatMessage } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to safely parse JSON from AI which might wrap it in markdown code blocks
const safeJsonParse = (text: string | undefined) => {
    if (!text) return null;
    try {
        // Remove markdown code blocks if present (e.g. ```json ... ```)
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("Gemini JSON Parse Error:", e, "Raw Text:", text);
        return null;
    }
};

export const parseWhatsAppExport = (text: string): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  const lines = text.split('\n');
  // Regex covers: "DD/MM/YY, HH:MM - Sender: Message" and "[DD/MM/YY, HH:MM:SS] Sender: Message"
  const regex = /^\[?(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s+[AP]M)?)\]?(?:\s+-\s+|\s+)([^:]+):\s+(.+)$/;

  lines.forEach((line, index) => {
    const match = line.match(regex);
    if (match) {
      messages.push({
        id: `msg-imp-${Date.now()}-${index}`,
        timestamp: match[1],
        sender: match[2].trim(),
        content: match[3].trim(),
        isAnalyzed: false
      });
    }
  });
  return messages;
};

export const extractActivityFromText = async (text: string): Promise<Partial<Activity> | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract activity: "${text}". Return JSON: title, description, locationName, status (PENDING, IN_PROGRESS, COMPLETED), technician.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                locationName: { type: Type.STRING },
                status: { type: Type.STRING },
                technician: { type: Type.STRING },
            }
        }
      }
    });
    return safeJsonParse(response.text);
  } catch (error) { 
      console.error("Gemini Extract Error:", error);
      return null; 
  }
};

export const analyzeImageContext = async (base64Image: string, mimeType: string): Promise<any> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64Image } },
                    { text: `Analyze this technical image. Provide title, technical description, context (MAINTENANCE, INCIDENT), coordinates if visible.` }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        suggestedContext: { type: Type.STRING },
                        detectedCoordinates: {
                             type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } }, nullable: true
                        },
                        detectedInfrastructure: {
                             type: Type.OBJECT, properties: { type: { type: Type.STRING }, name: { type: Type.STRING } }, nullable: true
                        }
                    }
                }
            }
        });
        return safeJsonParse(response.text);
    } catch (error) { 
        console.error("Gemini Vision Error:", error);
        return null; 
    }
};

interface ChatContextData {
  btsStations: Bts[];
  liaisons: Liaison[];
  tickets: Ticket[];
  activities: Activity[];
}

const generateSystemInstruction = (data: ChatContextData): string => {
  // 1. Liste des Sites avec Équipements
  const sitesInfo = data.btsStations.map(s => {
      const equipementsList = s.equipments?.map(e => `${e.name} (${e.type}) [${e.status}]`).join(', ') || 'Aucun équipement déclaré';
      return `- SITE: ${s.name} (${s.type}). Coords: [${s.coordinates.lat}, ${s.coordinates.lng}]. Équipements: ${equipementsList}.`;
  }).join('\n');

  // Helper description code couleurs
  const getColorDesc = (scheme?: string) => {
      if (scheme === 'SPECIAL_MENGWA') return "CODE SPÉCIAL (1:Bleu, 2:Rouge, 3:Vert, 4:Jaune, 5:Violet, 6:Blanc)";
      return "STANDARD ITU-T (1:Bleu, 2:Orange, 3:Vert, 4:Marron, 5:Gris, 6:Blanc...)";
  };

  // 2. Liste des Liaisons Détaillées
  const liaisonsInfo = data.liaisons.map(l => {
      const sectionsInfo = l.sections?.map((sec, idx) => {
          // Add Fiber Details if available
          let fiberDetails = '';
          if (sec.fiberStrands && sec.fiberStrands.length > 0) {
              const usedStrands = sec.fiberStrands.filter(f => f.status === 'USE').map(f => 
                  `Brin #${f.number} (${f.colorCode}): ${f.serviceName}`
              ).join('; ');
              fiberDetails = `      Services actifs: [${usedStrands}]`;
          }
          
          const colorInfo = getColorDesc(sec.colorScheme);
          
          return `   * Tronçon #${idx+1} "${sec.name}": ${sec.fiberCount}FO (${sec.cableType}), ${sec.lengthKm}km.\n     Config: ${colorInfo}\n${fiberDetails}`;
      }).join('\n') || '   * Pas de tronçons définis.';
      
      const infraInfo = l.infrastructurePoints?.map(inf => 
          `   * Infra: ${inf.name} (${inf.type}) à [${inf.coordinates.lat}, ${inf.coordinates.lng}].`
      ).join('\n') || '';

      const usedStrands = l.fiberStrands?.filter(f => f.status === 'USE').length || 0;
      const totalStrands = l.fiberCount || 0;

      return `
- LIAISON: ${l.name} (Type: ${l.type}, Status: ${l.status})
  Distance Totale: ${l.distanceKm} km.
  Capacité: ${usedStrands}/${totalStrands} brins utilisés.
  Connecte: [${l.startCoordinates.lat},${l.startCoordinates.lng}] -> [${l.endCoordinates.lat},${l.endCoordinates.lng}]
  Détails Structurels:
${sectionsInfo}
  Infrastructures Intermédiaires (Manchons/Chambres):
${infraInfo}
`;
  }).join('\n');

  return `Tu es l'Assistant Architecture du Centre de Transmission. 
  Ton rôle est de répondre EXCLUSIVEMENT aux questions techniques sur la topologie du réseau, les équipements, les couleurs de fibre et les câbles.
  
  Tu as accès à la base de données complète en temps réel ci-dessous.
  Chaque tronçon de câble précise son schéma de couleur (Standard vs Spécial). Utilise cette information pour identifier la couleur d'un brin spécifique (ex: Brin 2 est Rouge en code spécial, mais Orange en standard).

  === BASE DE DONNÉES ARCHITECTURE ===
  
  [SITES & NOEUDS]
  ${sitesInfo}

  [LIAISONS FIBRE OPTIQUE & RADIO]
  ${liaisonsInfo}
  
  === FIN BASE DE DONNÉES ===

  DIRECTIVES:
  1. Si on te demande "Quelle est la distance entre X et Y", cherche la liaison correspondante et donne la distance exacte.
  2. Si on te demande "Quels sont les équipements à X", liste-les avec leur statut.
  3. Si on te demande "Détaille le câble X" ou "Quelle est la couleur du brin Y", réfère-toi à la configuration "Config" du tronçon concerné.
  4. Sois précis, technique et concis. Utilise le format Markdown pour la lisibilité.
  5. Si une information n'est pas dans la base (ex: liste vide), dis-le clairement.
  `;
};

export const chatWithAgent = async (
  history: {role: string, parts: {text: string}[]}[], 
  message: string,
  contextData: ChatContextData
) => {
  try {
    const systemInstruction = generateSystemInstruction(contextData);

    const chat = ai.chats.create({
      model: "gemini-3-pro-preview",
      history: history,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2 // Low temperature for factual architectural answers
      }
    });
    
    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Chat Error", error);
    return "Désolé, je ne peux pas accéder aux données d'architecture pour le moment (Erreur API ou Réseau).";
  }
}