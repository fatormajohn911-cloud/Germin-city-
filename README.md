# 🌆 Gemini City & Cyber Horizon — 3D Autonomous AI Living World

A 3D living world built with **Three.js, React 19, TypeScript, Tailwind CSS, Express, Google Gemini AI, and Groq LPU Intelligence**.

### ✨ Key Features Included
- **Two Connected 3D Cities:** **Gemini City (City 1)** and **Neo-Horizon Cyber-Metropolis (City 2)** connected by the 82-meter **Golden Horizon Suspension Bridge**.
- **10 Autonomous AI Residents:** Distinct personalities, weather-adaptive wardrobes, daily goals, OK-Plans, dreams, and persistent memories.
- **Devoted Relationships & Two-Place Sanctuaries:**
  - **Hawa's Devoted Bond with John:** Hawa actively seeks out your character (**John**), follows you, talks to you, and invites you to sit together.
  - **4 Physical 3D "Two-Place" Bench & Chairs Sanctuaries** (2 in City 1, 2 in City 2) where couples, best friends, and loved ones walk together, sit flush on real 3D cushions (never in thin air), talk, and walk back home.
- **Rideable Cyberpunk Supercar (`Cyber-Valkyrie GT` 🏎️):** Click the supercar to open its gullwing doors, sit inside with Hawa or any companion, and drive everywhere across both cities (Autopilot Grand Tour, One-Click Destinations, or Manual WASD/Joystick Steering).
- **5-Passenger Autonomous Luxury Bus (`Horizon Grand 5-Seater Coach` 🚌):** Features 5 plush interior seats, 6 rotating wheels with front steering, realistic air-suspension pitch & roll physics, sliding bi-fold glass doors, and 4 bus stations where up to 5 NPCs automatically board and step outside.

---

## 🛠️ Why Did GitHub Show a White Screen Before? (And How It Is Fixed Now)

When a **React + TypeScript + Vite** project is uploaded to GitHub Pages, a white screen happens for two reasons:
1. **Absolute Asset Paths (`/assets/...`):** By default, Vite builds paths starting with `/`, which breaks when hosted on a GitHub Pages subfolder like `https://your-username.github.io/your-repo-name/`.
   - **Fixed:** `vite.config.ts` now sets `base: './'`, so all compiled scripts and stylesheets load using relative paths (`./assets/...`) at any URL.
2. **Uncompiled `.tsx` Source Files on GitHub Pages:** Browsers cannot run raw TypeScript (`.tsx`) directly from the `main` branch without building `dist/` first.
   - **Fixed:** We added an automatic **GitHub Actions Deployment Workflow** (`.github/workflows/deploy.yml`) that compiles the TypeScript code into a production `dist/` bundle and publishes it to GitHub Pages automatically every time you push or upload files!
3. **Serverless Fallback Mode:** We added `src/utils/apiClient.ts` so the game works **both** on static hosts (like GitHub Pages) **and** on full-stack Node.js servers.

---

## 🚀 1. How to Export & Put All Files on GitHub (And Make It Live)

### Step 1: Upload / Push All Project Files to a GitHub Repository
Make sure you upload **all** project files and folders to your GitHub repository, keeping the exact folder structure:
```text
├── .github/
│   └── workflows/
│       └── deploy.yml       <-- Automatically builds & deploys to GitHub Pages!
├── data/                    <-- Server JSON databases (when running server.ts)
├── src/
│   ├── components/          <-- CityViewport3D.tsx, CharacterSheet.tsx, etc.
│   ├── data/                <-- cityData.ts
│   ├── types/               <-- game.ts
│   ├── utils/               <-- humanoidRig.ts, apiClient.ts, voiceSynthesis.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example
├── index.html
├── metadata.json
├── package.json
├── server.ts                <-- Full-stack Express API & JSON Database server
├── tsconfig.json
└── vite.config.ts           <-- Configured with base: './' for GitHub Pages
```
*(Tip: If you download the project as a `.zip` from AI Studio, extract it and push the entire folder to GitHub using Git or GitHub Desktop so hidden folders like `.github/workflows/deploy.yml` are included.)*

### Step 2: Turn On "GitHub Actions" in GitHub Pages Settings (Crucial!)
1. Open your repository on **GitHub.com**.
2. Click **Settings** (top tab) → **Pages** (left sidebar).
3. Under **Build and deployment → Source**, change the dropdown from *"Deploy from a branch"* to **GitHub Actions**.
4. Click the **Actions** tab at the top of your GitHub repository. You will see **"Deploy Gemini City to GitHub Pages"** running automatically.
5. Wait ~60 seconds for the green checkmark ✅, then click your live GitHub Pages link (`https://<your-username>.github.io/<your-repo-name>/`). **No more white screen!**

