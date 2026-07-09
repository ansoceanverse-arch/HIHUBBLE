import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.post('/api/users/profile', authenticateToken, async (req, res) => {
  const { profileImage, bio, fullName, username, phoneNumber, preferred2faMethod } = req.body;
  try {
    const { data: user, error: userError } = await supabase.from('users').select('*').eq('_id', req.user.id).single();
    if (userError || !user) return res.status(404).json({ error: 'User not found.' });

    const updates = {};
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (bio !== undefined) updates.bio = bio;
    if (fullName !== undefined) updates.fullName = fullName;
    if (username !== undefined) {
      const trimmedUsername = username.trim().toLowerCase();
      const { data: existingUser } = await supabase.from('users').select('_id').eq('username', trimmedUsername).neq('_id', req.user.id).single();
      if (existingUser) return res.status(400).json({ error: 'Username already taken.' });
      updates.username = trimmedUsername;
    }

    if (phoneNumber !== undefined) {
      let targetNumber = phoneNumber.trim().replace(/\s+/g, '');
      if (targetNumber && !targetNumber.startsWith('+')) {
        if (targetNumber.length === 10) {
          targetNumber = '+91' + targetNumber;
        } else {
          return res.status(400).json({ error: "Phone number must include a country code starting with '+' (e.g. +919347712945)" });
        }
      }
      updates.phoneNumber = targetNumber || '';
    }

    if (preferred2faMethod !== undefined) {
      if (preferred2faMethod && !['email', 'sms'].includes(preferred2faMethod)) {
        return res.status(400).json({ error: 'Preferred 2FA method must be either "email" or "sms"' });
      }
      updates.preferred2faMethod = preferred2faMethod || 'email';
    }

    const { data: updatedUser, error: updateError } = await supabase.from('users').update(updates).eq('_id', req.user.id).select().single();
    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        username: updatedUser.username,
        dob: updatedUser.dob,
        age: updatedUser.age,
        profileImage: updatedUser.profileImage,
        bio: updatedUser.bio,
        phoneNumber: updatedUser.phoneNumber,
        preferred2faMethod: updatedUser.preferred2faMethod
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/suggestions', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const limitVal = parseInt(req.query.limit) || 5;

    const { data: followingRecords } = await supabase.from('follows').select('followingId').eq('followerId', currentUserId);
    const followingIds = followingRecords ? followingRecords.map(f => f.followingId) : [];

    let query = supabase.from('users').select('_id, fullName, username, profileImage, bio').neq('_id', currentUserId);
    if (followingIds.length > 0) {
      query = query.not('_id', 'in', `(${followingIds.join(',')})`);
    }

    const { data: suggestions, error } = await query.limit(limitVal);
    if (error) throw error;

    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/active', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const activeThreshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: activeUsers, error } = await supabase.from('users')
      .select('_id, fullName, username, profileImage, lastActive')
      .neq('_id', currentUserId)
      .gte('lastActive', activeThreshold);
      
    if (error) throw error;
    res.json(activeUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/users/:id/follow', authenticateToken, async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = req.user.id;

  if (targetUserId === currentUserId) return res.status(400).json({ error: 'You cannot follow yourself.' });

  try {
    const { data: targetUser, error: targetError } = await supabase.from('users').select('username').eq('_id', targetUserId).single();
    if (targetError || !targetUser) return res.status(404).json({ error: 'User to follow not found.' });

    const { error: followError } = await supabase.from('follows').insert([{ followerId: currentUserId, followingId: targetUserId }]);
    
    if (followError) {
      if (followError.code === '23505') return res.json({ success: true, message: 'Already following this user.' });
      throw followError;
    }

    try {
      await supabase.from('notifications').insert([{
        recipient: targetUserId,
        sender: currentUserId,
        type: 'follow'
      }]);
    } catch (notifErr) {
      console.error("Failed to create follow notification:", notifErr);
    }

    res.json({ success: true, message: `Hubbies with @${targetUser.username}!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/users/:id/unfollow', authenticateToken, async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = req.user.id;

  try {
    const { data, error } = await supabase.from('follows').delete().eq('followerId', currentUserId).eq('followingId', targetUserId).select();
    if (error) throw error;
    if (!data || data.length === 0) return res.status(400).json({ error: 'You are not following this user.' });

    res.json({ success: true, message: 'Unfollowed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id/relations', async (req, res) => {
  const userId = req.params.id;
  try {
    const { count: followersCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followingId', userId);
    const { count: followingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followerId', userId);

    res.json({ followersCount: followersCount || 0, followingCount: followingCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id/followers-list', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const currentUserId = req.user.id;

  try {
    const { data: followers, error } = await supabase.from('follows').select('followerId:users!followerId(_id, fullName, username, profileImage, bio)').eq('followingId', targetId);
    if (error) throw error;

    const { data: myFollowing } = await supabase.from('follows').select('followingId').eq('followerId', currentUserId);
    const myFollowingSet = new Set(myFollowing ? myFollowing.map(f => f.followingId) : []);

    const results = followers.map(f => {
      const u = f.followerId;
      if (!u) return null;
      return {
        _id: u._id,
        fullName: u.fullName,
        username: u.username,
        profileImage: u.profileImage,
        bio: u.bio,
        isFollowing: myFollowingSet.has(u._id),
        isMe: u._id === currentUserId
      };
    }).filter(Boolean);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id/following-list', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const currentUserId = req.user.id;

  try {
    const { data: following, error } = await supabase.from('follows').select('followingId:users!followingId(_id, fullName, username, profileImage, bio)').eq('followerId', targetId);
    if (error) throw error;

    const { data: myFollowing } = await supabase.from('follows').select('followingId').eq('followerId', currentUserId);
    const myFollowingSet = new Set(myFollowing ? myFollowing.map(f => f.followingId) : []);

    const results = following.map(f => {
      const u = f.followingId;
      if (!u) return null;
      return {
        _id: u._id,
        fullName: u.fullName,
        username: u.username,
        profileImage: u.profileImage,
        bio: u.bio,
        isFollowing: myFollowingSet.has(u._id),
        isMe: u._id === currentUserId
      };
    }).filter(Boolean);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/search', authenticateToken, async (req, res) => {
  const query = req.query.q || '';
  if (!query.trim()) return res.json([]);

  try {
    const { data: matchingUsers, error } = await supabase.from('users')
      .select('_id, fullName, username, profileImage, bio')
      .neq('_id', req.user.id)
      .or(`username.ilike.%${query}%,fullName.ilike.%${query}%`);
    if (error) throw error;

    const { data: myFollowing } = await supabase.from('follows').select('followingId').eq('followerId', req.user.id);
    const myFollowingSet = new Set(myFollowing ? myFollowing.map(f => f.followingId) : []);

    const results = matchingUsers.map(u => ({
      _id: u._id,
      fullName: u.fullName,
      username: u.username,
      profileImage: u.profileImage,
      bio: u.bio,
      isFollowing: myFollowingSet.has(u._id)
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id/profile', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const currentUserId = req.user.id;

  try {
    const { data: user, error: userError } = await supabase.from('users').select('_id, fullName, username, profileImage, bannerImage, bio, createdAt').eq('_id', targetId).single();
    if (userError || !user) return res.status(404).json({ error: 'User not found.' });

    const { count: followersCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followingId', targetId);
    const { count: followingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followerId', targetId);
    const { count: isFollowingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followerId', currentUserId).eq('followingId', targetId);

    const { data: postsData } = await supabase.from('posts').select('*, author:users!author(_id, fullName, username, profileImage)').eq('author', targetId).order('createdAt', { ascending: false });
    const { data: reels } = await supabase.from('reels').select('*, author:users!author(_id, fullName, username, profileImage)').eq('author', targetId).order('createdAt', { ascending: false });

    const posts = [];
    if (postsData) {
      for (const p of postsData) {
        const { data: comments } = await supabase.from('post_comments').select('*, author:users!author(_id, fullName, username, profileImage)').eq('postId', p._id);
        const { data: likes } = await supabase.from('post_likes').select('userId').eq('postId', p._id);
        posts.push({ ...p, comments: comments || [], likes: likes ? likes.map(l => l.userId) : [] });
      }
    }

    if (reels) {
      for (const r of reels) {
        const { data: likes } = await supabase.from('reel_likes').select('userId').eq('reelId', r._id);
        r.likes = likes ? likes.map(l => l.userId) : [];
      }
    }

    res.json({
      user: {
        ...user,
        followersCount: followersCount || 0,
        followingCount: followingCount || 0,
        isFollowing: (isFollowingCount || 0) > 0
      },
      posts,
      reels: reels || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
