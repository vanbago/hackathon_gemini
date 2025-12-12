
import { Activity, Bts, Ctt, Liaison, ChatMessage, Ticket } from "../types";

const API_URL = "http://localhost:3001/api";
const LOCAL_STORAGE_KEY = "transmission_db_v1";

// --- LOCAL STORAGE HELPERS (FALLBACK DB) ---

const getLocalDb = () => {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : { sites: [], liaisons: [], activities: [], messages: [], tickets: [] };
    } catch (e) {
        return { sites: [], liaisons: [], activities: [], messages: [], tickets: [] };
    }
};

const saveLocalDb = (data: any) => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) { console.error("Local Save Error", e); }
};

const updateLocalItem = (collection: string, item: any) => {
    const db = getLocalDb();
    if (!db[collection]) db[collection] = [];
    
    const index = db[collection].findIndex((i: any) => i.id === item.id);
    if (index >= 0) {
        db[collection][index] = item;
    } else {
        db[collection].push(item);
    }
    saveLocalDb(db);
};

// --- API SERVICE ---

export const apiService = {
    // Check if backend is alive
    checkHealth: async (): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}/state`, { method: 'HEAD' });
            return res.ok;
        } catch (e) {
            // console.warn("Backend offline, using LocalStorage.");
            return false;
        }
    },

    // Load full application state (Try Remote -> Fallback Local)
    loadFullState: async () => {
        // 1. Try Remote
        try {
            const response = await fetch(`${API_URL}/state`);
            if (response.ok) {
                const data = await response.json();
                // Sync Remote to Local for next offline usage
                const localFormat = {
                    sites: [...(data.btsStations || []), ...(data.ctt ? [data.ctt] : [])],
                    liaisons: data.liaisons || [],
                    activities: data.activities || [],
                    messages: data.messages || [],
                    tickets: data.tickets || []
                };
                saveLocalDb(localFormat);
                return data;
            }
        } catch (error) {
            // Ignored, proceed to fallback
        }

        // 2. Fallback to LocalStorage
        console.log("Loading state from LocalStorage (Offline Mode)");
        const localData = getLocalDb();
        
        // Transform Local DB format to App State format
        const ctt = localData.sites?.find((s: any) => s.id.includes('ctt')) || null;
        const btsStations = localData.sites?.filter((s: any) => !s.id.includes('ctt')) || [];
        
        // Check if local data is effectively empty
        if (!ctt && btsStations.length === 0 && localData.liaisons.length === 0) {
            return null; // Return null to trigger Default Initialization in Dashboard
        }

        return {
            ctt,
            btsStations,
            liaisons: localData.liaisons || [],
            activities: localData.activities || [],
            messages: localData.messages || [],
            tickets: localData.tickets || []
        };
    },

    // Initialize defaults if DB is empty (Remote & Local)
    initializeDefaults: async (data: any) => {
        // 1. Init Remote
        try {
            await fetch(`${API_URL}/init-defaults`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            // Ignored
        }

        // 2. Init Local
        const localFormat = {
            sites: [...data.btsStations, ...(data.ctt ? [data.ctt] : [])],
            liaisons: data.liaisons,
            activities: data.activities,
            messages: [],
            tickets: data.tickets
        };
        saveLocalDb(localFormat);
    },

    // --- PERSISTENCE METHODS (Hybrid: Try Remote, Always Save Local) ---

    saveSite: async (site: Bts | Ctt) => {
        updateLocalItem('sites', site); // Always save local first for speed
        try {
            return await fetch(`${API_URL}/sites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(site)
            });
        } catch (e) { return null; }
    },

    saveLiaison: async (liaison: Liaison) => {
        updateLocalItem('liaisons', liaison);
        try {
            return await fetch(`${API_URL}/liaisons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(liaison)
            });
        } catch (e) { return null; }
    },

    saveActivity: async (activity: Activity) => {
        updateLocalItem('activities', activity);
        try {
            return await fetch(`${API_URL}/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activity)
            });
        } catch (e) { return null; }
    },

    saveTicket: async (ticket: Ticket) => {
        updateLocalItem('tickets', ticket);
        try {
            return await fetch(`${API_URL}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ticket)
            });
        } catch (e) { return null; }
    },

    saveMessage: async (message: ChatMessage) => {
        updateLocalItem('messages', message);
        try {
            return await fetch(`${API_URL}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
        } catch (e) { return null; }
    }
};
