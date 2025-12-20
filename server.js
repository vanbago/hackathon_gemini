

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;
// Resolve DB path relative to current execution context
const DB_PATH = path.join(process.cwd(), 'transmission.db');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- LOGGING UTILITY ---
const log = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({ timestamp, level, message, ...meta }));
    // Persist log to DB if DB is ready
    if(db) {
        db.run("INSERT INTO system_logs (level, message, meta, timestamp) VALUES (?, ?, ?, ?)", 
            [level, message, JSON.stringify(meta), timestamp], (err) => {
                if(err) console.error("Log persist failed", err);
            });
    }
};

// Request Logger Middleware
app.use((req, res, next) => {
    log('INFO', `Incoming Request`, { method: req.method, url: req.url });
    next();
});

// --- DATABASE SETUP (SQLite) ---
if (!fs.existsSync(DB_PATH)) {
    console.log("Creating new database file at", DB_PATH);
    const fd = fs.openSync(DB_PATH, 'w');
    fs.closeSync(fd);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log(`Connected to SQLite database at ${DB_PATH}`);
        initDb();
    }
});

// Initialize Tables
function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, type TEXT, data TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS liaisons (id TEXT PRIMARY KEY, data TEXT)`); 
        db.run(`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, status TEXT, data TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, status TEXT, data TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, data TEXT)`);
        // NEW: AI History
        db.run(`CREATE TABLE IF NOT EXISTS ai_history (id TEXT PRIMARY KEY, data TEXT)`);
        // NEW: Audit Log Table
        db.run(`CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT, message TEXT, meta TEXT, timestamp DATETIME)`);
    });
}

// --- HELPER FUNCTIONS ---
const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err); else resolve(this);
        });
    });
};

const getQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

// --- API ROUTES ---

// 1. GET INITIAL STATE
app.get('/api/state', async (req, res, next) => {
    try {
        const [sitesRows, liaisonsRows, activitiesRows, ticketsRows, messagesRows, aiHistoryRows] = await Promise.all([
            getQuery("SELECT data FROM sites"),
            getQuery("SELECT data FROM liaisons"),
            getQuery("SELECT data FROM activities"),
            getQuery("SELECT data FROM tickets"),
            getQuery("SELECT data FROM messages"),
            getQuery("SELECT data FROM ai_history WHERE id = 'current_session'")
        ]);

        const sites = sitesRows.map(r => JSON.parse(r.data));
        const liaisons = liaisonsRows.map(r => JSON.parse(r.data));
        const activities = activitiesRows.map(r => JSON.parse(r.data));
        const tickets = ticketsRows ? ticketsRows.map(r => JSON.parse(r.data)) : [];
        const messages = messagesRows ? messagesRows.map(r => JSON.parse(r.data)) : [];
        const aiHistory = aiHistoryRows && aiHistoryRows.length > 0 ? JSON.parse(aiHistoryRows[0].data) : null;

        const ctt = sites.find(s => s.id.includes('ctt')) || null;
        const btsStations = sites.filter(s => !s.id.includes('ctt'));

        res.json({ ctt, btsStations, liaisons, activities, tickets, messages, aiHistory });
    } catch (error) {
        next(error);
    }
});

// 2. DOWNLOAD DB BACKUP
app.get('/api/admin/download-db', (req, res) => {
    res.download(DB_PATH, `transmission_backup_${Date.now()}.db`);
});

// 3. BATCH INIT
app.post('/api/init-defaults', async (req, res, next) => {
    const { ctt, btsStations, liaisons, activities, tickets } = req.body;
    try {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmtSite = db.prepare("INSERT OR REPLACE INTO sites (id, type, data) VALUES (?, ?, ?)");
            const stmtLiaison = db.prepare("INSERT OR REPLACE INTO liaisons (id, data) VALUES (?, ?)");
            const stmtAct = db.prepare("INSERT OR REPLACE INTO activities (id, status, data) VALUES (?, ?, ?)");
            const stmtTicket = db.prepare("INSERT OR REPLACE INTO tickets (id, status, data) VALUES (?, ?, ?)");

            if (ctt) stmtSite.run(ctt.id, 'CTT', JSON.stringify(ctt));
            if (btsStations) btsStations.forEach(b => stmtSite.run(b.id, 'BTS', JSON.stringify(b)));
            if (liaisons) liaisons.forEach(l => stmtLiaison.run(l.id, JSON.stringify(l)));
            if (activities) activities.forEach(a => stmtAct.run(a.id, a.status, JSON.stringify(a)));
            if (tickets) tickets.forEach(t => stmtTicket.run(t.id, t.status, JSON.stringify(t)));

            db.run("COMMIT", (err) => {
                if (err) {
                    log('ERROR', 'Transaction Commit Failed', { error: err.message });
                    next(err);
                } else {
                    stmtSite.finalize(); stmtLiaison.finalize(); stmtAct.finalize(); stmtTicket.finalize();
                    log('INFO', 'Database Initialized with Defaults');
                    res.json({ success: true });
                }
            });
        });
    } catch (error) { next(error); }
});

// 4. PERSISTENCE
app.post('/api/sites', async (req, res, next) => {
    const site = req.body;
    if (!site.id) return res.status(400).json({ error: "Missing site ID" });
    const type = site.id.includes('ctt') ? 'CTT' : 'BTS';
    try { 
        await runQuery("INSERT OR REPLACE INTO sites (id, type, data) VALUES (?, ?, ?)", [site.id, type, JSON.stringify(site)]); 
        log('INFO', `Site Saved: ${site.name}`, { id: site.id });
        res.json({ success: true }); 
    } catch (e) { next(e); }
});

app.post('/api/liaisons', async (req, res, next) => {
    const liaison = req.body;
    if (!liaison.id) return res.status(400).json({ error: "Missing liaison ID" });
    try { 
        await runQuery("INSERT OR REPLACE INTO liaisons (id, data) VALUES (?, ?)", [liaison.id, JSON.stringify(liaison)]); 
        log('INFO', `Liaison Saved: ${liaison.name}`, { id: liaison.id, sections: liaison.sections?.length });
        res.json({ success: true }); 
    } catch (e) { next(e); }
});

app.post('/api/activities', async (req, res, next) => {
    const activity = req.body;
    if (!activity.id) return res.status(400).json({ error: "Missing activity ID" });
    try { 
        await runQuery("INSERT OR REPLACE INTO activities (id, status, data) VALUES (?, ?, ?)", [activity.id, activity.status, JSON.stringify(activity)]); 
        log('INFO', `Activity Saved: ${activity.title}`, { id: activity.id });
        res.json({ success: true }); 
    } catch (e) { next(e); }
});

app.post('/api/tickets', async (req, res, next) => {
    const ticket = req.body;
    if (!ticket.id) return res.status(400).json({ error: "Missing ticket ID" });
    try { 
        await runQuery("INSERT OR REPLACE INTO tickets (id, status, data) VALUES (?, ?, ?)", [ticket.id, ticket.status, JSON.stringify(ticket)]); 
        log('INFO', `Ticket Saved: ${ticket.title}`, { id: ticket.id, status: ticket.status });
        res.json({ success: true }); 
    } catch (e) { next(e); }
});

app.post('/api/messages', async (req, res, next) => {
    const message = req.body;
    if (!message.id) return res.status(400).json({ error: "Missing message ID" });
    try { 
        await runQuery("INSERT OR REPLACE INTO messages (id, data) VALUES (?, ?)", [message.id, JSON.stringify(message)]); 
        log('INFO', `Message Saved from ${message.sender}`, { id: message.id });
        res.json({ success: true }); 
    } catch (e) { next(e); }
});

app.post('/api/ai_history', async (req, res, next) => {
    const historyObj = req.body;
    historyObj.id = 'current_session';
    try {
        await runQuery("INSERT OR REPLACE INTO ai_history (id, data) VALUES (?, ?)", [historyObj.id, JSON.stringify(historyObj)]);
        log('INFO', `AI History Updated`, { length: historyObj.history.length });
        res.json({ success: true });
    } catch (e) { next(e); }
});

// Centralized Error Handler
app.use((err, req, res, next) => {
    log('ERROR', 'Unhandled Error', { error: err.message, stack: err.stack, url: req.url });
    res.status(500).json({ 
        error: "Internal Server Error", 
        details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

app.listen(PORT, () => {
    console.log(`Node Server running on port ${PORT}`);
    log('INFO', `Server Started`, { port: PORT, runtime: "Node" });
});