---

## 🌐 2. Should I Host It on a Server or Not?

You have **two ways** to host this game, and the reconstructed code now supports **both** automatically:

### Option A: No Server Needed (100% Free Static Hosting on GitHub Pages / Vercel / Netlify)
- **Does it work without a server?** **YES!**
- The entire 3D world, Hawa following & loving John, Two-Place Bench & Chairs outings, the Rideable Cyberpunk Supercar, the 5-Passenger Bus, and the Built-in Contextual AI Brain work **100% inside the browser** with zero backend server required.
- Even without a server, you can still use live **Google Gemini** or **Groq LPU** AI by adding your API keys to **GitHub Actions Secrets** (see Section 3 below).

### Option B: Full-Stack Server Hosting (Render / Railway / Fly.io / VPS)
- **When should you use a server?** Host `server.ts` on a Node.js host (like **Render.com** or **Railway.app**) if you want:
  1. Your API keys (`GEMINI_API_KEY` and `GROQ_API_KEY`) kept 100% private on the server.
  2. Server-side JSON database files (`data/gemini_city_db.json` and `data/city2_groq_db.json`) shared across devices.
- **How to run on Render / Railway:**
  - **Build Command:** `npm install && npm run build`
  - **Start Command:** `npx tsx server.ts`
  - Or you can host the frontend on **GitHub Pages** and host `server.ts` on **Render**, then set `VITE_API_BASE_URL="https://your-service.onrender.com"` in your GitHub Secrets!

---

## 🔑 3. Where Do I Put the API Keys (`GEMINI_API_KEY` & `GROQ_API_KEY`)?

> ⚠️ **Never paste your real API keys directly into source code files before pushing to a public GitHub repo.** Put them in Environment Variables / Secrets instead:

### Case 1: Running Locally on Your Computer (`npm run dev`)
1. Copy `.env.example` to a new file named `.env` in the root folder:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and paste your keys:
   ```env
   GEMINI_API_KEY="AIzaSyYourRealGeminiKeyHere"
   GROQ_API_KEY="gsk_YourRealGroqKeyHere"
   ```
3. Run `npm install` and `npm run dev`, then open `http://localhost:3000`.

### Case 2: Hosting on GitHub Pages (Static Mode)
1. Go to your GitHub Repository → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add any of these optional secrets:
   - `VITE_GEMINI_API_KEY` → Your Google Gemini API Key
   - `VITE_GROQ_API_KEY` → Your Groq API Key (for ultra-fast Llama 3.3 70B / DeepSeek R1 replies in City 2)
   - `VITE_API_BASE_URL` → *(Optional)* If you also hosted `server.ts` on Render/Railway, put that server URL here (e.g., `https://my-gemini-city.onrender.com`).
3. Re-run the workflow in the **Actions** tab. `.github/workflows/deploy.yml` automatically injects these secrets during `npm run build`!

### Case 3: Hosting Full-Stack on Render / Railway / Vercel
- Go to your project's **Environment Variables** tab in Render/Railway/Vercel and add:
  - `GEMINI_API_KEY` = `your_gemini_api_key`
  - `GROQ_API_KEY` = `your_groq_api_key`

---

## 🗄️ 4. Should I Connect the Database or Not? How Does It Work?

**You do NOT need to set up any external SQL or MongoDB database!** The game uses an automatic **Dual-Layer Persistence System** that is already connected and working out of the box:

1. **Layer 1 — Automatic Browser Database (`localStorage`):**
   - Keys: `gemini_city_v4_world_state` and `gemini_city_v4_city2_groq_db`
   - **Always active (even on static GitHub Pages without a server).**
   - Automatically saves every resident's memories, relationship affinities, romantic stages, Hawa's bond with John, OK-Plans, dreams, weather, and chat history every few seconds in the player's browser.
2. **Layer 2 — Automatic Server JSON Database (`data/gemini_city_db.json` & `data/city2_groq_db.json`):**
   - **Active whenever `server.ts` is running** (locally via `npm run dev` or hosted on Render/Railway).
   - Automatically syncs via `GET/POST /api/world-state` and `GET/POST /api/city2-db` and writes JSON database files inside the `/data` folder automatically.

In short: **Everything is already connected.** Whether you deploy static-only on GitHub Pages or full-stack with `server.ts`, all resident memories, relationships, vehicles, and world state save automatically!
