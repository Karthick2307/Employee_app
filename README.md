# Employee Workspace

React + Vite frontend with an Express + MongoDB backend for employee master data, checklist workflows, attendance, polling, complaints, chat, dashboard analytics, permissions, and reports.

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB 6+

## Environment Setup

Use the examples in [`.env.example`](./.env.example), [`backend/.env.example`](./backend/.env.example), and [`frontend/.env.example`](./frontend/.env.example).

Backend values can live in either:

- `backend/.env`
- root `.env`

Frontend values should live in:

- `frontend/.env`

Minimum backend variables:

- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGIN`

Recommended local frontend variable:

- `VITE_API_BASE_URL=http://127.0.0.1:5000/api`

## Install

Install each workspace once:

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Run Locally

From the repo root:

```bash
npm run dev
```

Useful workspace commands:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Root scripts:

- `npm run dev` starts backend and frontend together
- `npm run build` builds the frontend bundle
- `npm run lint` runs the frontend ESLint checks
- `npm run test` runs backend Jest tests and frontend Vitest tests

## Testing

Backend:

```bash
cd backend && npm run test
```

Frontend:

```bash
cd frontend && npm run test
```

Current automated coverage includes:

- auth login
- permission guard behavior
- checklist submission flow
- complaint lifecycle timing
- poll response submission
- frontend login screen
- frontend permission route guard
- attendance dashboard card rendering
- checklist list rendering
- complaint report rendering

## Production Checklist

- Set `NODE_ENV=production`
- Use a strong `JWT_SECRET`
- Point `MONGODB_URI` to the production database
- Set `CORS_ORIGIN` to the exact allowed frontend origin list
- Terminate TLS at the load balancer or reverse proxy
- Keep `/api` and `/uploads` behind the reverse proxy
- Rotate server logs and monitor error volume
- Back up MongoDB regularly
- Keep `backend/uploads` out of git and protect file storage permissions
- Run `npm run test` and `npm run build` before deployment

## Operational Notes

- Master data deletes now use soft-deactivation patterns instead of hard deletes.
- Checklist masters with generated employee tasks are protected from destructive deletion.
- Request validation is centralized with Zod.
- Upload handling is centralized with MIME allowlists, file size limits, and safe filenames.
- API errors now flow through a shared Express error handler with a consistent response shape.
