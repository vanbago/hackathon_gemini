

// @ts-ignore
import { Database } from "bun:sqlite";

declare var Bun: any;

const PORT = 3001;
const DB_PATH = "transmission.db";

// --- DATABASE SETUP (Bun Native SQLite) ---
const db = new Database(DB_PATH, { create: true });

// Enable WAL for performance and concurrency
db.query("PRAGMA journal_mode = WAL;").run();

// Initialize Tables
db.query(`CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, type TEXT, data TEXT)`).run();
db.query(`CREATE TABLE IF NOT EXISTS liaisons (id TEXT PRIMARY KEY, data TEXT)`).run();
db.query(`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, status TEXT, data TEXT)`).run();
db.query(`CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, status TEXT, data TEXT)`).run();
db.query(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, data TEXT)`).run();
// NEW: AI Chat History Table
db.query(`CREATE TABLE IF NOT EXISTS ai_history (id TEXT PRIMARY KEY, data TEXT)`).run();

// Keeping system_logs for audit/debugging
db.query(`CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT, message TEXT, meta TEXT, timestamp DATETIME)`).run();

console.log(`🔌 Database LINKED successfully at: ./${DB_PATH}`);
console.log(`   (All data will be persisted to this file)`);

// --- LOGGING UTILITY ---
const log = (level: string, message: string, meta: any = {}) => {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({ timestamp, level, message, ...meta }));
    try {
        db.query("INSERT INTO system_logs (level, message, meta, timestamp) VALUES ($level, $message, $meta, $timestamp)")
          .run({ $level: level, $message: message, $meta: JSON.stringify(meta), $timestamp: timestamp });
    } catch (e) {
        console.error("Log persist failed", e);
    }
};

// --- CORS HEADERS ---
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// --- HTTP SERVER (Bun.serve) ---
Bun.serve({
    port: PORT,
    async fetch(req: Request) {
        const url = new URL(req.url);
        
        // 1. Handle CORS Preflight
        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // Request Logging
        log('INFO', `Incoming Request`, { method: req.method, path: url.pathname });

        try {
            // --- API ROUTES ---

            // GET /api/state
            if (url.pathname === "/api/state" && req.method === "GET") {
                const sites = db.query("SELECT data FROM sites").all().map((row: any) => JSON.parse(row.data));
                const liaisons = db.query("SELECT data FROM liaisons").all().map((row: any) => JSON.parse(row.data));
                const activities = db.query("SELECT data FROM activities").all().map((row: any) => JSON.parse(row.data));
                const tickets = db.query("SELECT data FROM tickets").all().map((row: any) => JSON.parse(row.data));
                const messages = db.query("SELECT data FROM messages").all().map((row: any) => JSON.parse(row.data));
                const aiHistoryRows = db.query("SELECT data FROM ai_history WHERE id = 'current_session'").all().map((row: any) => JSON.parse(row.data));

                const ctt = sites.find((s: any) => s.id.includes('ctt')) || null;
                const btsStations = sites.filter((s: any) => !s.id.includes('ctt'));
                const aiHistory = aiHistoryRows.length > 0 ? aiHistoryRows[0] : null;

                return Response.json(
                    { ctt, btsStations, liaisons, activities, tickets, messages, aiHistory },
                    { headers: corsHeaders }
                );
            }

            // GET /api/admin/download-db (NEW: BACKUP FEATURE)
            if (url.pathname === "/api/admin/download-db" && req.method === "GET") {
                const file = Bun.file(DB_PATH);
                return new Response(file, {
                    headers: {
                        "Content-Type": "application/x-sqlite3",
                        "Content-Disposition": `attachment; filename="transmission_backup_${Date.now()}.db"`,
                        ...corsHeaders
                    }
                });
            }

            // POST /api/init-defaults
            if (url.pathname === "/api/init-defaults" && req.method === "POST") {
                const body: any = await req.json();
                const { ctt, btsStations, liaisons, activities, tickets } = body;

                // Transaction definition
                const initTransaction = db.transaction(() => {
                    const insertSite = db.prepare("INSERT OR REPLACE INTO sites (id, type, data) VALUES ($id, $type, $data)");
                    const insertLiaison = db.prepare("INSERT OR REPLACE INTO liaisons (id, data) VALUES ($id, $data)");
                    const insertActivity = db.prepare("INSERT OR REPLACE INTO activities (id, status, data) VALUES ($id, $status, $data)");
                    const insertTicket = db.prepare("INSERT OR REPLACE INTO tickets (id, status, data) VALUES ($id, $status, $data)");

                    if (ctt) insertSite.run({ $id: ctt.id, $type: 'CTT', $data: JSON.stringify(ctt) });
                    if (btsStations) btsStations.forEach((b: any) => insertSite.run({ $id: b.id, $type: 'BTS', $data: JSON.stringify(b) }));
                    if (liaisons) liaisons.forEach((l: any) => insertLiaison.run({ $id: l.id, $data: JSON.stringify(l) }));
                    if (activities) activities.forEach((a: any) => insertActivity.run({ $id: a.id, $status: a.status, $data: JSON.stringify(a) }));
                    if (tickets) tickets.forEach((t: any) => insertTicket.run({ $id: t.id, $status: t.status, $data: JSON.stringify(t) }));
                });

                initTransaction();
                log('INFO', 'Database Initialized with Defaults');
                return Response.json({ success: true }, { headers: corsHeaders });
            }

            // POST /api/sites
            if (url.pathname === "/api/sites" && req.method === "POST") {
                const site: any = await req.json();
                if (!site.id) throw new Error("Missing site ID");
                const type = site.id.includes('ctt') ? 'CTT' : 'BTS';
                
                db.query("INSERT OR REPLACE INTO sites (id, type, data) VALUES ($id, $type, $data)")
                  .run({ $id: site.id, $type: type, $data: JSON.stringify(site) });
                
                log('INFO', `Site Saved: ${site.name}`, { id: site.id });
                return Response.json({ success: true }, { headers: corsHeaders });
            }

            // POST /api/liaisons
            if (url.pathname === "/api/liaisons" && req.method === "POST") {
                const liaison: any = await req.json();
                if (!liaison.id) throw new Error("Missing liaison ID");
                
                db.query("INSERT OR REPLACE INTO liaisons (id, data) VALUES ($id, $data)")
                  .run({ $id: liaison.id, $data: JSON.stringify(liaison) });
                  
                log('INFO', `Liaison Saved: ${liaison.name}`, { id: liaison.id });
                return Response.json({ success: true }, { headers: corsHeaders });
            }

            // POST /api/activities
            if (url.pathname === "/api/activities" && req.method === "POST") {
                const activity: any = await req.json();
                if (!activity.id) throw new Error("Missing activity ID");
                
                db.query("INSERT OR REPLACE INTO activities (id, status, data) VALUES ($id, $status, $data)")
                  .run({ $id: activity.id, $status: activity.status, $data: JSON.stringify(activity) });
                
                log('INFO', `Activity Saved: ${activity.title}`, { id: activity.id });
                return Response.json({ success: true }, { headers: corsHeaders });
            }

            // POST /api/tickets
            if (url.pathname === "/api/tickets" && req.method === "POST") {
                const ticket: any = await req.json();
                if (!ticket.id) throw new Error("Missing ticket ID");

                db.query("INSERT OR REPLACE INTO tickets (id, status, data) VALUES ($id, $status, $data)")
                  .run({ $id: ticket.id, $status: ticket.status, $data: JSON.stringify(ticket) });

                log('INFO', `Ticket Saved: ${ticket.title}`, { id: ticket.id });
                return Response.json({ success: true }, { headers: corsHeaders });
            }

            // POST /api/messages
            if (url.pathname === "/api/messages" && req.method === "POST") {
                const message: any = await req.json();
                if (!message.id) throw new Error("Missing message ID");

                db.query("INSERT OR REPLACE INTO messages (id, data) VALUES ($id, $data)")
                  .run({ $id: message.id, $data: JSON.stringify(message) });

                log('INFO', `Message Saved from ${message.sender}`, { id: message.id });
                return Response.json({ success: true }, { headers: corsHeaders });
            }
            
            // POST /api/ai_history
            if (url.pathname === "/api/ai_history" && req.method === "POST") {
                const historyObj: any = await req.json();
                // Ensure ID is current_session for simplicity in this version
                historyObj.id = 'current_session';

                db.query("INSERT OR REPLACE INTO ai_history (id, data) VALUES ($id, $data)")
                  .run({ $id: historyObj.id, $data: JSON.stringify(historyObj) });

                log('INFO', `AI History Updated`, { length: historyObj.history.length });
                return Response.json({ success: true }, { headers: corsHeaders });
            }
            
            // HEAD /api/state (Health Check)
            if (url.pathname === "/api/state" && req.method === "HEAD") {
                return new Response(null, { status: 200, headers: corsHeaders });
            }

            // 404 Not Found
            return new Response("Not Found", { status: 404, headers: corsHeaders });

        } catch (error: any) {
            log('ERROR', 'Request Failed', { error: error.message, stack: error.stack });
            return Response.json(
                { error: "Internal Server Error", details: error.message },
                { status: 500, headers: corsHeaders }
            );
        }
    },
});

console.log(`🚀 Bun Server running on port ${PORT}`);
log('INFO', `Server Started`, { port: PORT, runtime: "Bun" });