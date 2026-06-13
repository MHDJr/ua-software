-- =====================================================
-- MIGRATION: CREATE STAFF PUSH NOTIFICATION TOKENS TABLE
-- =====================================================

-- 1. Create table for storing staff push notification tokens
CREATE TABLE IF NOT EXISTS public.staff_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    device_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add unique constraint to prevent duplicate subscriptions per user
ALTER TABLE public.staff_push_tokens ADD CONSTRAINT staff_push_tokens_user_id_subscription_key UNIQUE (user_id, subscription);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.staff_push_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
CREATE POLICY "Users can view their own push tokens"
    ON public.staff_push_tokens FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can register their own push tokens"
    ON public.staff_push_tokens FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
    ON public.staff_push_tokens FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Force reload schema cache
NOTIFY pgrst, 'reload schema';
