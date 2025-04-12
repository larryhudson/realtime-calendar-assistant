import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import Database from "better-sqlite3";
import path from "path";
import axios from "axios";
import { z } from "zod";
import fs from "fs";
import crypto from "crypto";

// Event type definition
interface Event {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
}

/**
 * Conversation type definition
 */
interface Conversation {
  id: number;
  title: string;
  created_at: string;
}

// Database setup
const dbPath = path.join(__dirname, "data.sqlite");
const db = new Database(dbPath);

/**
 * Schema: events table for a calendar assistant
 * Plus: evaluation tools tables (conversations, audio_recordings, transcriptions, notes)
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    version_number INTEGER NOT NULL,
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    prompt_version_id INTEGER,
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
  );

  CREATE TABLE IF NOT EXISTS audio_recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audio_recording_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (audio_recording_id) REFERENCES audio_recordings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    author TEXT,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
`);

/**
 * Zod schemas for input validation
 */

// Prompt schemas
const promptSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});
const promptUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});
const promptVersionSchema = z.object({
  text: z.string().min(1).max(8000),
});

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  start_time: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "start_time must be a valid ISO 8601 date string" }
  ),
  end_time: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "end_time must be a valid ISO 8601 date string" }
  ),
});

// Event update schema
const eventUpdateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  start_time: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "start_time must be a valid ISO 8601 date string" }
  ),
  end_time: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "end_time must be a valid ISO 8601 date string" }
  ),
});

/**
 * Zod schemas for conversation validation
 */
const conversationSchema = z.object({
  title: z.string().min(1).max(200),
});

const conversationUpdateSchema = z.object({
  title: z.string().min(1).max(200),
});

 // Hono app setup
const app = new Hono();

// Serve static files from /uploads at /uploads/*
app.use(
  "/uploads/*",
  serveStatic({
    root: "./",
  })
);

/**
 * Prompt endpoints
 */

// List all prompts with latest version info
app.get("/api/prompts", (c) => {
  const prompts = db.prepare(`
    SELECT p.*, v.id as latest_version_id, v.text as latest_text, v.version_number as latest_version_number, v.created_at as latest_version_created_at
    FROM prompts p
    LEFT JOIN (
      SELECT pv1.*
      FROM prompt_versions pv1
      INNER JOIN (
        SELECT prompt_id, MAX(version_number) as max_version
        FROM prompt_versions
        GROUP BY prompt_id
      ) pv2
      ON pv1.prompt_id = pv2.prompt_id AND pv1.version_number = pv2.max_version
    ) v ON p.id = v.prompt_id
    ORDER BY p.created_at DESC
  `).all() as any[];
  return c.json(prompts);
});

// Create a new prompt (and initial version)
app.post("/api/prompts", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parseResult = promptSchema.extend({ text: z.string().min(1).max(8000) }).safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: "Validation failed", details: parseResult.error.flatten() }, 400);
  }
  const { name, description, text } = parseResult.data;
  const promptStmt = db.prepare(
    "INSERT INTO prompts (name, description) VALUES (?, ?)"
  );
  const promptInfo = promptStmt.run(name, description || null);
  const promptId = promptInfo.lastInsertRowid;
  const versionStmt = db.prepare(
    "INSERT INTO prompt_versions (prompt_id, text, version_number) VALUES (?, ?, ?)"
  );
  versionStmt.run(promptId, text, 1);
  const prompt = db.prepare("SELECT * FROM prompts WHERE id = ?").get(promptId) as Record<string, any> | undefined;
  return c.json(prompt ?? {}, 201);
});

// Get a prompt and all its versions
app.get("/api/prompts/:id", (c) => {
  const id = Number(c.req.param("id"));
  const prompt = db.prepare("SELECT * FROM prompts WHERE id = ?").get(id) as Record<string, any> | undefined;
  if (!prompt) {
    return c.json({ error: "Prompt not found" }, 404);
  }
  const versions = db.prepare(
    "SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version_number ASC"
  ).all(id) as any[];
  return c.json({ ...prompt, versions });
});

