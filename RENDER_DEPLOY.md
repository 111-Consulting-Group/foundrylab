# Render Deployment Guide

This guide explains how to deploy the Foundry Lab app to Render.

## Prerequisites

1. A Render account
2. Your Supabase credentials

## Deployment Steps

### 1. Create a New Web Service in Render

1. Go to your Render dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `111-Consulting-Group/foundrylab`
4. Select the repository and branch (usually `main`)

### 2. Configure the Service

**Important:** You need to manually set these in the Render dashboard:

#### Build & Start Settings:
- **Name**: `foundrylab` (or your preferred name)
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build:web`
- **Start Command**: `npm start`
- **Root Directory**: (leave empty, or use `.`)

#### Environment Variables:
Add these in the "Environment" section:

- `NODE_ENV` = `production`
- `EXPO_PUBLIC_SUPABASE_URL` = (your Supabase project URL)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = (your Supabase anon/public key)
- `PORT` = (Render will set this automatically, but you can set it to `10000` if needed)

**Important Notes:**
- The `EXPO_PUBLIC_*` variables MUST be set before building
- These are baked into the static build at build time
- If you change them, you need to rebuild

### 3. Deploy

Click "Create Web Service" and Render will:
1. Install dependencies
2. Run the build command (creates `dist/` folder)
3. Start the server using `npm start` (runs `server.js`)

### 4. Verify Deployment

Once deployed, your app should be available at the Render-provided URL.

## How It Works

1. **Build Phase**: 
   - Runs `npm install` to install all dependencies
   - Runs `npm run build:web` which executes `npx expo export --platform web`
   - This creates a static site in the `dist/` directory

2. **Start Phase**:
   - Runs `npm start` which executes `node server.js`
   - The server serves static files from the `dist/` directory
   - Supports SPA routing (all routes serve `index.html`)

## Troubleshooting

### Error: "Cannot find module '/opt/render/project/src/expo-router/entry'"

This means Render is trying to run `node expo-router/entry` directly instead of using `npm start`.

**Solution**: In the Render dashboard, make sure:
- **Start Command** is set to: `npm start`
- Do NOT use `node expo-router/entry` or any command that references the "main" field

### Error: "dist directory not found"

This means the build didn't complete successfully.

**Solution**: Check the build logs for errors. Common issues:
- Missing environment variables (EXPO_PUBLIC_SUPABASE_URL, etc.)
- Build failures in Expo export
- Missing dependencies

### Environment Variables Not Working

Remember that `EXPO_PUBLIC_*` variables are baked into the build at **build time**, not runtime. If you change them:
1. Update them in Render dashboard
2. Trigger a new deployment (Render will rebuild)

## Alternative: Using render.yaml (Blueprint)

If you prefer to use Infrastructure as Code:

1. The `render.yaml` file in the root should be automatically detected
2. Render will use the configuration from that file
3. You still need to set environment variables in the dashboard

However, if Render isn't detecting `render.yaml`, use the manual configuration steps above.
