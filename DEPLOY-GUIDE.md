# Algo — Deployment Guide (Railway)

This guide walks you through deploying Algo's backend to Railway.
No DevOps experience needed — just follow each step.

---

## What You'll Get

After following this guide, you'll have:
- Backend server running 24/7 at a public URL (e.g., `algo-backend.up.railway.app`)
- PostgreSQL database (managed, automatic backups)
- Redis cache (managed)
- Auto-deploys when you push code to GitHub

**Monthly cost estimate**: ~$5-15/mo on Railway Hobby plan

---

## Prerequisites

You need:
1. A **GitHub account** (free) — https://github.com/signup
2. A **Railway account** (free to start) — https://railway.app
3. An **Anthropic API key** for Claude — https://console.anthropic.com
4. Your **Algonit API token** (you already have this)

---

## Step 1: Push Code to GitHub

### 1a. Install Git (if not already installed)
- Download from https://git-scm.com/downloads
- Or check: open a terminal and type `git --version`

### 1b. Create a GitHub repository
1. Go to https://github.com/new
2. Repository name: `algobot` (or any name you want)
3. Set it to **Private**
4. Click "Create repository"
5. **Don't** add README or .gitignore (we already have our files)

### 1c. Push your code
Open a terminal in the `d:\algobot` folder and run these commands one by one:

```bash
git init
git add .
git commit -m "Initial commit - Algo AI assistant"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/algobot.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 2: Set Up Railway

### 2a. Create a Railway project
1. Go to https://railway.app and sign in with GitHub
2. Click **"New Project"**
3. Choose **"Deploy from GitHub Repo"**
4. Select your `algobot` repository
5. Railway will detect the monorepo — set the **Root Directory** to `backend`

### 2b. Add PostgreSQL
1. In your Railway project, click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway creates the database automatically
3. Click the PostgreSQL service → **"Variables"** tab
4. Copy the `DATABASE_URL` value (you'll need it in Step 3)

### 2c. Add Redis
1. Click **"+ New"** → **"Database"** → **"Add Redis"**
2. Railway creates Redis automatically
3. Click the Redis service → **"Variables"** tab
4. Copy the `REDIS_URL` value

---

## Step 3: Configure Environment Variables

1. Click on your **backend service** (the one connected to GitHub)
2. Go to the **"Variables"** tab
3. Click **"New Variable"** and add each of these:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | Railway auto-assigns, but we set it explicitly |
| `HOST` | `0.0.0.0` | |
| `DATABASE_URL` | *(auto-linked from PostgreSQL)* | Railway links this automatically if you click "Add Reference" |
| `REDIS_URL` | *(auto-linked from Redis)* | Railway links this automatically if you click "Add Reference" |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Claude API key from https://console.anthropic.com |
| `OPENAI_API_KEY` | `sk-...` | *(Optional)* Fallback LLM, from https://platform.openai.com |
| `LLM_PRIMARY` | `claude` | |
| `ALGONIT_API_URL` | `https://www.algonit.com/api/algo` | |
| `TOKEN_ENCRYPTION_KEY` | *(generate one, see below)* | Must be exactly 64 hex characters |
| `JWT_SECRET` | *(generate one, see below)* | Must be at least 32 characters |
| `JWT_EXPIRES_IN` | `3600` | Token expires in 1 hour |
| `REFRESH_TOKEN_EXPIRES_IN` | `604800` | Refresh token expires in 7 days |

### How to generate secure keys

Open a terminal and run:

```bash
# For TOKEN_ENCRYPTION_KEY (64 hex characters):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# For JWT_SECRET (64 hex characters):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy each output and paste it as the variable value in Railway.

---

## Step 4: Deploy

1. After adding all variables, Railway will automatically start building
2. Watch the **"Deployments"** tab for build progress
3. First deploy takes 2-3 minutes (subsequent deploys are faster)
4. Once it shows **"Success"**, your backend is live!

### Get your public URL
1. Click your backend service
2. Go to **"Settings"** → **"Networking"**
3. Click **"Generate Domain"**
4. You'll get a URL like: `algo-backend-production.up.railway.app`

### Verify it's working
Open your browser and go to:
```
https://YOUR-RAILWAY-URL/api/v1/health
```

You should see:
```json
{
  "status": "healthy",
  "checks": { "server": "ok", "database": "ok", "redis": "ok" },
  "version": "1.0.0"
}
```

---

## Step 5: Update Mobile Apps

Once deployed, update the base URL in:

**Android** (`app/build.gradle.kts`):
```kotlin
buildConfigField("String", "BASE_URL", "\"https://YOUR-RAILWAY-URL/v1\"")
buildConfigField("String", "WS_URL", "\"wss://YOUR-RAILWAY-URL/v1/ws\"")
```

**iOS** (`AppConfiguration.swift`):
```swift
static let baseURL = "https://YOUR-RAILWAY-URL"
```

---

## Troubleshooting

### Build fails
- Check the build logs in Railway's Deployments tab
- Most common cause: missing environment variables

### Health check shows "degraded"
- Database or Redis might not be connected yet
- Check that DATABASE_URL and REDIS_URL are set correctly
- Click "Add Reference" in Railway to auto-link them

### App can't connect
- Make sure you generated a public domain (Step 4)
- Check the URL includes `https://` (not `http://`)

---

## Ongoing Costs

| Service | Railway Hobby Plan |
|---------|--------------------|
| Backend server | ~$5/mo |
| PostgreSQL | ~$5/mo |
| Redis | ~$3/mo |
| **Total** | **~$13/mo** |

Railway's Hobby plan starts at $5/mo with $5 credit included.
You only pay for what you use beyond the credit.

---

## What's Next?

After the backend is deployed:
1. **Test the API** — try the health endpoint and chat endpoint
2. **Build mobile apps** — open in Xcode (iOS) / Android Studio (Android)
3. **App Store submission** — see `docs/app-store-metadata.md` for details
