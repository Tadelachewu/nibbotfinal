# Deployment Guide

This guide describes how to run the project in development and production, and explains the deployment risks where data may be lost or preserved.

## 1. Modes

### Development mode

Use this mode for local development and testing. It runs the custom Node server with Socket.io support.

Commands:

```bash
npm install --legacy-peer-deps
npx prisma generate
npm run dev:io
```

Behavior:

- Runs the app at `http://localhost:9002/`
- Uses `NODE_ENV=development`
- Uses the custom server from `server.js`
- Loads local environment variables from `.env`
- Does not run the default Next.js dev server (`npm run dev`), because Socket.io requires the custom server

### Production mode

Use this mode for a real deployment after build and migrations.

Commands:

```bash
npm install --legacy-peer-deps
npx prisma generate
npm run build
npm start
```

Behavior:

- Builds the Next.js app for production
- Runs the app with `NODE_ENV=production`
- Starts the custom Node server from `server.js` on `PORT` or `3020`
- Requires a production database and optional Redis instance for real-time presence

## 2. Environment and hosting notes

### Required environment variables

At minimum the following must be defined in production and development:

- `NODE_ENV` (`development` or `production`)
- `PORT`
- `DATABASE_URL`
- `SECRET_COOKIE_PASSWORD`
- `REDIS_URL` (recommended for online presence)

### Hosting considerations

- The app uses a custom Node server, so it is not directly compatible with serverless-only deployments unless the server is supported.
- `apphosting.yaml` is present, but this project is not a simple static Firebase Hosting deployment because it relies on `server.js` and Socket.io.
- If you deploy to a platform that does not support long-running Node processes or Redis, real-time presence and Socket.io features will not work.

## 3. Database deployment

### Development database flow

- Use `npx prisma migrate dev` to apply migrations and generate Prisma client.
- This command may create new migrations from schema changes.
- It is safe for local dev data, but it can reset the database if you run `prisma migrate reset`.

### Production database flow

- Use `npx prisma migrate deploy` to apply existing migrations to the production database.
- Do not use `prisma migrate dev` in production; it may create or modify migration history.
- Keep the `prisma/migrations/` folder in source control.

### Seeding

- Use `npx tsx prisma/seed.ts` only if you need to insert initial data.
- In production, avoid running seeding scripts that can overwrite or duplicate data unless seeding is designed to be idempotent.

## 4. Data loss and non-loss situations

### When data can be lost

- Running `npx prisma migrate reset --force` will drop and recreate the database. This destroys all data.
- Recreating the database from scratch or deleting the database manually will cause data loss.
- If you run `npx prisma migrate dev` against a production database without understanding the current migration state, you may cause inconsistent schema or data loss.
- If you seed production data with a script that is not idempotent, duplicate or overwrite data may happen.
- Deleting `prisma/migrations/` and then forcing a migration can lead to schema drift and lost production data if not handled carefully.

### When data is safe

- Applying migrations with `npx prisma migrate deploy` preserves data and runs existing migration SQL.
- Running `npm start` or `npm run dev:io` does not itself delete application data.
- Updating frontend code or server code without touching the database schema is usually safe for data.
- Keeping the production database outside the application container and using a persistent managed database service prevents data loss during deploys.

## 5. Recommended deployment strategy to avoid data loss

1. Keep database state separate from application deployments.
2. Use a managed PostgreSQL database for production.
3. Use `npx prisma migrate deploy` in production only.
4. Keep `prisma/migrations/` committed.
5. Do not run `prisma migrate reset` in production.
6. Do not remove or regenerate migrations on a production branch without a careful migration plan.
7. Use backups before any schema change.

## 6. Common issues you will encounter

### Issue: Wrong dev command

- Problem: running `npm run dev` instead of `npm run dev:io`
- Effect: Socket.io and the real-time server are not started correctly
- Fix: use `npm run dev:io` for local development

### Issue: Production node server missing

- Problem: deploying only Next build output without `server.js`
- Effect: Socket.io and the admin dashboard may not work
- Fix: deploy the custom Node server and start it with `npm start`

### Issue: Missing `DATABASE_URL`

- Problem: app cannot connect to PostgreSQL
- Effect: app fails at startup or API calls fail
- Fix: set a valid `DATABASE_URL` in environment variables

### Issue: Missing or invalid Redis

- Problem: `REDIS_URL` not configured
- Effect: presence tracking will not work, but core functionality may still run if Redis is optional
- Fix: configure Redis or disable presence-related features

### Issue: CSP or origin mismatch in production

- Problem: `next.config.ts` includes conditional CSP and allowed connect sources
- Effect: blocked resources or socket connections if production origin is not set correctly
- Fix: set `APP_ORIGIN` and ensure the production origin matches the deployment URL

### Issue: Build environment mismatch

- Problem: `NODE_ENV=production` not set during production start
- Effect: production headers and behavior may differ; app may run less securely
- Fix: ensure `NODE_ENV=production` when running `npm start`

## 7. Minimal safe deployment checklist

- [ ] `npm install --legacy-peer-deps`
- [ ] `npx prisma generate`
- [ ] `npx prisma migrate deploy`
- [ ] `npm run build`
- [ ] `npm start`
- [ ] `DATABASE_URL` set to production DB
- [ ] `SECRET_COOKIE_PASSWORD` set securely
- [ ] `NODE_ENV=production` set
- [ ] `REDIS_URL` set if using presence features
- [ ] `APP_ORIGIN` configured if using CSP/headers

## 8. Notes about deployment file scope

This document is intended as deployment guidance only. It does not modify any application code.