// Update prompt metadata
app.put("/api/prompts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parseResult = promptUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: "Validation failed", details: parseResult.error.flatten() }, 400);
  }
  const { name, description } = parseResult.data;
  const stmt = db.prepare(
    "UPDATE prompts SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = datetime('now') WHERE id = ?"
  );
  const info = stmt.run(name, description, id);
  if (info.changes === 0) {
    return c.json({ error: "Prompt not found or no changes made" }, 404);
  }
  const prompt = db.prepare("SELECT * FROM prompts WHERE id = ?").get(id) as Record<string, any> | undefined;
  return c.json(prompt ?? {});
});

// Add a new version to a prompt
app.post("/api/prompts/:id/versions", async (c) => {
  const id = Number(c.req.param("id"));
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parseResult = promptVersionSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: "Validation failed", details: parseResult.error.flatten() }, 400);
  }
  const { text } = parseResult.data;
  // Get latest version number
  const latest = db.prepare(
    "SELECT MAX(version_number) as max_version FROM prompt_versions WHERE prompt_id = ?"
  ).get(id) as { max_version?: number } | undefined;
  const nextVersion = (latest?.max_version || 0) + 1;
  const stmt = db.prepare(
    "INSERT INTO prompt_versions (prompt_id, text, version_number) VALUES (?, ?, ?)"
  );
  const info = stmt.run(id, text, nextVersion);
  const version = db.prepare("SELECT * FROM prompt_versions WHERE id = ?").get(info.lastInsertRowid) as Record<string, any> | undefined;
  return c.json(version ?? {}, 201);
});

// List all versions for a prompt
app.get("/api/prompts/:id/versions", (c) => {
  const id = Number(c.req.param("id"));
  const versions = db.prepare(
    "SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version_number ASC"
  ).all(id) as any[];
  return c.json(versions);
});

// Get the prompt version used for a conversation
app.get("/api/conversations/:id/prompt", (c) => {
  const id = Number(c.req.param("id"));
  const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Record<string, any> | undefined;
  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }
  if (!conv.prompt_version_id) {
    return c.json({ error: "No prompt version linked to this conversation" }, 404);
  }
  const version = db.prepare("SELECT * FROM prompt_versions WHERE id = ?").get(conv.prompt_version_id) as Record<string, any> | undefined;
  if (!version) {
    return c.json({ error: "Prompt version not found" }, 404);
  }
  const prompt = db.prepare("SELECT * FROM prompts WHERE id = ?").get(version.prompt_id) as Record<string, any> | undefined;
  return c.json({ ...(prompt ?? {}), version });
});

// Health check endpoint
// Health check endpoint
app.get("/api/health", (c) => c.json({ status: "ok" }));

/**
 * Conversation endpoints
 */

// Get all conversations
app.get("/api/conversations", (c) => {
  const conversations = db.prepare("SELECT * FROM conversations ORDER BY created_at DESC").all() as Conversation[];
  return c.json(conversations);
});

// Create a new conversation
app.post("/api/conversations", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  // Accept optional prompt_version_id
  const extendedSchema = conversationSchema.extend({
    prompt_version_id: z.number().int().optional(),
  });
  const parseResult = extendedSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      400
    );
  }
  const { title, prompt_version_id } = parseResult.data;
  let stmt, info;
  if (prompt_version_id) {
    stmt = db.prepare(
      "INSERT INTO conversations (title, prompt_version_id) VALUES (?, ?)"
    );
    info = stmt.run(title, prompt_version_id);
  } else {
    stmt = db.prepare(
      "INSERT INTO conversations (title) VALUES (?)"
    );
    info = stmt.run(title);
  }
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(info.lastInsertRowid) as Conversation;
  return c.json(conversation, 201);
});

