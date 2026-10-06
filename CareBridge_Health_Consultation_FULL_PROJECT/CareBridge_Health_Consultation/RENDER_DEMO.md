# Free Render demo

Deploy a single Node web service on the `free` plan from `rebuild/carebridge-premium-v6`. Do not apply the paid production `render.yaml` for this demo.

The application directory is `CareBridge_Health_Consultation_FULL_PROJECT/CareBridge_Health_Consultation`. From the repository root, install server dependencies with `npm ci --prefix <directory>/server --omit=dev`, install client dependencies with `npm ci --prefix <directory>/client`, then build with `npm run build --prefix <directory>/client`. Start with `node <directory>/server/start-demo.mjs`.

Set `NODE_ENV=demo`, `NODE_VERSION=22`, and `VITE_CAREBRIDGE_DEMO=true`. Render supplies `PORT` and `RENDER_EXTERNAL_URL`. The launcher uses a fresh temporary copy of the committed sample fixture, clears sessions, and disables live payment, email, PostgreSQL, Redis and TURN credentials. It refuses to run with `NODE_ENV=production`. The production launcher and its required configuration remain unchanged.

Sample accounts: `admin@carebridge.test` / `admin123` and `patient@carebridge.test` / `patient123`. These are shared demonstration accounts. Use fictional information only. Data resets on every restart. SMTP and hosted payment checkout are unavailable. Video uses direct/STUN connections and may fail on restrictive networks.

Render's free web service sleeps after inactivity and shares the workspace's 750 monthly free instance hours with existing free web services. The first visit after sleep can take time. Free hosting is for demonstrations, not real clinical records or a customer production installation. See https://render.com/docs/free.
