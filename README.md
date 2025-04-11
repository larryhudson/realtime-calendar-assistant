# Realtime Calendar Assistant

A full-stack calendar assistant project with a modern React frontend and a lightweight Node.js backend.

---

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Adobe React Spectrum, React Aria/Stately
- **Backend:** Hono (Node.js web framework), better-sqlite3, TypeScript

---

## Features

- Modern UI built with React Spectrum components
- Backend REST API for calendar event management (CRUD)
- Persistent storage using SQLite
- (Planned) Real-time LLM-powered assistant features

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm

---

### 1. Clone the repository

```bash
git clone https://github.com/larryhudson/realtime-calendar-assistant.git
cd realtime-calendar-assistant
```

---

### 2. Install dependencies

#### Frontend

```bash
cd frontend
npm install
```

#### Backend

```bash
cd ../backend
npm install
```

---

### 3. Running the Application

#### Start the Backend

The backend is written in TypeScript and uses [Hono](https://hono.dev/) with SQLite for storage.

> **Note:** There is currently no build or start script. Run the backend using `ts-node`:

```bash
npx ts-node index.ts
```

- The backend server will start on [http://localhost:3001](http://localhost:3001) by default.
- A SQLite database file (`data.sqlite`) will be created in the backend directory.

#### Start the Frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

- The frontend will start on [http://localhost:5173](http://localhost:5173) by default.

---

## API Endpoints

The backend exposes the following REST API endpoints for event management:

- `GET    /api/events`         — List all events
- `POST   /api/events`         — Create a new event
- `GET    /api/events/:id`     — Get a single event by ID
- `PUT    /api/events/:id`     — Update an event
- `DELETE /api/events/:id`     — Delete an event
- `GET    /api/health`         — Health check

---

## Development Notes

- The frontend is currently a demo UI and does **not** yet connect to the backend API.
- Linting: `npm run lint` (frontend)
- Testing: `npm run test` (frontend, uses Vitest)
- Backend is TypeScript, but currently run directly with `ts-node`.

---

## Roadmap

- [ ] Connect frontend to backend API for event management
- [ ] Add authentication and user management
- [ ] Integrate OpenAI LLM for real-time assistant features
- [ ] Improve documentation and usage examples

---

## License

MIT
