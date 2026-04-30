# Checklist App IIS Deployment (Frontend + Backend)

This setup hosts:
- React frontend from IIS (static files)
- Node/Express backend on `127.0.0.1:5000`
- IIS reverse proxy for `/api/*` and `/uploads/*`

The project already includes an IIS rewrite file at:
- `frontend/public/web.config`

When you run `npm run build` in `frontend`, this `web.config` is copied into `frontend/dist`.

## 1. Prerequisites on Windows Server

Install:
- IIS with Static Content
- URL Rewrite module
- Application Request Routing (ARR)
- Node.js LTS
- MongoDB (local or Atlas)

In IIS:
- Open server node -> `Application Request Routing Cache` -> `Server Proxy Settings`
- Enable `Proxy`

## 2. Build Frontend

```powershell
cd "C:\Users\REPPLEN\Desktop\Check List\frontend"
npm ci
npm run build
```

Publish folder:
- `frontend/dist`

## 3. Prepare Backend

```powershell
cd "C:\Users\REPPLEN\Desktop\Check List\backend"
npm ci
copy .env.example .env
```

Update `backend/.env` for production:
- `NODE_ENV=production`
- `PORT=5000`
- `MONGODB_URI=...`
- `JWT_SECRET=...` (strong secret)
- `CORS_ORIGIN=https://your-domain.com`

## 4. Run Backend as Windows Service (NSSM recommended)

Install NSSM, then run (example):

```powershell
nssm install ChecklistBackend "C:\Program Files\nodejs\node.exe" "C:\Users\REPPLEN\Desktop\Check List\backend\server.js"
nssm set ChecklistBackend AppDirectory "C:\Users\REPPLEN\Desktop\Check List\backend"
nssm set ChecklistBackend Start SERVICE_AUTO_START
nssm start ChecklistBackend
```

## 5. Create IIS Site

1. Create site in IIS (for example `ChecklistApp`)
2. Physical path -> `C:\Users\REPPLEN\Desktop\Check List\frontend\dist`
3. App Pool settings:
   - `.NET CLR Version`: `No Managed Code`
   - `Managed pipeline`: `Integrated`
4. Bind your hostname and SSL certificate

## 6. Why This Works

`frontend/dist/web.config` handles:
- `/api/*` -> `http://127.0.0.1:5000/api/*`
- `/uploads/*` -> `http://127.0.0.1:5000/uploads/*`
- all other non-file routes -> `/index.html` (React Router fallback)

## 7. Verify

After site + service start:
- `https://your-domain.com` -> frontend should load
- `https://your-domain.com/api/auth/login` -> backend route reachable
- `https://your-domain.com/uploads/...` -> file access works

## 8. Deploy Updates

Frontend updates:
```powershell
cd "C:\Users\REPPLEN\Desktop\Check List\frontend"
npm run build
```
Then copy new `dist` content to IIS site path.

Backend updates:
- Pull/update backend code
- Run `npm ci` if dependencies changed
- Restart service:
```powershell
nssm restart ChecklistBackend
```

## 9. Troubleshooting: HTTP Error 403.14

If you see:
- `HTTP Error 403.14 - Forbidden`
- `Physical Path: ...\backend`

then IIS is pointing to the wrong folder. Fix it like this:

1. In IIS, open your site -> `Basic Settings`.
2. Set `Physical path` to:
   - `C:\Users\REPPLEN\Desktop\Check List\frontend\dist`
3. Keep backend running separately on `127.0.0.1:5000` (Node/NSSM service).
4. Confirm `frontend\dist\web.config` exists (it contains `/api` and `/uploads` reverse-proxy rules).
5. Restart IIS site and test:
   - `http://localhost:812/` -> React app
   - `http://localhost:812/api/health` -> `{"ok":true}`
