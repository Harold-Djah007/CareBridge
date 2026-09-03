# CareBridge Health Consultation Platform

A complete telehealth web app for **patients**, **doctors**, and **hospital administrators**.

## Included
- Public landing page and working login / patient registration
- Patient portal: find a doctor, book visits, live chat, video consultation, ward booking, email alerts
- Doctor workspace: schedule, patients, chat, video, ward request decisions
- Admin console: people, appointments, wards, outbound email log
- Live Socket.IO chat and WebRTC video (camera, mic, screen share)
- Email alerts when a consultation is scheduled, a ward is accepted, a message arrives, or an account is created
- Persistent local JSON storage for demo use

## Demo accounts
- Patient: `patient@carebridge.test` / `patient123`
- Doctor: `doctor@carebridge.test` / `doctor123`
- Admin: `admin@carebridge.test` / `admin123`

## Email alerts
Patients receive email alerts for:
- Consultation scheduled or updated
- Ward request received and **ward acceptance**
- New message from a doctor
- Welcome / test alerts

Alerts are stored in **Email alerts** in the patient portal. If `SMTP_HOST` is set, messages are sent through that SMTP server. Otherwise CareBridge uses an Ethereal test inbox when the network allows, and always keeps a copy in the in-app alert log.

Optional SMTP environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

Patients can turn categories on or off in **Profile**.

## Requirements
- Node.js 20+
- npm

## Run
From the project root:

```bash
npm install
npm run install:all
npm run dev
```

Open:
- Frontend: http://localhost:5173
- API: http://localhost:5000

## Production build
```bash
npm run build
npm start
```

The server automatically serves the built frontend if `client/dist` exists.

## Notes
This project is a functional prototype. Before real clinical use, add production-grade identity verification, audit logging, encryption/key management, database backups, consent flows, secure media infrastructure/TURN servers, privacy/compliance review, and hospital-system integrations.