// Get a single conversation by ID
app.get("/api/conversations/:id", (c) => {
  const id = Number(c.req.param("id"));
  // Join with prompt_versions and prompts if prompt_version_id is set
  const conversation = db.prepare(`
    SELECT c.*, 
      p.name as prompt_name, 
      v.text as prompt_text
    FROM conversations c
    LEFT JOIN prompt_versions v ON c.prompt_version_id = v.id
    LEFT JOIN prompts p ON v.prompt_id = p.id
    WHERE c.id = ?
  `).get(id) as (Conversation & { prompt_name?: string; prompt_text?: string }) | undefined;
  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }
  return c.json(conversation);
});

// Update a conversation
app.put("/api/conversations/:id", async (c) => {
  const id = Number(c.req.param("id"));
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parseResult = conversationUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      400
    );
  }
  const { title } = parseResult.data;
  const stmt = db.prepare(
    "UPDATE conversations SET title = ? WHERE id = ?"
  );
  const info = stmt.run(title, id);
  if (info.changes === 0) {
    return c.json({ error: "Conversation not found or no changes made" }, 404);
  }
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation;
  return c.json(conversation);
});

// Delete a conversation
app.delete("/api/conversations/:id", (c) => {
  const id = Number(c.req.param("id"));
  const stmt = db.prepare("DELETE FROM conversations WHERE id = ?");
  const info = stmt.run(id);
  if (info.changes === 0) {
    return c.json({ error: "Conversation not found" }, 404);
  }
  return c.json({ success: true });
});


/**
 * Audio recording endpoints
 */

// POST /api/conversations/:conversationId/audio - upload audio file
app.post("/api/conversations/:conversationId/audio", async (c) => {
  const conversationId = Number(c.req.param("conversationId"));
  // Check if conversation exists
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string") {
    return c.json({ error: "No file uploaded" }, 400);
  }

  // Generate unique filename
  const ext = file.name ? file.name.split(".").pop() : "wav";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const uploadPath = path.join(__dirname, "uploads", filename);

  // Save file to disk
  const arrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(uploadPath, Buffer.from(arrayBuffer));

  // Insert into audio_recordings table
  const stmt = db.prepare(
    "INSERT INTO audio_recordings (conversation_id, file_path) VALUES (?, ?)"
  );
  const info = stmt.run(conversationId, filename);
  const audioRecording = db.prepare("SELECT * FROM audio_recordings WHERE id = ?").get(info.lastInsertRowid) as {
    id: number;
    conversation_id: number;
    file_path: string;
    created_at: string;
  };

  return c.json({
    id: audioRecording.id,
    conversation_id: audioRecording.conversation_id,
    file_path: audioRecording.file_path,
    created_at: audioRecording.created_at,
  }, 201);
});

// GET /api/conversations/:conversationId/audio - list audio recordings for a conversation
app.get("/api/conversations/:conversationId/audio", (c) => {
  const conversationId = Number(c.req.param("conversationId"));
  // Check if conversation exists
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }
  const recordings = db.prepare(
    "SELECT id, conversation_id, file_path, created_at FROM audio_recordings WHERE conversation_id = ? ORDER BY created_at DESC"
  ).all(conversationId) as {
    id: number;
    conversation_id: number;
    file_path: string;
    created_at: string;
  }[];
  // Add url property to each recording
  const withUrls = recordings.map((rec) => ({
    ...rec,
    url: `/uploads/${rec.file_path}`,
  }));
  return c.json(withUrls);
});

// GET /api/conversations/:conversationId/transcriptions - list transcriptions for a conversation
app.get("/api/conversations/:conversationId/transcriptions", (c) => {
  const conversationId = Number(c.req.param("conversationId"));
  // Check if conversation exists
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }
  // Get all transcriptions for audio_recordings belonging to this conversation
  const transcriptions = db.prepare(
    `SELECT t.id, t.audio_recording_id, t.text, t.created_at
     FROM transcriptions t
     JOIN audio_recordings a ON t.audio_recording_id = a.id
     WHERE a.conversation_id = ?
     ORDER BY t.created_at DESC`
  ).all(conversationId) as {
    id: number;
    audio_recording_id: number;
    text: string;
    created_at: string;
  }[];
  return c.json(transcriptions);
});

/**
 * Notes endpoints
 */

