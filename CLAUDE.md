# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Supabase (Required First)
```bash
# Start local Supabase (must be running for dev)
supabase start

# Check Supabase status
supabase status

# Reset database (apply migrations + seed data)
supabase db reset

# Apply migrations only
supabase db push

# Access Supabase Studio
# http://localhost:54323
```

### Next.js Development
```bash
# Start dev server (requires Supabase running)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint
```

### Important: Environment Variables
After any changes to `.env` file, **restart the dev server** for Next.js to pick up the changes.

## Architecture Overview

### Multi-Tenant SaaS with RLS
- **Single Next.js app** (not a monorepo)
- **Direct Supabase queries** (no Express microservices)
- **Row Level Security (RLS)** enforces tenant isolation at the database level
- All database queries automatically filtered by `tenant_id` from JWT claims

### Authentication Flow
1. User logs in at `/login` with email/password
2. Supabase Auth validates credentials and returns JWT with `user_metadata.tenant_id` and `user_metadata.role`
3. Middleware (`src/middleware.ts`) checks session and role for all routes
4. Server components use `src/lib/supabase/server.ts` (with cookie handling)
5. Client components use `src/lib/supabase/client.ts` (browser client)

### Database Schema Key Points
- **users** table: Links to `auth.users`, stores `role` (admin/manager/employee) and `tenant_id`
- **profiles** table: Employee HR data from imports, has `custom_fields` JSONB column
- **tenant_config** table: Stores JSON configs for:
  - `hr_import_config`: CSV field mapping per tenant
  - `field_visibility_config`: Which fields to show on employee pages per tenant
- **custom_field_definitions**: Metadata for custom fields (type, options, required)

### Component Organization
```
src/components/
├── ui/                    # Base components (Button, Input, Card, etc.)
└── layout/               # Composite components (Sidebar, DashboardLayout, FeatureCard)
```

**Import pattern:** Always use `@/components/ui/*` and `@/components/layout/*` (not `@/components/*`)

### Supabase Client Pattern
```typescript
// Server Components, API Routes, Server Actions
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";

// Client Components
import { createClient } from "@/lib/supabase/client";
```

### TypeScript Types
All database types are in `src/lib/types/database.ts`. The `Database` interface matches the Supabase schema.

## Deployment to Cloud

For deploying to Supabase Cloud, see **DEPLOYMENT.md**. Key requirements:
- Custom JWT hook must be enabled (migration + config)
- Realtime must be enabled for `import_jobs` table
- See `scripts/deploy-to-cloud.sh` and `scripts/enable-hook-api.js`

## Critical Implementation Details

### Custom JWT Claims (Required for RLS)
All RLS policies depend on `tenant_id` being in the JWT claims. This requires:
1. Migration `20250111000000_custom_jwt_hook.sql` applied
2. Auth hook enabled in `config.toml` (local) or dashboard (cloud)
3. See DEPLOYMENT.md for cloud setup instructions

### Role-Based Access Control
Middleware (`src/middleware.ts`) enforces:
- `/admin/*` routes: Only accessible to users with `role: 'admin'`
- `/employee/*` routes: Accessible to both employees and admins
- Unauthenticated users → redirect to `/login`
- Authenticated users at `/login` → redirect to appropriate dashboard

### JWT Claims Structure
```typescript
{
  tenant_id: "uuid",  // From user_metadata
  role: "admin" | "manager" | "employee"  // From user_metadata
}
```

RLS policies use: `auth.jwt() ->> 'tenant_id'` to filter data.

### Custom Fields (JSONB)
Employee data can have tenant-specific custom fields stored in `profiles.custom_fields`:
```json
{
  "employee_id": "ACME-100",
  "office_location": "San Francisco"
}
```

The `custom_field_definitions` table defines which fields exist and their types.

### Test Credentials
All test users use password: `password123`

**Acme Corporation** (tenant_id: `d5cb6bd8-dfbf-40a1-83e2-84d308b617a9`):
- admin@acme-corp.com (admin)
- john.doe@acme-corp.com (employee)
- jane.smith@acme-corp.com (employee)

**TechStart Inc** (tenant_id: `e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b`):
- admin@techstart.com (admin)
- alice.wonder@techstart.com (employee)

## Planned Features (See claude_todo.md)

The following are **stub pages** (copied from archive but not implemented):
- `/employee/schedule`, `/employee/timecard`, `/employee/leave-request`, etc.

**Next priorities:**
1. Admin dashboard (`/admin/dashboard`)
2. HR import system (`/admin/hr-import`, `/admin/hr-import-config`)
3. Dynamic employee personal info page (`/employee/personal-info`)

## Common Patterns

### Creating New Pages
1. Add route in `src/app/[role]/[feature]/page.tsx`
2. Use `getUser()` and `getUserRole()` for auth checks
3. Wrap in `DashboardLayout` component
4. Update sidebar navigation if needed (`src/components/layout/sidebar.tsx`)

### Database Queries
```typescript
// Server component
const supabase = await createClient();
const { data } = await supabase
  .from('profiles')
  .select('*')
  // RLS automatically filters by tenant_id
```

### Form Handling
Use React Hook Form + Zod validation pattern (see `src/app/login/page.tsx` for example).

## Migration & Seed Data

Migrations are in `supabase/migrations/`:
- `20250101000000_initial_schema.sql` - Tenants, departments, custom fields
- `20250102000000_users_and_profiles.sql` - Users and profiles with RLS
- `20250103000000_tenant_config.sql` - Config table

Seed data: `supabase/seed.sql` creates 2 tenants with test users and sample configs.

## Debugging

If login fails with "Database error querying schema":
1. Check Supabase is running: `supabase status`
2. Restart Next.js dev server (to reload `.env`)
3. Verify tables exist in Supabase Studio: http://localhost:54323
4. Check RLS policies allow the query
