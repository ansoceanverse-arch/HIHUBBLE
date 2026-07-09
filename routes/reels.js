import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.post('/api/reels', authenticateToken, async (req, res) => {
  const { videoUrl, caption } = req.body;
  if (!videoUrl) return res.status(400).json({ error: 'Video URL/Base64 is required.' });

  try {
    const { data: newReel, error } = await supabase.from('reels').insert([{
      author: req.user.id,
      videoUrl,
      caption: caption || ''
    }]).select('*, author:users!author(_id, fullName, username, profileImage)').single();
    if (error) throw error;

    res.status(201).json({ ...newReel, likes: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/reels', async (req, res) => {
  try {
    const { data: reelsData, error } = await supabase.from('reels')
      .select('*, author:users!author(_id, fullName, username, profileImage)')
      .order('createdAt', { ascending: false });
    if (error) throw error;

    const reels = [];
    if (reelsData) {
      for (const r of reelsData) {
        const { data: likes } = await supabase.from('reel_likes').select('userId').eq('reelId', r._id);
        reels.push({ ...r, likes: likes ? likes.map(l => l.userId) : [] });
      }
    }

    res.json(reels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/reels/:id/like', authenticateToken, async (req, res) => {
  const reelId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: reel, error: reelError } = await supabase.from('reels').select('author').eq('_id', reelId).single();
    if (reelError || !reel) return res.status(404).json({ error: 'Reel not found.' });

    const { data: existingLike } = await supabase.from('reel_likes').select('userId').eq('reelId', reelId).eq('userId', userId).single();
    const isLiked = !existingLike;

    if (isLiked) {
      await supabase.from('reel_likes').insert([{ reelId, userId }]);
      if (reel.author !== userId) {
        try {
          await supabase.from('notifications').insert([{
            recipient: reel.author,
            sender: userId,
            type: 'like_reel',
            reel: reelId
          }]);
        } catch (notifErr) {
          console.error("Failed to create reel like notification:", notifErr);
        }
      }
    } else {
      await supabase.from('reel_likes').delete().eq('reelId', reelId).eq('userId', userId);
    }

    const { count: likesCount } = await supabase.from('reel_likes').select('*', { count: 'exact', head: true }).eq('reelId', reelId);
    res.json({ likesCount: likesCount || 0, isLiked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
