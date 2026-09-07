# CareBridge Health Consultation + Commerce

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

- Node.js 20 or newer
- npm
- A Flutterwave account for online payments

Do **not** copy a `node_modules` folder from another computer or operating system. Install dependencies on the machine where CareBridge will run.

## Install and run

From the project root:

```bash
npm install
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

This version is substantially hardened compared with the uploaded prototype, but the local JSON database and peer-to-peer WebRTC architecture are still intended for development/demo use. Before real patient or payment production use, move data to a production database, add managed secrets/key rotation, backups, rate limiting, MFA/identity verification, comprehensive authorization tests, a TURN service for WebRTC, observability, data-retention policies, and the privacy/security/compliance controls required by the hospitals and jurisdictions where CareBridge will operate.

See `CAREBRIDGE_REVIEW.md` for the project review and changes made in this pass.
