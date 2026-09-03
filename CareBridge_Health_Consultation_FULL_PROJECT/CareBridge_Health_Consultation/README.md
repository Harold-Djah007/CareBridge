# CareBridge Health Consultation Platform

A complete demo-ready telehealth web application for doctors and patients.

## Included
- Patient and Doctor sign-in
- Role-based dashboards
- Appointment booking
- Doctor appointment management
- Live doctor/patient chat with Socket.IO
- Browser video consultation using WebRTC signaling
- Ward / bed reservation before hospital arrival
- Ward booking management
- Notifications
- Responsive professional UI
- Persistent local JSON storage for demo use

## Demo accounts
- Patient: `patient@carebridge.test` / `patient123`
- Doctor: `doctor@carebridge.test` / `doctor123`

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
This project is suitable as a functional prototype / starter product. Before real clinical use, add production-grade identity verification, audit logging, encryption/key management, database backups, consent flows, secure media infrastructure/TURN servers, privacy/compliance review, and hospital-system integrations.
