# Workforce Management System

A multi-tenant workforce management system built with Next.js 16, Supabase, and TypeScript.

## Features

- ✅ Multi-tenant architecture with Row Level Security (RLS)
- ✅ Authentication with role-based access (Admin/Employee)
- ✅ Employee dashboard with 17+ feature cards
- ✅ Responsive UI with Tailwind CSS v4
- ✅ Local Supabase development environment
- ✅ Seed data for testing

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **React**: 19.2.0
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **TypeScript**: 5

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase CLI (`npm install -g supabase`)
- Local Supabase running

### Installation

1. Install dependencies:
```bash
npm install
```

2. Ensure Supabase is running:
```bash
supabase start
```

3. Apply database migrations and seed data:
```bash
supabase db reset
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Test Credentials

Password for all users: **`password123`**

### Acme Corporation
- **Admin**: admin@acme-corp.com
- **Employee**: john.doe@acme-corp.com
- **Employee**: jane.smith@acme-corp.com

### TechStart Inc
- **Admin**: admin@techstart.com
- **Employee**: alice.wonder@techstart.com

## Project Structure

```
workforce-saas/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── login/             # Login page
│   │   └── employee/          # Employee portal
│   ├── components/
│   │   ├── ui/               # Base UI components
│   │   └── layout/           # Layout components
│   ├── lib/
│   │   ├── supabase/         # Supabase clients
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utility functions
│   └── middleware.ts          # Auth middleware
├── supabase/
│   ├── migrations/           # Database migrations
│   └── seed.sql             # Seed data
└── claude_todo.md           # Remaining tasks
```

## Database Schema

- **tenants** - Organization/company data
- **users** - User accounts with roles
- **profiles** - Employee HR data
- **departments** - Department structure
- **custom_field_definitions** - Custom field metadata
- **tenant_config** - Tenant-specific configuration

## Development Tools

- **Supabase Studio**: http://localhost:54323 (local dashboard)
- **Next.js Dev**: http://localhost:3000
- **API Routes**: /api/*
