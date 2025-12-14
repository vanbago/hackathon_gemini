
import { Activity, Bts, Ctt, Liaison, ChatMessage, Ticket } from "../types";

const API_URL = "http://localhost:3001/api";
const LOCAL_STORAGE_KEY = "transmission_db_v1";

// --- EVENT SYSTEM FOR STORAGE MONITORING ---
type TransactionStatus = 'PENDING' | 'SUCCESS' | 'ERROR' | 'OFFLINE_SYNC';

export interface StorageTransaction {
    id: string;
    entity: string; // 'LIAISON', 'SITE', etc.
    name: string;
    action: 'SAVE' | 'LOAD';
    status: TransactionStatus;
    timestamp: number;
    duration?: number;
}

type TransactionListener = (transaction: StorageTransaction) => void;
const listeners: TransactionListener[] = [];

export const subscribeToStorageEvents = (listener: TransactionListener) => {
    listeners.push(listener);
    return () => {
        const idx = listeners.indexOf(listener);
        if (idx > -1) listeners.splice(idx, 1);
    };
};

const notifyTransaction = (t: StorageTransaction) => {
    listeners.forEach(l => l(t));
};

// Helper to wrap API calls with monitoring
const monitoredRequest = async (entity: string, name: string, requestFn: () => Promise<any>): Promise<any> => {
    const txId = Math.random().toString(36).substr(2, 9);
    const start = Date.now();
    
    // Notify Start
    notifyTransaction({
        id: txId, entity, name, action: 'SAVE', status: 'PENDING', timestamp: start
    });

    try {
        const result = await requestFn();
        const duration = Date.now() - start;
        
        // Notify Success
        notifyTransaction({
            id: txId, entity, name, action: 'SAVE', status: result.offline ? 'OFFLINE_SYNC' : 'SUCCESS', timestamp: Date.now(), duration
        });
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        // Notify Error
        notifyTransaction({
            id: txId, entity, name, action: 'SAVE', status: 'ERROR', timestamp: Date.now(), duration
        });
        throw error;
    }
};


// --- LOCAL STORAGE HELPERS ---

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
    subscribeToStorageEvents,

    checkHealth: async (): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}/state`, { method: 'HEAD' });
            return res.ok;
        } catch (e) {
            return false;
        }
    },

    loadFullState: async () => {
        // Monitored Load
        const txId = 'load-init';
        notifyTransaction({ id: txId, entity: 'DATABASE', name: 'Initial Load', action: 'LOAD', status: 'PENDING', timestamp: Date.now() });
        
        try {
            const response = await fetch(`${API_URL}/state`);
            if (response.ok) {
                const data = await response.json();
                const localFormat = {
                    sites: [...(data.btsStations || []), ...(data.ctt ? [data.ctt] : [])],
                    liaisons: data.liaisons || [],
                    activities: data.activities || [],
                    messages: data.messages || [],
                    tickets: data.tickets || []
                };
                saveLocalDb(localFormat);
                notifyTransaction({ id: txId, entity: 'DATABASE', name: 'Initial Load', action: 'LOAD', status: 'SUCCESS', timestamp: Date.now() });
                return data;
            }
        } catch (error) {}

        console.log("Loading state from LocalStorage (Offline Mode)");
        const localData = getLocalDb();
        
        notifyTransaction({ id: txId, entity: 'DATABASE', name: 'Initial Load (Offline)', action: 'LOAD', status: 'OFFLINE_SYNC', timestamp: Date.now() });

        const ctt = localData.sites?.find((s: any) => s.id.includes('ctt')) || null;
        const btsStations = localData.sites?.filter((s: any) => !s.id.includes('ctt')) || [];
        
        if (!ctt && btsStations.length === 0 && localData.liaisons.length === 0) {
            return null;
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

    initializeDefaults: async (data: any) => {
        try {
            await fetch(`${API_URL}/init-defaults`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {}
        
        const localFormat = {
            sites: [...data.btsStations, ...(data.ctt ? [data.ctt] : [])],
            liaisons: data.liaisons,
            activities: data.activities,
            messages: [],
            tickets: data.tickets
        };
        saveLocalDb(localFormat);
    },

    // --- MONITORED PERSISTENCE METHODS ---

    saveSite: async (site: Bts | Ctt) => {
        return monitoredRequest('SITE', site.name, async () => {
            updateLocalItem('sites', site);
            try {
                const res = await fetch(`${API_URL}/sites`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(site)
                });
                return res.ok ? await res.json() : { success: true, offline: true };
            } catch (e) { return { success: true, offline: true }; }
        });
    },

    saveLiaison: async (liaison: Liaison) => {
        return monitoredRequest('LIAISON', liaison.name, async () => {
            updateLocalItem('liaisons', liaison);
            try {
                const res = await fetch(`${API_URL}/liaisons`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(liaison)
                });
                return res.ok ? await res.json() : { success: true, offline: true };
            } catch (e) { return { success: true, offline: true }; }
        });
    },

    saveActivity: async (activity: Activity) => {
        return monitoredRequest('ACTIVITY', activity.title, async () => {
            updateLocalItem('activities', activity);
            try {
                const res = await fetch(`${API_URL}/activities`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(activity)
                });
                return res.ok ? await res.json() : { success: true, offline: true };
            } catch (e) { return { success: true, offline: true }; }
        });
    },

    saveTicket: async (ticket: Ticket) => {
        return monitoredRequest('TICKET', ticket.title, async () => {
            updateLocalItem('tickets', ticket);
            try {
                const res = await fetch(`${API_URL}/tickets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ticket)
                });
                return res.ok ? await res.json() : { success: true, offline: true };
            } catch (e) { return { success: true, offline: true }; }
        });
    },

    saveMessage: async (message: ChatMessage) => {
        return monitoredRequest('MESSAGE', 'Chat Log', async () => {
            updateLocalItem('messages', message);
            try {
                const res = await fetch(`${API_URL}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message)
                });
                return res.ok ? await res.json() : { success: true, offline: true };
            } catch (e) { return { success: true, offline: true }; }
        });
    }
};
