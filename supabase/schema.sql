-- ============================================================
-- FinTrack Pro — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INCOMES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.incomes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category    TEXT NOT NULL CHECK (category IN ('salary','freelance','business','investment','rental','other')),
  notes       TEXT,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incomes_user_id_idx  ON public.incomes(user_id);
CREATE INDEX IF NOT EXISTS incomes_date_idx     ON public.incomes(date DESC);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category        TEXT NOT NULL CHECK (category IN ('food','transportation','housing','utilities','entertainment','healthcare','shopping','education','travel','insurance','investments','other')),
  payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','mobile_money','debit_card','credit_card','bank_transfer')),
  notes           TEXT,
  date            DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS expenses_user_id_idx   ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx      ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx  ON public.expenses(category);

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.budgets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  budget_name   TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('food','transportation','housing','utilities','entertainment','healthcare','shopping','education','travel','insurance','investments','other')),
  monthly_limit NUMERIC(12, 2) NOT NULL CHECK (monthly_limit > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS budgets_user_id_idx ON public.budgets(user_id);

-- ============================================================
-- SAVINGS GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_name       TEXT NOT NULL,
  target_amount   NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date     DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS savings_goals_user_id_idx ON public.savings_goals(user_id);

-- ============================================================
-- RECURRING TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  title       TEXT NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category    TEXT NOT NULL,
  frequency   TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  next_date   DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recurring_user_id_idx ON public.recurring_transactions(user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'system' CHECK (type IN ('budget', 'goal', 'bill', 'recurring', 'report', 'system')),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx  ON public.notifications(is_read);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can see their own. Admins can see all.
CREATE POLICY "profiles_select_own"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_select" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- INCOMES
CREATE POLICY "incomes_all_own"  ON public.incomes FOR ALL USING (auth.uid() = user_id);
-- EXPENSES
CREATE POLICY "expenses_all_own" ON public.expenses FOR ALL USING (auth.uid() = user_id);
-- BUDGETS
CREATE POLICY "budgets_all_own"  ON public.budgets FOR ALL USING (auth.uid() = user_id);
-- SAVINGS GOALS
CREATE POLICY "savings_all_own"  ON public.savings_goals FOR ALL USING (auth.uid() = user_id);
-- RECURRING
CREATE POLICY "recurring_all_own" ON public.recurring_transactions FOR ALL USING (auth.uid() = user_id);
-- NOTIFICATIONS
CREATE POLICY "notifications_all_own" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: auto-create profile on sign-up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    'user',
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- TRIGGER: updated_at auto-update
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at               BEFORE UPDATE ON public.profiles               FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_incomes_updated_at                BEFORE UPDATE ON public.incomes                FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_expenses_updated_at               BEFORE UPDATE ON public.expenses               FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_budgets_updated_at                BEFORE UPDATE ON public.budgets                FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_savings_goals_updated_at          BEFORE UPDATE ON public.savings_goals          FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_recurring_transactions_updated_at BEFORE UPDATE ON public.recurring_transactions FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- STORAGE BUCKET for avatars
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- SAMPLE DATA (optional — remove before production)
-- ============================================================
-- To make yourself an admin, run:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
