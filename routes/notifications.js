import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { data: notifications, error } = await supabase.from('notifications')
      .select('*, sender:users!sender(_id, fullName, username, profileImage), post:posts(mediaUrl, mediaType, caption), reel:reels(videoUrl, caption), story:stories(mediaUrl, mediaType)')
      .eq('recipient', req.user.id)
      .order('createdAt', { ascending: false });
    if (error) throw error;

    res.json(notifications || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/notifications/read', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase.from('notifications')
      .update({ read: true })
      .eq('recipient', req.user.id)
      .eq('read', false);
    if (error) throw error;
      
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
