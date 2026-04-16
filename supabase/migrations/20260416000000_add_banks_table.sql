-- Create banks table
CREATE TABLE IF NOT EXISTS public.banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own banks' AND tablename = 'banks'
  ) THEN
    CREATE POLICY "Users can manage their own banks" ON public.banks
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add bank_id to wallets
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES public.banks(id) ON DELETE SET NULL;

-- Initial Migration Logic (Populate banks from existing wallets)
DO $$
DECLARE
    r RECORD;
    new_bank_id uuid;
BEGIN
    FOR r IN (SELECT DISTINCT institution_name, user_id, color FROM wallets WHERE institution_name IS NOT NULL) LOOP
        -- Check if bank already exists for this name/user
        SELECT id INTO new_bank_id FROM banks WHERE name = r.institution_name AND user_id = r.user_id LIMIT 1;
        
        IF new_bank_id IS NULL THEN
            INSERT INTO banks (name, color, user_id)
            VALUES (r.institution_name, r.color, r.user_id)
            RETURNING id INTO new_bank_id;
        END IF;

        -- Update wallets
        UPDATE wallets SET bank_id = new_bank_id WHERE (institution_name = r.institution_name) AND user_id = r.user_id;
    END LOOP;
END $$;
