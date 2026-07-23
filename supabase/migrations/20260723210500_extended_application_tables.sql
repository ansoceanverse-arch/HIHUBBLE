-- ==============================================================================
-- Migration: 20260723210500_extended_application_tables.sql
-- Description: Creates extended social graph, hashtags, saved collections, calls,
--              devices, sessions, reports, and AI history tables.
-- ==============================================================================

-- 1. ENUMS FOR EXTENDED TABLES
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_status') THEN
        CREATE TYPE follow_status AS ENUM ('pending', 'accepted', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE report_status AS ENUM ('pending', 'investigating', 'resolved', 'dismissed');
    END IF;
END $$;

-- 2. FOLLOWERS & FOLLOW REQUESTS
CREATE TABLE IF NOT EXISTS public.followers (
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS public.follow_requests (
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status follow_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (sender_id, receiver_id)
);

-- 3. SAVED POSTS & COLLECTIONS
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    is_private BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saved_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. HASHTAGS
CREATE TABLE IF NOT EXISTS public.hashtags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    use_count INT DEFAULT 0 CHECK (use_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.post_hashtags (
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    hashtag_id UUID REFERENCES public.hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, hashtag_id)
);

-- 5. AUDIO & VIDEO CALLS
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    initiator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status call_status DEFAULT 'initiating',
    is_video BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.call_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DEVICES & SESSIONS
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AI REQUESTS & HISTORY
CREATE TABLE IF NOT EXISTS public.ai_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    response TEXT,
    model_used VARCHAR(50),
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ROW LEVEL SECURITY
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access for followers" ON public.followers;
CREATE POLICY "Allow public access for followers" ON public.followers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for follow_requests" ON public.follow_requests;
CREATE POLICY "Allow public access for follow_requests" ON public.follow_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for collections" ON public.collections;
CREATE POLICY "Allow public access for collections" ON public.collections FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for saved_posts" ON public.saved_posts;
CREATE POLICY "Allow public access for saved_posts" ON public.saved_posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for hashtags" ON public.hashtags;
CREATE POLICY "Allow public access for hashtags" ON public.hashtags FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for post_hashtags" ON public.post_hashtags;
CREATE POLICY "Allow public access for post_hashtags" ON public.post_hashtags FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for calls" ON public.calls;
CREATE POLICY "Allow public access for calls" ON public.calls FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for call_history" ON public.call_history;
CREATE POLICY "Allow public access for call_history" ON public.call_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for devices" ON public.devices;
CREATE POLICY "Allow public access for devices" ON public.devices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for sessions" ON public.sessions;
CREATE POLICY "Allow public access for sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access for ai_requests" ON public.ai_requests;
CREATE POLICY "Allow public access for ai_requests" ON public.ai_requests FOR ALL USING (true) WITH CHECK (true);
