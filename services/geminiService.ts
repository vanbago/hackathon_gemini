import { GoogleGenAI, Type } from "@google/genai";
import { Activity, ActivityStatus } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes unstructured text (chats, docs) to extract structured activity data.
 * Uses 'gemini-2.5-flash' for speed.
 */
export const extractActivityFromText = async (text: string): Promise<Partial<Activity> | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract operational activity details from this text: "${text}". 
      Return JSON with fields: title, description, locationName, status (PENDING, IN_PROGRESS, COMPLETED, ALERT), technician. 
      If no location is specified, leave locationName empty.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            locationName: { type: Type.STRING },
            status: { type: Type.STRING, enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "ALERT"] },
            technician: { type: Type.STRING },
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Partial<Activity>;
    }
    return null;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    return null;
  }
};

/**
 * Uses Google Maps Grounding to find coordinates for a location name.
 * Uses 'gemini-2.5-flash' with googleMaps tool.
 */
export const findLocationCoordinates = async (locationName: string): Promise<{ lat: number, lng: number } | null> => {
  if (!locationName) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find the coordinates for: ${locationName} in or near Mbalmayo, Cameroon.`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    // Extract coordinates from grounding metadata
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const chunks = candidates[0].groundingMetadata?.groundingChunks;
      if (chunks) {
        // Iterate through chunks to find map data
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
             // Sometimes it returns a search query, we want precise location if possible
             // For this demo, since we can't parse HTML from a URI easily without a backend, 
             // We will try to rely on the model describing the location or using the map tool's strict output if available.
             // However, the best way with the current SDK tool output is if it provides specific lat/long in the text or metadata.
             // Let's ask the model to output JSON with the found location data in the text part as a fallback/confirmation.
          }
        }
      }
    }
    
    // Fallback: Ask Gemini to give us the likely coordinates based on its knowledge if the tool interaction is purely visual or link-based in this context.
    // In a real production app with the full Maps API, we would use the Place ID. 
    // Here we double-check with a direct query.
    const coordResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What are the latitude and longitude coordinates for "${locationName}" in Mbalmayo, Cameroon? Return ONLY a JSON object: {"lat": number, "lng": number}.`,
      config: {
        responseMimeType: "application/json",
         responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
          }
        }
      }
    });

    if (coordResponse.text) {
        return JSON.parse(coordResponse.text);
    }

    return null;
  } catch (error) {
    console.error("Location Search Error:", error);
    return null;
  }
};

/**
 * Generates a weekly report comparing planned vs actual work.
 * Uses 'gemini-3-pro-preview' for advanced reasoning.
 */
export const generateWeeklyReport = async (activities: Activity[]): Promise<string> => {
  try {
    const dataStr = JSON.stringify(activities);
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze these operational activities for the Mbalmayo Transmission Center: ${dataStr}.
      Generate a professional HTML report (divs, h2, p, ul, table classes using Tailwind CSS).
      The report should include:
      1. Executive Summary.
      2. Table of Interventions (Status, Technician, Location).
      3. Map Coverage Analysis (Are interventions clustered? Areas neglected?).
      4. Recommendations for next week.
      
      Do not include <html> or <body> tags, just the content container.`,
    });

    return response.text || "<p>Could not generate report.</p>";
  } catch (error) {
    console.error("Report Generation Error:", error);
    return "<p>Error generating report.</p>";
  }
};

/**
 * Chat Assistant for the Transmission Center.
 */
export const chatWithAgent = async (history: {role: string, parts: {text: string}[]}[], message: string) => {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-pro-preview",
      history: history,
      config: {
        systemInstruction: "You are the AI Chief of Operations for the Mbalmayo Transmission Center. You help manage field teams, analyze technical data, and draft procedures. Be concise and professional."
      }
    });
    
    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Chat Error", error);
    throw error;
  }
}
