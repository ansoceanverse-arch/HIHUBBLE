import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.get('/api/notifications', authenticateToken, async (req, res) => {
  if (!req.user) return res.json([]);
  try {
    const { data: notificationsData, error } = await supabase
      .from('notifications')
      .select(`
        *,
        sender_profile:profiles!sender_id(id, full_name, username, profile_image_url)
      `)
      .eq('recipient_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback try with recipient column
      const { data: altNotifs } = await supabase
        .from('notifications')
        .select(`
          *,
          sender_profile:profiles!sender_id(id, full_name, username, profile_image_url)
        `)
        .eq('recipient', req.user.id)
        .order('created_at', { ascending: false });
        
      return res.json(mapNotifications(altNotifs || []));
    }

    res.json(mapNotifications(notificationsData || []));
  } catch (err) {
    console.error("Notifications error:", err);
    res.json([]);
  }
});

function mapNotifications(items) {
  return items.map(item => {
    const sender = item.sender_profile || {};
    const username = sender.username || 'user';
    const fullName = sender.full_name || username;
    const profileImage = sender.profile_image_url || '';

    let text = `${fullName} interacted with you.`;
    switch (item.type) {
      case 'follow':
        text = `${fullName} (@${username}) started following you.`;
        break;
      case 'follow_request':
        text = `${fullName} (@${username}) requested to follow you.`;
        break;
      case 'accept_follow_request':
        text = `${fullName} (@${username}) accepted your follow request.`;
        break;
      case 'like':
        text = `${fullName} (@${username}) liked your post.`;
        break;
      case 'comment':
        text = `${fullName} (@${username}) commented on your post.`;
        break;
    }

    return {
      _id: item.id,
      type: item.type,
      text,
      createdAt: item.created_at || item.createdAt,
      isRead: item.is_read || item.read || false,
      sender: {
        _id: sender.id || 'usr_unknown',
        fullName,
        username,
        profileImage
      }
    };
  });
}

router.post('/api/notifications/read', authenticateToken, async (req, res) => {
  if (!req.user) return res.json({ success: false });
  try {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', req.user.id);
    } catch (_) {}
    try {
      await supabase.from('notifications').update({ read: true }).eq('recipient', req.user.id);
    } catch (_) {}
      
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
