import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.post('/api/users/profile', authenticateToken, async (req, res) => {
  const { profileImage, bio, fullName, username, phoneNumber } = req.body;
  try {
    const userId = req.user.id;
    let newProfileImageUrl = null;

    // 1. If there is a profile image in base64, upload it to Supabase Storage
    if (profileImage && profileImage.startsWith('data:image')) {
      const matches = profileImage.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `${userId}/avatar-${Date.now()}.${ext}`;

        // Upload using native fetch to bypass Supabase JS client Auth header interference
        const uploadRes = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/profile-images/${filename}`, {
          method: 'POST',
          headers: {
            'apikey': process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${req.token}`,
            'Content-Type': `image/${ext}`
          },
          body: buffer
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.message || 'Failed to upload profile image to storage.');
        }

        // The public URL is a deterministic path
        newProfileImageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/profile-images/${filename}`;
      } else if (profileImage.startsWith('http')) {
        // If it's already a URL, just use it
        newProfileImageUrl = profileImage;
      }
    } else if (profileImage && profileImage.startsWith('http')) {
       newProfileImageUrl = profileImage;
    }

    // 2. Prepare updates for the PostgreSQL `profiles` table
    const updates = {};
    if (newProfileImageUrl) updates.profile_image_url = newProfileImageUrl;
    if (bio !== undefined) updates.bio = bio;
    if (fullName !== undefined) updates.full_name = fullName;
    
    // Check username uniqueness if provided
    if (username !== undefined) {
      const trimmedUsername = username.trim().toLowerCase();
      // Check using native fetch or client. We can use native fetch.
      const checkRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?username=eq.${trimmedUsername}&id=neq.${userId}&select=id`, {
        method: 'GET',
        headers: { 'apikey': process.env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${req.token}` }
      });
      const checkData = await checkRes.json();
      if (checkData && checkData.length > 0) {
        return res.status(400).json({ error: 'Username already taken.' });
      }
      updates.username = trimmedUsername;
    }

    if (phoneNumber !== undefined) {
      let targetNumber = phoneNumber.trim().replace(/\s+/g, '');
      if (targetNumber && !targetNumber.startsWith('+')) {
        if (targetNumber.length === 10) targetNumber = '+91' + targetNumber;
        else return res.status(400).json({ error: "Phone number must include a country code starting with '+' (e.g. +919347712945)" });
      }
      updates.phone_number = targetNumber || null;
    }

    // 3. Update the profile
    const updateRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${req.token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    });

    if (!updateRes.ok) {
      const errData = await updateRes.json();
      throw new Error(errData.message || 'Failed to update profile in database.');
    }

    const updatedProfiles = await updateRes.json();
    const updatedUser = updatedProfiles[0];

    // Return the updated user mapped to the camelCase fields expected by frontend
    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser.id,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        username: updatedUser.username,
        profileImage: updatedUser.profile_image_url,
        bio: updatedUser.bio,
        phoneNumber: updatedUser.phone_number
      }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/suggestions', authenticateToken, async (req, res) => {
  if (!req.user) return res.json([]);
  try {
    const currentUserId = req.user.id;
    const limitVal = parseInt(req.query.limit) || 5;

    let followingIds = [];
    try {
      const { data: followingRecords } = await supabase.from('followers').select('following_id').eq('follower_id', currentUserId);
      if (followingRecords) followingIds = followingRecords.map(f => f.following_id);
    } catch (_) {}

    let query = supabase.from('profiles').select('id, full_name, username, profile_image_url, bio').neq('id', currentUserId);
    if (followingIds.length > 0) {
      query = query.not('id', 'in', `(${followingIds.join(',')})`);
    }

    const { data: suggestionsData, error } = await query.limit(limitVal);
    if (error) throw error;

    const suggestions = (suggestionsData || []).map(u => ({
      _id: u.id,
      fullName: u.full_name || u.username,
      username: u.username,
      profileImage: u.profile_image_url || '',
      bio: u.bio || ''
    }));

    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/active', authenticateToken, async (req, res) => {
  if (!req.user) return res.json([]);
  try {
    const currentUserId = req.user.id;
    const activeThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: activeUsersData, error } = await supabase.from('profiles')
      .select('id, full_name, username, profile_image_url, last_active_at')
      .neq('id', currentUserId)
      .gte('last_active_at', activeThreshold);
      
    if (error) {
      return res.json([]);
    }

    const activeUsers = (activeUsersData || []).map(u => ({
      _id: u.id,
      fullName: u.full_name || u.username,
      username: u.username,
      profileImage: u.profile_image_url || '',
      lastActive: u.last_active_at
    }));

    res.json(activeUsers);
  } catch (err) {
    res.json([]);
  }
});

router.post('/api/users/:id/follow', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const targetUserId = req.params.id;
  const currentUserId = req.user.id;

  if (targetUserId === currentUserId) return res.status(400).json({ error: 'You cannot follow yourself.' });

  try {
    const { data: targetProfile, error: targetError } = await supabase.from('profiles').select('id, username, full_name, is_private').eq('id', targetUserId).maybeSingle();
    if (targetError || !targetProfile) return res.status(404).json({ error: 'User to follow not found.' });

    const isPrivate = targetProfile.is_private === true;

    if (isPrivate) {
      // Private account -> Insert pending follow request
      await supabase.from('follow_requests').upsert([{
        sender_id: currentUserId,
        receiver_id: targetUserId,
        status: 'pending'
      }], { onConflict: 'sender_id,receiver_id' });

      try {
        await supabase.from('notifications').insert([{
          recipient_id: targetUserId,
          sender_id: currentUserId,
          type: 'follow_request'
        }]);
      } catch (_) {}

      return res.json({ success: true, status: 'pending', isFollowing: false, message: `Follow request sent to @${targetProfile.username}.` });
    }

    // Public account -> Direct follower relationship
    await supabase.from('followers').upsert([{
      follower_id: currentUserId,
      following_id: targetUserId
    }], { onConflict: 'follower_id,following_id' });

    // Recalculate follower and following counts in database
    try {
      const { count: followerCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', targetUserId);
      await supabase.from('profiles').update({ follower_count: followerCount || 0 }).eq('id', targetUserId);

      const { count: followingCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', currentUserId);
      await supabase.from('profiles').update({ following_count: followingCount || 0 }).eq('id', currentUserId);
    } catch (_) {}

    try {
      await supabase.from('notifications').insert([{
        recipient_id: targetUserId,
        sender_id: currentUserId,
        type: 'follow'
      }]);
    } catch (_) {}

    res.json({ success: true, status: 'following', isFollowing: true, message: `Now following @${targetProfile.username}!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/users/:id/accept-follow-request', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const senderId = req.params.id; // User who sent request
  const currentUserId = req.user.id; // Receiver

  try {
    // 1. Delete follow request
    await supabase.from('follow_requests').delete().eq('sender_id', senderId).eq('receiver_id', currentUserId);

    // 2. Insert follower relationship
    await supabase.from('followers').upsert([{
      follower_id: senderId,
      following_id: currentUserId
    }], { onConflict: 'follower_id,following_id' });

    // 3. Recalculate counts
    try {
      const { count: followerCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', currentUserId);
      await supabase.from('profiles').update({ follower_count: followerCount || 0 }).eq('id', currentUserId);

      const { count: followingCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', senderId);
      await supabase.from('profiles').update({ following_count: followingCount || 0 }).eq('id', senderId);
    } catch (_) {}

    // 4. Send notification
    try {
      await supabase.from('notifications').insert([{
        recipient_id: senderId,
        sender_id: currentUserId,
        type: 'accept_follow_request'
      }]);
    } catch (_) {}

    res.json({ success: true, message: 'Accepted follow request!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/users/:id/reject-follow-request', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const senderId = req.params.id;
  const currentUserId = req.user.id;

  try {
    await supabase.from('follow_requests').delete().eq('sender_id', senderId).eq('receiver_id', currentUserId);
    res.json({ success: true, message: 'Follow request declined.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/users/:id/unfollow', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const targetUserId = req.params.id;
  const currentUserId = req.user.id;

  try {
    await supabase.from('followers').delete().eq('follower_id', currentUserId).eq('following_id', targetUserId);
    await supabase.from('follow_requests').delete().eq('sender_id', currentUserId).eq('receiver_id', targetUserId);

    // Recalculate counts
    try {
      const { count: followerCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', targetUserId);
      await supabase.from('profiles').update({ follower_count: followerCount || 0 }).eq('id', targetUserId);

      const { count: followingCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', currentUserId);
      await supabase.from('profiles').update({ following_count: followingCount || 0 }).eq('id', currentUserId);
    } catch (_) {}

    res.json({ success: true, status: 'none', isFollowing: false, message: 'Unfollowed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id/relations', async (req, res) => {
  const userId = req.params.id;
  try {
    const { count: followersCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId);
    const { count: followingCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', userId);

    res.json({ followersCount: followersCount || 0, followingCount: followingCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/search', authenticateToken, async (req, res) => {
  const query = req.query.q || '';
  if (!query.trim()) return res.json([]);
  if (!req.user) return res.json([]);

  try {
    const { data: matchingUsers, error } = await supabase.from('profiles')
      .select('id, full_name, username, profile_image_url, bio')
      .neq('id', req.user.id)
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`);

    if (error) throw error;

    const { data: myFollowing } = await supabase.from('followers').select('following_id').eq('follower_id', req.user.id);
    const myFollowingSet = new Set(myFollowing ? myFollowing.map(f => f.following_id) : []);

    const results = (matchingUsers || []).map(u => ({
      _id: u.id,
      fullName: u.full_name || u.username,
      username: u.username,
      profileImage: u.profile_image_url || '',
      bio: u.bio || '',
      isFollowing: myFollowingSet.has(u.id)
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id/profile', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const currentUserId = req.user ? req.user.id : null;

  try {
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('id, full_name, username, profile_image_url, cover_image_url, bio, is_private, created_at')
      .eq('id', targetId)
      .single();

    if (userError || !userProfile) return res.status(404).json({ error: 'User not found.' });

    const { count: followersCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', targetId);
    const { count: followingCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', targetId);
    const { count: postsCount } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', targetId);
    
    let isFollowing = false;
    let isPending = false;

    if (currentUserId) {
      const { count: followCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', currentUserId).eq('following_id', targetId);
      isFollowing = (followCount || 0) > 0;

      const { count: reqCount } = await supabase.from('follow_requests').select('*', { count: 'exact', head: true }).eq('sender_id', currentUserId).eq('receiver_id', targetId).eq('status', 'pending');
      isPending = (reqCount || 0) > 0;
    }

    res.json({
      user: {
        _id: userProfile.id,
        fullName: userProfile.full_name || userProfile.username,
        username: userProfile.username,
        profileImage: userProfile.profile_image_url || '',
        bannerImage: userProfile.cover_image_url || '',
        bio: userProfile.bio || '',
        isPrivate: userProfile.is_private || false,
        followersCount: followersCount || 0,
        followingCount: followingCount || 0,
        postsCount: postsCount || 0,
        isFollowing,
        isPending
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