// GET /api/conversations/:conversationId/notes - list notes for a conversation
app.get("/api/conversations/:conversationId/notes", (c) => {
  const conversationId = Number(c.req.param("conversationId"));
  // Check if conversation exists
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }
  const notes = db.prepare(
    `SELECT id, author, content, timestamp
     FROM notes
     WHERE conversation_id = ?
     ORDER BY timestamp ASC`
  ).all(conversationId) as {
    id: number;
    author: string | null;
    content: string;
    timestamp: string;
  }[];
  return c.json(notes);
});

// POST /api/conversations/:conversationId/notes - add a note to a conversation
app.post("/api/conversations/:conversationId/notes", async (c) => {
  const conversationId = Number(c.req.param("conversationId"));
  // Check if conversation exists
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  // Validate input
  const noteSchema = z.object({
    content: z.string().min(1).max(2000),
    timestamp: z.string().min(1), // ISO string or seconds as string
    author: z.string().max(100).optional(),
  });
  const parseResult = noteSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      400
    );
  }
  const { content, timestamp, author } = parseResult.data;
  const stmt = db.prepare(
    "INSERT INTO notes (conversation_id, author, content, timestamp) VALUES (?, ?, ?, ?)"
  );
  const info = stmt.run(conversationId, author || null, content, timestamp);
  const note = db.prepare(
    "SELECT id, author, content, timestamp FROM notes WHERE id = ?"
  ).get(info.lastInsertRowid) as {
    id: number;
    author: string | null;
    content: string;
    timestamp: string;
  };
  return c.json(note, 201);
});

// Get all events
app.get("/api/events", (c) => {
  const events = db.prepare("SELECT * FROM events").all() as Event[];
  return c.json(events);
});

// Create a new event
app.post("/api/events", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parseResult = eventSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      400
    );
  }
  const { title, description, start_time, end_time } = parseResult.data;
  const stmt = db.prepare(
    "INSERT INTO events (title, description, start_time, end_time) VALUES (?, ?, ?, ?)"
  );
  const info = stmt.run(title, description || "", start_time, end_time);
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(info.lastInsertRowid) as Event;
  return c.json(event, 201);
});

// Get a single event by ID
app.get("/api/events/:id", (c) => {
  const id = Number(c.req.param("id"));
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id) as Event | undefined;
  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }
  return c.json(event);
});

// Update an event
app.put("/api/events/:id", async (c) => {
  const id = Number(c.req.param("id"));
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parseResult = eventUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      400
    );
  }
  const { title, description, start_time, end_time } = parseResult.data;
  const stmt = db.prepare(
    "UPDATE events SET title = ?, description = ?, start_time = ?, end_time = ? WHERE id = ?"
  );
  const info = stmt.run(title, description || "", start_time, end_time, id);
  if (info.changes === 0) {
    return c.json({ error: "Event not found or no changes made" }, 404);
  }
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id) as Event;
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

/**
 * OpenAI Realtime API - Mint ephemeral session token
 * Returns ephemeral key for frontend to use with WebRTC.
 * Requires process.env.OPENAI_API_KEY to be set.
 */
app.get("/api/openai/session", async (c) => {
  // Accept model as a URL parameter, validate, and use in OpenAI API request
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return c.json({ error: "OpenAI API key not configured" }, 500);
  }

  // Allowed models
  const allowedModels = [
    "gpt-4o-realtime-preview-2024-12-17",
    "gpt-4o-mini-realtime-preview-2024-12-17"
  ];

  const modelParam = c.req.query("model");
  let model: string;

  if (modelParam) {
    if (!allowedModels.includes(modelParam)) {
      return c.json({
        error: "Invalid model parameter",
        allowedModels
      }, 400);
    }
    model = modelParam;
  } else {
    model = "gpt-4o-realtime-preview-2024-12-17";
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/realtime/sessions",
      {
        model,
        voice: "verse"
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return c.json(response.data);
  } catch (error: any) {
    const msg = error?.response?.data || error?.message || "Unknown error";
    return c.json({ error: "Failed to mint ephemeral OpenAI session", details: msg }, 500);
  }
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
