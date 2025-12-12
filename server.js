
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, 'transmission.db');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- DATABASE SETUP (SQLite) ---
if (!fs.existsSync(DB_PATH)) {
    console.log("Creating new database file at:", DB_PATH);
    const fd = fs.openSync(DB_PATH, 'w');
    fs.closeSync(fd);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initDb();
    }
});

// Initialize Tables
function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, type TEXT, data TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS liaisons (id TEXT PRIMARY KEY, data TEXT)`); // Stores nested sections/troncons
        db.run(`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, status TEXT, data TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, timestamp DATETIME, data TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, status TEXT, data TEXT)`);
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
app.get('/api/state', async (req, res) => {
    try {
        const [sitesRows, liaisonsRows, activitiesRows, messagesRows, ticketsRows] = await Promise.all([
            getQuery("SELECT data FROM sites"),
            getQuery("SELECT data FROM liaisons"),
            getQuery("SELECT data FROM activities"),
            getQuery("SELECT data FROM messages ORDER BY timestamp ASC"),
            getQuery("SELECT data FROM tickets")
        ]);

        const sites = sitesRows.map(r => JSON.parse(r.data));
        const liaisons = liaisonsRows.map(r => JSON.parse(r.data));
        const activities = activitiesRows.map(r => JSON.parse(r.data));
        const messages = messagesRows.map(r => JSON.parse(r.data));
        const tickets = ticketsRows ? ticketsRows.map(r => JSON.parse(r.data)) : [];

        const ctt = sites.find(s => s.id.includes('ctt')) || null;
        const btsStations = sites.filter(s => !s.id.includes('ctt'));

        res.json({ ctt, btsStations, liaisons, activities, messages, tickets });
    } catch (error) {
        console.error("Error loading state:", error);
        res.status(500).json({ error: "Database error" });
    }
});

// 2. BATCH INIT
app.post('/api/init-defaults', async (req, res) => {
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
                if (err) res.status(500).json({ error: err.message });
                else {
                    stmtSite.finalize(); stmtLiaison.finalize(); stmtAct.finalize(); stmtTicket.finalize();
                    res.json({ success: true });
                }
            });
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 3. PERSISTENCE
app.post('/api/sites', async (req, res) => {
    const site = req.body;
    const type = site.id.includes('ctt') ? 'CTT' : 'BTS';
    try { await runQuery("INSERT OR REPLACE INTO sites (id, type, data) VALUES (?, ?, ?)", [site.id, type, JSON.stringify(site)]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/liaisons', async (req, res) => {
    const liaison = req.body;
    try { await runQuery("INSERT OR REPLACE INTO liaisons (id, data) VALUES (?, ?)", [liaison.id, JSON.stringify(liaison)]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/activities', async (req, res) => {
    const activity = req.body;
    try { await runQuery("INSERT OR REPLACE INTO activities (id, status, data) VALUES (?, ?, ?)", [activity.id, activity.status, JSON.stringify(activity)]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tickets', async (req, res) => {
    const ticket = req.body;
    try { await runQuery("INSERT OR REPLACE INTO tickets (id, status, data) VALUES (?, ?, ?)", [ticket.id, ticket.status, JSON.stringify(ticket)]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages', async (req, res) => {
    const msg = req.body;
    try { await runQuery("INSERT OR REPLACE INTO messages (id, timestamp, data) VALUES (?, ?, ?)", [msg.id, msg.timestamp, JSON.stringify(msg)]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
    console.log(`🚀 Database Server running on http://localhost:${PORT}`);
});
