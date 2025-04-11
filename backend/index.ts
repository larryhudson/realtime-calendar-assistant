import { Hono } from "hono";
import { serve } from "@hono/node-server";
import Database from "better-sqlite3";
import path from "path";

// Event type definition
interface Event {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
}

// Database setup
const dbPath = path.join(__dirname, "data.sqlite");
const db = new Database(dbPath);

// Example schema: events table for a calendar assistant
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
  );
`);

// Hono app setup
const app = new Hono();

// Health check endpoint
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Get all events
app.get("/api/events", (c) => {
  const events: Event[] = db.prepare("SELECT * FROM events").all();
  return c.json(events);
});

// Create a new event
app.post("/api/events", async (c) => {
  const body = await c.req.json();
  const { title, description, start_time, end_time } = body as Partial<Event>;
  if (!title || !start_time || !end_time) {
    return c.json({ error: "Missing required fields" }, 400);
  }
  const stmt = db.prepare(
    "INSERT INTO events (title, description, start_time, end_time) VALUES (?, ?, ?, ?)"
  );
  const info = stmt.run(title, description || "", start_time, end_time);
  const event: Event = db.prepare("SELECT * FROM events WHERE id = ?").get(info.lastInsertRowid);
  return c.json(event, 201);
});

// Get a single event by ID
app.get("/api/events/:id", (c) => {
  const id = Number(c.req.param("id"));
  const event: Event | undefined = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }
  return c.json(event);
});

// Update an event
app.put("/api/events/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { title, description, start_time, end_time } = body as Partial<Event>;
  const stmt = db.prepare(
    "UPDATE events SET title = ?, description = ?, start_time = ?, end_time = ? WHERE id = ?"
  );
  const info = stmt.run(title, description || "", start_time, end_time, id);
  if (info.changes === 0) {
    return c.json({ error: "Event not found or no changes made" }, 404);
  }
  const event: Event = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  return c.json(event);
});

// Delete an event
app.delete("/api/events/:id", (c) => {
  const id = Number(c.req.param("id"));
  const stmt = db.prepare("DELETE FROM events WHERE id = ?");
  const info = stmt.run(id);
  if (info.changes === 0) {
    return c.json({ error: "Event not found" }, 404);
  }
  return c.json({ success: true });
});

// Start the server
const port = Number(process.env.PORT) || 3001;
serve(
  {
    fetch: app.fetch,
    port,
  },
  () => {
    console.log(`Hono server running on http://localhost:${port}`);
  }
);
