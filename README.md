# 💰 FinTrack Pro

A modern, production-ready personal finance SaaS application built with Next.js 15, Supabase, and Tailwind CSS. Track income, expenses, budgets, and savings goals with beautiful charts and AI-powered insights.

![FinTrack Pro](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)

---

## ✨ Features

- **Dashboard** — KPI cards, trend charts, budget status, savings goals
- **Income Management** — CRUD with categories, search, filter, sort
- **Expense Management** — CRUD with payment methods, categories
- **Budgets** — Monthly limits with visual progress bars and alerts
- **Savings Goals** — Track progress toward financial targets
- **Recurring Transactions** — Automated salary, rent, subscriptions
- **Reports** — Monthly/quarterly/annual with PDF, Excel, CSV export
- **Analytics** — 6-month trends, category breakdowns, AI insights
- **Notifications** — Budget alerts, goal milestones, bill reminders
- **Admin Panel** — User management, platform analytics, monitoring
- **Dark / Light Mode** — System-aware theme switching
- **Multi-currency** — GHS, USD, EUR, GBP, NGN, KES

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) |
| Backend | Supabase (PostgreSQL + Auth) |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Export | jsPDF + SheetJS (xlsx) |
| Hosting | Vercel |

---

## 📁 Project Structure

```
fintrack-pro/
├── src/
│   ├── app/
│   │   ├── auth/           # Login, register, forgot password
│   │   ├── dashboard/      # Main dashboard
│   │   ├── income/         # Income management
│   │   ├── expenses/       # Expense management
│   │   ├── budgets/        # Budget management
│   │   ├── savings/        # Savings goals
│   │   ├── transactions/   # All transactions
│   │   ├── recurring/      # Recurring transactions
│   │   ├── reports/        # Financial reports
│   │   ├── analytics/      # Analytics & insights
│   │   ├── notifications/  # Notification centre
│   │   ├── profile/        # User profile
│   │   ├── settings/       # App settings
│   │   ├── admin/          # Admin panel (protected)
│   │   └── page.tsx        # Landing page
│   ├── components/
│   │   ├── ui/             # Core UI primitives
│   │   ├── layout/         # Sidebar, TopNav, AppShell
│   │   ├── dashboard/      # Stat cards
│   │   └── charts/         # Recharts wrappers
│   ├── lib/
│   │   ├── supabase/       # Client + server helpers
│   │   └── utils.ts        # Formatters, constants
│   ├── store/              # Zustand global state
│   ├── types/              # TypeScript interfaces
│   └── styles/             # Global CSS + CSS variables
├── supabase/
│   └── schema.sql          # Full DB schema + RLS policies
├── .env.example
├── vercel.json
└── README.md
```

---

## ⚡ Quick Start

### 1. Clone & install

```bash
git clone https://github.com/yourusername/fintrack-pro.git
cd fintrack-pro
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full contents of `supabase/schema.sql`
3. Copy your project URL and API keys from **Project Settings → API**

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔐 Making yourself an Admin

After registering your account, run this in the Supabase SQL Editor:

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your@email.com';
```

Then access the admin panel at `/admin/dashboard`.

---

## 🌍 Deploy to Vercel

### Option 1 — Vercel CLI

```bash
npm install -g vercel
vercel
```

### Option 2 — GitHub Integration

1. Push the project to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add environment variables in Vercel's project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy!

### Supabase Auth Redirect URLs

In Supabase **Auth → URL Configuration**, add:
```
https://your-domain.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

---

## 🗄️ Database Schema

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (auto-created on sign-up via trigger) |
| `incomes` | Income transactions |
| `expenses` | Expense transactions |
| `budgets` | Monthly category budgets |
| `savings_goals` | Savings targets with progress |
| `recurring_transactions` | Scheduled repeating transactions |
| `notifications` | User notification centre |

All tables have **Row Level Security (RLS)** enabled. Users can only access their own data.

---

## 📊 Pages Overview

| Route | Description | Auth |
|-------|-------------|------|
| `/` | Landing page | Public |
| `/auth/login` | Sign in | Public |
| `/auth/register` | Sign up | Public |
| `/auth/forgot-password` | Password reset | Public |
| `/dashboard` | Main dashboard | ✅ |
| `/transactions` | All transactions | ✅ |
| `/income` | Income CRUD | ✅ |
| `/expenses` | Expenses CRUD | ✅ |
| `/budgets` | Budget management | ✅ |
| `/savings` | Savings goals | ✅ |
| `/recurring` | Recurring transactions | ✅ |
| `/reports` | Export reports | ✅ |
| `/analytics` | Financial insights | ✅ |
| `/notifications` | Notification centre | ✅ |
| `/profile` | Profile & password | ✅ |
| `/settings` | App preferences | ✅ |
| `/admin/dashboard` | Admin overview | 🔐 Admin |
| `/admin/users` | User management | 🔐 Admin |
| `/admin/analytics` | Platform stats | 🔐 Admin |
| `/admin/monitoring` | System health | 🔐 Admin |

---

## 🎨 Customisation

### Change currency default

In `src/lib/utils.ts`, update the `formatCurrency` default:
```ts
export function formatCurrency(amount: number, currency = 'USD') { ... }
```

### Change primary color

In `src/styles/globals.css`, update the `--primary` CSS variable:
```css
:root {
  --primary: 252 87% 60%; /* HSL — change this */
}
```

---

## 📄 License

MIT — feel free to use this for personal or commercial projects.

---

Built with ❤️ for Africa 🌍
