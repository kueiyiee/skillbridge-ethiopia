# Contributing

Thanks for helping improve SKILLBRIDGE Ethiopia. Please use a focused branch and open a pull request targeting `main`.

## Local development

1. Use Node.js 22.x (or 20.19+) and MySQL 8.0.16+.
2. Run `npm ci` and copy `.env.example` to `.env`.
3. Configure an isolated development database and a unique local `JWT_SECRET`; never use production credentials or data.
4. Apply migrations with `npm run db:migrate`, then start with `npm run dev`.

Keep all API keys, database credentials, authentication secrets, private documents, and local `.env` files out of source control. Add configuration keys only to `.env.example` with safe, non-secret placeholders.

## Validation

Before opening a pull request, run the checks relevant to your change:

```bash
npm run lint
npm test
npm run build
npm run build:server
```

Database integration tests use `npm run test:integration` and require a disposable local MySQL database with `test` in its name via `TEST_DATABASE_URL`. Never run them against a production or shared database. The GitHub Actions workflow runs these tests against its own isolated MySQL service.

## Pull requests

- Explain the problem and the behavior changed.
- Include tests or a clear reason why they are not applicable.
- Update relevant documentation.
- Call out database migrations, environment-variable changes, and deployment implications.
- Confirm no secrets, generated bundles, or private user documents are included.

CI checks the frontend and server builds, TypeScript, unit and MySQL integration tests, and production dependency advisories. Production deployment is not part of CI.
