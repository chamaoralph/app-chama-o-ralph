# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

No test suite is configured. Manual testing via the dev server is the primary verification method.

## Architecture Overview

**Start Nova Journey** (Chama o Ralph) is a full-stack SaaS PWA for managing service installation workflows. It serves two user roles: **admins** and **instaladores** (installers).

### Stack

- **Frontend**: React 19 + TypeScript + Vite, shadcn-ui (Radix UI) + Tailwind CSS
- **Backend**: Supabase (PostgreSQL with RLS, Auth, Edge Functions)
- **State**: TanStack React Query for server state; React context for auth
- **Routing**: React Router v7
- **Forms**: React Hook Form + Zod
- **Other**: JSPDF + html2canvas (PDF gen), XLSX + JSZip (exports), Recharts, date-fns

### Route Structure

`src/App.tsx` defines two protected route groups:
- `/admin/*` — dashboard, quotes, services, approvals, cash box, installers, reports, etc.
- `/instalador/*` — dashboard, available services, schedule, statement, certificates, training, etc.

Public routes: `/`, `/login`, `/signup`, `/instalar`, `/aceite/:token`

### Auth & Authorization

- `AuthProvider` (`src/lib/auth-context.tsx`) manages Supabase session
- `ProtectedRoute` enforces role-based access by checking `user_roles` table
- Two roles: `admin` and `instalador`

### Supabase Integration

- Client and auto-generated types: `src/integrations/supabase/`
- 8 Edge Functions in `supabase/functions/` (webhooks for Google Ads, WhatsApp, ratings, backups) — JWT verification is disabled on all of them
- Migrations in `supabase/migrations/`
- Project ID: `dgkpxgwpjgnrobxduamz`

### Path Alias

All imports use `@/*` → `src/*`. Example: `import { Button } from "@/components/ui/button"`

### TypeScript Config

Lenient settings: `strictNullChecks: false`, `noImplicitAny: false`. Avoid tightening these without careful testing as the codebase relies on implicit any in several places.

### Key File Locations

| Concern | Location |
|---|---|
| Pages | `src/pages/` (split by admin/instalador) |
| Shared components | `src/components/` |
| Supabase client | `src/integrations/supabase/client.ts` |
| Generated DB types | `src/integrations/supabase/types.ts` |
| Auth context | `src/lib/auth-context.tsx` |
| PDF utilities | `src/lib/pdf-*.ts` |
| Pricing logic | `src/lib/pricing.ts` |
| Admin layout | `src/components/admin/AdminLayout.tsx` |
| Installer layout | `src/components/instalador/InstaladorLayout.tsx` |
