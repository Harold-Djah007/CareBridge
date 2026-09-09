# CareBridge Premium V6

Premium V6 is a deliberate frontend rebuild, not a reskin of the legacy CareBridge portal.

## Product architecture

- **Patient**: consumer-health experience with floating top navigation, a personal care canvas, care stream, clinician relationship, account state and calm contextual imagery.
- **Doctor**: encounter-first clinical workstation with active patient context, clinic board, clinical tools, availability state and live consultation access.
- **Nurse / Pharmacy**: live three-stage dispensing command board for prepare, ready and collected workflows, plus inventory control.
- **Admin**: hospital operations war room with operational state, occupancy, decision queues, modules, admissions and communication monitoring.

## Global interaction system

- New Premium V6 top chrome and staff navigation rail.
- Global command palette (`Ctrl/Cmd + K`).
- Animated route transitions and live state indicators.
- Compact page-header system replaces the legacy oversized image hero.
- Contextual hospital imagery is supporting content rather than the page layout itself.
- Appearance control centre supports Pearl, Midnight and Sage themes; comfortable/compact density; cinematic/subtle/reduced motion; and floating/flush navigation.
- Existing authentication, APIs, payments, WebSocket events, video, prescriptions, admissions and clinical data flows stay intact.

## Release acceptance

Premium V6 is not ready for `main` until:

1. Clean production build passes.
2. Existing authenticated workflows remain functional.
3. Patient, Doctor, Nurse and Admin each feel like different purpose-built products within one CareBridge system.
4. Secondary pages inherit the V6 page geometry, form language, tables, cards, transitions and controls.
5. No authenticated page visually falls back to the rejected legacy portal shell.
6. Responsive layouts are usable on desktop, tablet and mobile.
7. Reduced-motion preferences remain respected.
