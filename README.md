# LeadFlow CRM — Contact Form & Lead Pipeline

A lightweight, modern CRM application for contact forms. Built with **Node.js**, **Express**, and **SQLite** (using `better-sqlite3` with native `node:sqlite` fallback for zero external DB setup), paired with a responsive, dark-themed vanilla HTML/CSS/JavaScript frontend.

---

## Features

- **Public Contact Form (`/`)**: Name, email, and message inputs with real-time validation, responsive card layout, and user feedback.
- **Bot Honeypot Defense**: Invisible honeypot field (`_gotcha`) stops spam bots without captcha friction.
- **Rate Limiting**: Defends `/api/contact` against flood attacks (20 submissions per 15 minutes per IP).
- **Admin Dashboard (`/admin.html`)**:
  - Secure login modal authenticated via `ADMIN_KEY`.
  - Real-time status metric counters at the top (*Total*, *New*, *Contacted*, *Qualified*, *Closed*).
  - Clickable status counters and live text search (searches name, email, and message).
  - Inline status update dropdown per lead that persists immediately with feedback.
  - XSS-safe DOM rendering using strict `textContent` binding.
- **Zero External Database Setup**: Stores leads in a local SQLite file (`crm.db`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express 4 |
| **Database** | SQLite (`better-sqlite3` / `node:sqlite`), Parameterized Queries |
| **Security** | `express-rate-limit`, Honeypot, Security HTTP Headers, Strict XSS Escaping |
| **Frontend** | Vanilla HTML5, CSS3 (Custom Dark Theme + Inter Font), Vanilla JS |

---

## Directory Structure

```text
fs2/
├── db.js                 # SQLite connection & schema initialization
├── server.js             # Express server, security middleware, and REST routes
├── package.json          # Dependencies and scripts
├── .env                  # Environment configuration (ignored in git)
├── .env.example          # Environment variable template
├── .gitignore            # Git ignore rules for node_modules, .env, and *.db
├── crm.db                # SQLite database (auto-created on first run)
└── public/               # Frontend static assets
    ├── index.html        # Public contact form
    ├── admin.html        # Admin management dashboard
    ├── style.css         # Modern dark theme design system
    ├── app.js            # Contact form controller & validation
    └── admin.js          # Admin dashboard controller & XSS-safe rendering
```

---

## Environment Variables

Configure these in a `.env` file in the root directory (see `.env.example`):

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | Port on which the HTTP server listens |
| `ADMIN_KEY` | `supersecret123` | Secret token required in `x-admin-key` header for admin routes |

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file or copy from `.env.example`:
```bash
cp .env.example .env
```
*(On Windows PowerShell)*:
```powershell
Copy-Item .env.example .env
```

### 3. Start the Server
```bash
npm start
```
Or run in development watch mode:
```bash
npm run dev
```

The application will be live at:
- **Public Contact Form**: [http://localhost:3000](http://localhost:3000)
- **Admin Portal**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## API Documentation

### 1. Health Check
Checks server status.

- **Endpoint**: `GET /api/health`
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "timestamp": "2026-10-12T09:12:00.000Z"
}
```

---

### 2. Submit Contact Form
Validates input, checks honeypot, and inserts a new lead with default status `'new'`.

- **Endpoint**: `POST /api/contact`
- **Auth**: Public (Rate-limited to 20 req / 15 min)
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "message": "Looking for CRM consulting services.",
  "_gotcha": ""
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Your message has been received! We will get back to you shortly.",
  "leadId": 4
}
```
- **Response `400 Bad Request`**:
```json
{
  "error": "Name is required (between 2 and 100 characters)."
}
```

---

### 3. List All Leads (Admin)
Retrieves all leads ordered by newest first, along with real-time status count totals.

- **Endpoint**: `GET /api/leads`
- **Auth**: Admin (`x-admin-key` header required)
- **Headers**:
  - `x-admin-key: supersecret123`
- **Response `200 OK`**:
```json
{
  "leads": [
    {
      "id": 4,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "message": "Looking for CRM consulting services.",
      "status": "new",
      "created_at": "2026-10-12 09:18:00"
    }
  ],
  "counts": {
    "all": 4,
    "new": 1,
    "contacted": 1,
    "qualified": 1,
    "closed": 1
  }
}
```
- **Response `401 Unauthorized`**:
```json
{
  "error": "Unauthorized: Invalid or missing x-admin-key header."
}
```

---

### 4. Update Lead Status (Admin)
Updates a lead's status in the pipeline.

- **Endpoint**: `PATCH /api/leads/:id`
- **Auth**: Admin (`x-admin-key` header required)
- **Headers**:
  - `Content-Type: application/json`
  - `x-admin-key: supersecret123`
- **Body**:
```json
{
  "status": "qualified"
}
```
*(Allowed statuses: `new`, `contacted`, `qualified`, `closed`)*
- **Response `200 OK`**:
```json
{
  "success": true,
  "lead": {
    "id": 4,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "message": "Looking for CRM consulting services.",
    "status": "qualified",
    "created_at": "2026-10-12 09:18:00"
  }
}
```

---

## Security Implementations

1. **Rate Limiting**: `express-rate-limit` prevents spam flooding on `/api/contact`.
2. **Bot Honeypot**: Hidden field off-screen (`_gotcha`). If filled by automated scrapers, the submission is silently dropped without creating a record.
3. **SQL Injection Defense**: Every database interaction uses strict parameterized queries via SQLite prepared statements (`db.prepare('... VALUES (?, ?, ?, ?)').run(...)`).
4. **XSS Protection**: All user data displayed in the Admin Dashboard is rendered via `element.textContent`, ensuring dangerous HTML/script tags cannot execute.
5. **Security HTTP Headers**: Standard headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`) are applied to every response.
6. **Payload Size Guard**: Body parser limited to 50KB to block denial-of-service payload attacks.

---

## Deploying to Vercel

The project is preconfigured for deployment on **Vercel** with zero extra setup.

### Project Architecture on Vercel
- **Static Assets**: All frontend files (`public/index.html`, `public/admin.html`, `public/style.css`, etc.) are served globally via Vercel's edge CDN.
- **Serverless API**: All Express routes (`/api/*`) run inside a serverless function via [`api/index.js`](file:///c:/Users/B%20AJUTESH/Downloads/fs2/api/index.js) and [`vercel.json`](file:///c:/Users/B%20AJUTESH/Downloads/fs2/vercel.json).
- **Database on Serverless**:
  - Vercel functions run in a read-only container with an ephemeral `/tmp` filesystem.
  - The SQLite adapter in [`db.js`](file:///c:/Users/B%20AJUTESH/Downloads/fs2/db.js) automatically detects Vercel and writes to `/tmp/crm.db`.
  - *Note on Data Persistence*: Because Vercel serverless containers freeze or restart after idle periods, local SQLite writes to `/tmp` are temporary. For long-term production persistence on Vercel, you can connect an external cloud database such as **Turso (LibSQL / Serverless SQLite)**, **Supabase (Postgres)**, or deploy to **Render / Railway** if you want the local `crm.db` file to remain permanently saved on a disk.

### Step-by-Step Deployment Options

#### Option A: Deploy via GitHub (Recommended)
1. Push this project to your GitHub repository.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your repository.
4. In the **Environment Variables** section, add:
   - `ADMIN_KEY`: Set to your secure secret password (e.g. `MySecureAdminKey2026!`).
5. Click **Deploy**.

#### Option B: Deploy via Vercel CLI
1. Open PowerShell or Terminal in the project root:
   ```bash
   npx vercel
   ```
2. Follow the prompt to login and select your project name.
3. To deploy to production:
   ```bash
   npx vercel --prod
   ```
4. Set the environment variable in Vercel:
   ```bash
   npx vercel env add ADMIN_KEY
   ```

