# CareBridge Health Consultation + Commerce

Render hosting: use the repository-root `render.yaml` and follow `RENDER_DEPLOY.md`. The production deployment uses PostgreSQL/Redis and a clean first-administrator bootstrap; it does not import the local demonstration records.

[Deploy CareBridge to Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FHarold-Djah007%2FCareBridge%2Ftree%2Frebuild%2Fcarebridge-premium-v6)

CareBridge is a full-stack telehealth and hospital-commerce prototype for patients, doctors, pharmacy nurses, and hospital administrators. This build integrates the existing hospital billing/cart experience with a server-verified Flutterwave checkout for Ghana.

## What is included

- Public hospital website, patient registration, and role-based portals
- Doctor directory, appointments, live chat, WebRTC video consultation, and ward reservations
- Patient clinical record, prescriptions, alerts, billing, receipts, and support desk
- Pharmacy stock, prescriptions, online medicine orders, laboratory orders, hospital services, and a shared cart
- **Flutterwave e-commerce checkout** for:
  - Card payments
  - Ghana Mobile Money (MTN, Telecel/Vodafone, AirtelTigo/AT)
  - GHS bank transfer
- Cash and NHIS payment requests with **manual Operations verification**
- Server-side Flutterwave transaction verification and signed webhook handling before fulfilment
- Payment status and callback pages, pending-payment recovery, numbered receipts, stock/order updates, notifications, and email records
- Session-based API authentication, password hashing, role checks, authenticated Socket.IO rooms, stricter CORS, and baseline security headers
- Persistent local JSON data for development/demo use

## Demo accounts

The passwords below still work; the database stores them as hashes after the security migration runs.

- Patient: `patient@carebridge.test` / `patient123`
- Doctor: `doctor@carebridge.test` / `doctor123`
- Nurse: `nurse@carebridge.test` / `nurse123`
- Admin: `admin@carebridge.test` / `admin123`

## Requirements

- Node.js 22 or newer
- npm
- A Flutterwave account for online payments

Do **not** copy a `node_modules` folder from another computer or operating system. Install dependencies on the machine where CareBridge will run.

## Install and run

From the project root:

```bash
npm ci
npm run install:all
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000`

Windows users can also run `start-windows.bat`. Linux/macOS users can run `./start-linux-mac.sh`.

## Configure Flutterwave

1. Copy `server/.env.example` to `server/.env`.
2. Start with Flutterwave **test** credentials.
3. Set `FLW_SECRET_KEY` to the server secret key. Never put it in the React client or commit it to Git.
4. Create a strong webhook secret/hash in Flutterwave and put the same value in `FLW_SECRET_HASH`.
5. Set `APP_URL` to the URL users return to after payment. For production this should be your public HTTPS CareBridge URL.
6. In Flutterwave, configure the webhook URL as:

```text
https://YOUR-DOMAIN/api/payments/webhook
```

Example `server/.env`:

```dotenv
PORT=5000
CLIENT_URL=http://localhost:5173
APP_URL=http://localhost:5173
FLW_SECRET_KEY=FLWSECK_TEST-YOUR-SECRET-KEY-X
FLW_SECRET_HASH=replace-with-a-long-random-webhook-secret
SHOP_NAME=CareBridge Health
SESSION_DAYS=7
```

For a local Flutterwave webhook test, expose port 5000 through a trusted HTTPS tunnel and point the Flutterwave webhook to that public `/api/payments/webhook` URL. Keep `APP_URL` aligned with the browser-facing CareBridge URL.

## Checkout behavior

Patients can combine existing unpaid hospital invoices and catalog services in **Shop & pay**. Pharmacy/lab workflows continue to create normal CareBridge invoices, so there is one billing and receipt system rather than a separate e-commerce database.

For card, Mobile Money, and bank transfer, CareBridge creates a pending payment first. It does **not** mark an invoice paid from a browser button. CareBridge verifies the Flutterwave transaction on the server and checks the transaction status, currency, reference, and amount before marking invoices paid, issuing a receipt, clearing the cart, and updating related pharmacy orders.

Cash and NHIS remain pending until an administrator verifies them from **Operations → Receipts**. The old direct invoice-pay endpoint is disabled so it cannot bypass the verified checkout.

## Email alerts

If SMTP variables are provided, CareBridge sends real SMTP mail. Otherwise it keeps email records in the in-app alert log and may use the project's test-mail fallback when available.

Optional variables:

```dotenv
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=CareBridge Health <no-reply@carebridge.local>
```

## Production build

```bash
npm run build
npm start
```

The Express server serves `client/dist` when the frontend has been built.

## Security and production note

Local JSON persistence is for development and single-process demonstrations. Production requires the PostgreSQL runtime, Redis session enforcement and throttling, HTTPS, configured payment and email services, MFA and backup keys. Startup validates this configuration; see `PRODUCTION_RELEASE.md` for deployment and recovery instructions. Clinical and pharmacy normalization does not create demo clinical records, stock, or nurse accounts in production. Remove the example accounts and example records from the deployment seed before using real data.

Video consultations use peer-to-peer WebRTC with STUN and authenticated TURN credentials. Production requires a configured Coturn REST-compatible relay. Run `npm run validate:integrations` with real service configuration to check SMTP authentication, an existing live payment and forced TURN connectivity; see `PRODUCTION_RELEASE.md` for the complete customer handover procedure. Live SMTP inbox delivery, browser payment/webhook flows and customer-network video calls must be validated in their target environments.

## Quality checks

The shared visual system uses local system fonts, consistent cards and controls, readable light/Sage/Midnight surfaces, responsive page hierarchy, and a mobile drawer for every role's workspaces. Booking and command dialogs trap keyboard focus, close with Escape, and return focus to their trigger. Clinical "today" summaries filter by date; occupancy is calculated from configured ward capacities. Clinical Orders and Patient Experience load their styles only when those routes are opened, keeping startup assets within the existing performance budgets.

```bash
npm test
npm run quality:release
npm run audit:release
```

`npm test` runs targeted bug regressions, all-role API workflows, security/MFA/persistence checks and authenticated concurrency checks against fresh temporary database copies. It leaves `server/data/db.json` unchanged. The browser suite checks desktop Chromium, Firefox and WebKit plus mobile Chromium and WebKit; install its browsers with `npx --prefix client playwright install` first. CI also exercises PostgreSQL restart and conflict recovery, encrypted backups, Redis coordination and production configuration.

Only set `CAREBRIDGE_BEHIND_TLS_PROXY=true` when the app is reached through a trusted proxy that replaces forwarded headers. Direct local servers default to ignoring those headers.

For a reproducible browser test environment with all operating-system dependencies, use Docker:

```bash
docker build -f Dockerfile.quality -t carebridge-quality .
docker run --rm --init --shm-size=1g carebridge-quality
```

Browser checks create a temporary database by default and start their own servers. Stop development servers on ports 5000 and 5173 before running them; tests deliberately refuse to reuse an existing application server.

See `CAREBRIDGE_REVIEW.md` for the project review and changes made in this pass.

Video relay: set CAREBRIDGE_TURN_URLS and CAREBRIDGE_TURN_SECRET together to enable Coturn REST authentication. Authenticated participants receive one-hour credentials; the shared secret never reaches the browser. See https://github.com/coturn/coturn/blob/master/README.turnserver. Without a relay, restrictive networks may prevent a consultation connection.
