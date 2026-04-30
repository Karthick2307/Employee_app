# Employee App

Employee App is a full-stack employee operations system with a React/Vite frontend and an Express/MongoDB backend. It includes employee management, role and permission controls, attendance, checklists, complaints, polls, chat, reports, and supporting master data screens.

## Project Structure

```text
.
├── backend/     # Express API, MongoDB models, routes, services, tests
├── frontend/    # React app powered by Vite
├── scripts/     # Root development helpers
└── .env.example # Example backend and frontend environment values
```

## Prerequisites

- Node.js
- npm
- MongoDB running locally or a MongoDB connection string

## Setup

Install dependencies for both apps:

```bash
npm --prefix backend install
npm --prefix frontend install
```

Create environment files from `.env.example`:

- Backend: create `backend/.env`
- Frontend: create `frontend/.env`

Default local values:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/employee_app
CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173
VITE_API_BASE_URL=http://127.0.0.1:5000/api
```

Use a strong `JWT_SECRET` before running outside local development.

## Development

Run backend and frontend together from the project root:

```bash
npm run dev
```

Or run them separately:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

The backend defaults to `http://127.0.0.1:5000` and exposes a health check at `/api/health`. The frontend Vite dev server defaults to `http://127.0.0.1:5173`.

## Scripts

From the project root:

```bash
npm run dev
npm run build
npm run lint
npm run test
```

Backend-only:

```bash
npm --prefix backend run test
npm --prefix backend run seed
npm --prefix backend run backfill:checklist-marks
```

Frontend-only:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend run test
```

## Deployment Notes

- Build the frontend with `npm run build`.
- Configure production backend environment variables before starting the server.
- See `IIS_DEPLOYMENT.md` for IIS-specific deployment guidance.

