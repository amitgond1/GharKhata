# Phone-first follow-up

The phone layout is the main daily-use interface. The desktop sidebar and full tables remain available on larger screens.

Changes in this update:

- Larger text, 16px form controls and at least 44px primary touch targets.
- Bottom navigation with a central Add action; project-wide search is now accessible from the phone header.
- Single-column expense/project forms on narrow phones, with a sticky full-width Save action.
- Dialogs resize to the browser's visual viewport, including shorter keyboard-sized viewports.
- Bottom navigation and dialog actions include safe-area spacing.
- Vendor and worker cards use a single readable column on phones.
- Labour attendance, approved wages, stock movements and financial report tables become labelled cards on phones. Print/PDF layouts retain their tables.
- Progress month filtering uses a full-size input and wraps its toolbar when necessary.
- More navigation locks background scrolling and closes after choosing a project or opening an entry form.
- Attendance status says **Billed / Not billed** rather than suggesting that approved attendance has already been paid.

## Checks

Verified on **31 October 2026** against the production frontend: **7 browser tests passed**, **35 server tests passed**, and the production build passed. The PWA smoke check also passed for the offline shell, private-cache exclusion and PDF export.

Run the frontend/API and MongoDB as described in the README, then:

```powershell
npm.cmd run test:e2e
```

The mobile suite checks the landing/account screens, eleven workspace screens at 320, 360, 390, 430 and 768px, thirteen report types, visible input sizes, mobile search/navigation, attendance cards, touch-target dimensions, a 390×460 short viewport and a 740×360 landscape layout. The original bill/partial-payment/report workflows remain in the suite.

These are Chromium browser emulation checks. A physical Android phone and iPhone/Safari were not available in this workspace; camera behavior, OS keyboard behavior, installation prompts and device-specific safe areas should also be checked on those devices before public release. The short-viewport check simulates reduced available height rather than controlling a real mobile keyboard.

The application is still a local delivery. Public use needs the Node/MongoDB hosting described in DEPLOYMENT.md. SMTP and S3 need operator configuration; optional AI/voice/automated WhatsApp integrations remain unimplemented as listed in the README.
