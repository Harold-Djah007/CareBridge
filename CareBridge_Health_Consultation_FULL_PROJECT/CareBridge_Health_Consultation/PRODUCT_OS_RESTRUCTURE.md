# CareBridge Product OS — no-legacy acceptance rules

This release is a structural product reconstruction, not a CSS reskin.

## Shell rules

- Product OS must not use the legacy `app-layout`, `portal-app`, `portal-main`, `main`, `sidebar`, `nav-rail`, `top-search`, `page-wrap`, or `mobile-nav` layout hooks in `AppShell.jsx`.
- Desktop uses the Product OS sidebar + workspace grid.
- Tablet/mobile use the Product OS responsive navigation only.
- Legacy CSS may remain temporarily for public/auth pages and unreconstructed historical components, but it must not control the authenticated shell.

## Role experience rules

- Patient: care workspace, appointments, secure messages, admissions, clinical record, prescriptions, care team, shop/pay.
- Doctor: clinical cockpit, schedule, caseload, patient charts, clinical inbox, teleconsultation, prescribing, admissions.
- Nurse/pharmacy: dispensing board, stock control, clinical communications.
- Admin: hospital command centre, capacity/bed board, clinic operations, people directory, cases, analytics/audit, finance, support.

## Runtime acceptance

A release is not acceptable merely because it compiles. CI must start the API, authenticate a real patient demo session, exercise the main patient endpoints, and establish an authenticated Socket.IO websocket connection.

## Visual acceptance

- No authenticated role should fall back to the former portal mast/grid/sidebar layout.
- Contextual clinical imagery is used only where it improves orientation.
- Dense operational surfaces prioritize readable data and actions over decorative photography.
- Motion must remain purposeful, support reduced-motion preferences, and avoid blocking clinical work.
