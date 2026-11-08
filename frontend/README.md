# Frontend architecture blueprint

This folder represents the target frontend structure for the application. The active runtime app currently stays in the project root because this repo is configured to serve the Vite app and Node server from the repository root for deployment compatibility.

The structure below is the recommended browser-facing architecture and is now scaffolded under this folder.

```text
frontend/
├── public/
│   ├── favicon.svg
│   ├── logo.svg
│   ├── manifest.webmanifest
│   └── images/
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   ├── query-client.ts
│   │   └── route-guards.tsx
│   │
│   ├── assets/
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/
│   │   │   ├── MainLayout.tsx
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── AuthLayout.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── MobileNavigation.tsx
│   │   │
│   │   └── common/
│   │       ├── PageHeader.tsx
│   │       ├── LoadingState.tsx
│   │       ├── ErrorState.tsx
│   │       ├── EmptyState.tsx
│   │       └── ConfirmDialog.tsx
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   └── ForgotPasswordPage.tsx
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   ├── candidates/
│   │   ├── employers/
│   │   ├── jobs/
│   │   ├── applications/
│   │   ├── skills/
│   │   ├── matching/
│   │   ├── ai-assistant/
│   │   ├── notifications/
│   │   ├── employer-verification/
│   │   ├── saved-jobs/
│   │   ├── messaging/
│   │   └── administration/
│   │
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   ├── useMediaQuery.ts
│   │   └── usePagination.ts
│   │
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── utils.ts
│   │   ├── date.ts
│   │   └── constants.ts
│   │
│   ├── services/
│   │   └── upload.service.ts
│   │
│   ├── store/
│   │   └── auth.store.ts
│   │
│   ├── types/
│   │   └── global.ts
│   │
│   ├── styles/
│   │   ├── index.css
│   │   └── theme.css
│   │
│   ├── test/
│   │   ├── setup.ts
│   │   └── mocks/
│   │
│   └── vite-env.d.ts
│
├── e2e/
│   ├── auth.spec.ts
│   ├── jobs.spec.ts
│   └── applications.spec.ts
│
├── .env.example
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── README.md
```

This layout is suitable for a scalable React app where the team keeps feature modules isolated, shared UI in one place, and routing/auth guards separated from page logic.

Current runtime mapping in this repo remains:

- Browser shell: `src/app/App.tsx`
- Providers: `src/app/providers/`
- Page entry points: `src/pages/` and `src/features/**/pages/`
- Shared UI: `src/components/`
- API client: `src/services/api-client.ts`
- Styles: `src/styles/`

This frontend folder is therefore a blueprint for future refactoring, not a replacement for the runtime app while the deployment structure remains anchored in the repo root.
