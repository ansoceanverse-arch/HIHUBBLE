-- Execute this script in your Supabase SQL Editor

-- Use double quotes to preserve camelCase matching the original MongoDB schema, 
-- ensuring the frontend does not need any modifications.

-- 1. Create Users Table
CREATE TABLE users (
    "_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "fullName" TEXT NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "username" TEXT UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "dob" DATE NOT NULL,
    "age" INT NOT NULL,
    "phoneNumber" TEXT DEFAULT '',
    "preferred2faMethod" TEXT DEFAULT 'email',
    "profileImage" TEXT DEFAULT '',
    "bannerImage" TEXT DEFAULT '',
    "bio" TEXT DEFAULT '',
    "lastActive" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Posts Table
CREATE TABLE posts (
    "_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "author" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" TEXT DEFAULT 'image',
    "caption" TEXT DEFAULT '',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Post Likes Table
CREATE TABLE post_likes (
    "postId" UUID REFERENCES posts("_id") ON DELETE CASCADE,
    "userId" UUID REFERENCES users("_id") ON DELETE CASCADE,
    PRIMARY KEY ("postId", "userId")
);

-- 4. Create Post Comments Table
CREATE TABLE post_comments (
    "_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "postId" UUID REFERENCES posts("_id") ON DELETE CASCADE,
    "author" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Reels Table
CREATE TABLE reels (
    "_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "author" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "videoUrl" TEXT NOT NULL,
    "caption" TEXT DEFAULT '',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create Reel Likes Table
CREATE TABLE reel_likes (
    "reelId" UUID REFERENCES reels("_id") ON DELETE CASCADE,
    "userId" UUID REFERENCES users("_id") ON DELETE CASCADE,
    PRIMARY KEY ("reelId", "userId")
);

-- 7. Create Follows Table
CREATE TABLE follows (
    "followerId" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "followingId" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY ("followerId", "followingId")
);

-- 8. Create Stories Table
CREATE TABLE stories (
    "_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "author" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" TEXT DEFAULT 'image',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create Story Likes Table
CREATE TABLE story_likes (
    "storyId" UUID REFERENCES stories("_id") ON DELETE CASCADE,
    "userId" UUID REFERENCES users("_id") ON DELETE CASCADE,
    PRIMARY KEY ("storyId", "userId")
);

-- 10. Create Notifications Table
CREATE TABLE notifications (
    "_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "recipient" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "sender" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "type" TEXT NOT NULL,
    "post" UUID REFERENCES posts("_id") ON DELETE CASCADE,
    "reel" UUID REFERENCES reels("_id") ON DELETE CASCADE,
    "story" UUID REFERENCES stories("_id") ON DELETE CASCADE,
    "read" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Create Messages Table
CREATE TABLE messages (
    "_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sender" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "recipient" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "mediaName" TEXT,
    "mediaSize" TEXT,
    "read" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Create Calls Table
CREATE TABLE calls (
    "_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "caller" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "recipient" UUID REFERENCES users("_id") ON DELETE CASCADE,
    "status" TEXT DEFAULT 'ringing',
    "offer" TEXT,
    "answer" TEXT,
    "callerCandidates" JSONB DEFAULT '[]'::jsonb,
    "recipientCandidates" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable Row Level Security on all tables so your Node.js backend can access them freely 
-- (Since your backend handles its own authentication via JWT)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE reels DISABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE follows DISABLE ROW LEVEL SECURITY;
ALTER TABLE stories DISABLE ROW LEVEL SECURITY;
ALTER TABLE story_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE calls DISABLE ROW LEVEL SECURITY;
