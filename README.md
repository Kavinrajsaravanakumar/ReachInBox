# ReachInBox — Distributed Email Scheduler

A production-grade, distributed email scheduling system with Google OAuth, BullMQ delayed queues, Redis atomic rate limiting, full-text Elasticsearch indexing, and Slack alert notifications.

---

## 📁 Project Architecture

The repository is organized into a clean, decoupled backend and frontend structure:

```
ReachInBox/
├── backend/                  # Node.js + Express + BullMQ + Drizzle ORM + Elasticsearch
│   ├── src/                  # Clean 3-layer architecture (routes, controllers, services, queues, workers)
│   ├── drizzle/              # Database migrations
│   ├── scripts/              # Verification, backfill, and test scripts
│   ├── postman/              # Postman API test collection
│   ├── docker-compose.yml    # PostgreSQL, Redis, Elasticsearch services
│   ├── package.json
│   └── README.md             # Detailed backend architecture, queue semantics, & rate-limiting notes
│
├── frontend/                 # Next.js 14 + TailwindCSS + App Router dashboard
│   ├── src/                  # Modular components (ui, layout, emails, slack), custom hooks, & lib
│   ├── package.json
│   └── README.md
│
├── .gitignore                # Unified root gitignore
└── README.md                 # Top-level workspace documentation
```

For detailed backend documentation on queue mechanics, reconciliation, rate limits, and Elasticsearch, see [backend/README.md](./backend/README.md).

---

## 🚀 Getting Started

### 1. Backend Setup

From the project root:

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Configure environment
copy .env.example .env

# 3. Start PostgreSQL, Redis, and Elasticsearch
docker compose up -d

# 4. Install dependencies and run DB migrations
npm install
npm run migrate

# 5. Start API server (Port 3000)
npm run dev

# 6. In a SECOND terminal window (same backend folder), start the worker:
npm run worker
```

**Key Backend URLs & Endpoints:**
- **API Health:** `http://localhost:3000/health`
- **BullMQ Admin Dashboard:** `http://localhost:3000/admin/queues`
- **API Base:** `http://localhost:3000/api`

---

### 2. Frontend Setup

In a new terminal window:

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start Next.js development server (Port 3001)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to access the ReachInBox dashboard.

---

## 🛠️ Verification & Scripts

### Backend Verification (`cd backend`)
- **Typecheck:** `npm run typecheck`
- **Rate Limit Lua Test:** `npm run test:rate-limit`
- **Elasticsearch Backfill:** `npm run backfill:es`
- **Database Seed:** `npm run seed`

### Frontend Verification (`cd frontend`)
- **Build & Lint:** `npm run build`
