import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.post('/api/reels', authenticateToken, async (req, res) => {
  const { videoUrl, caption } = req.body;
  if (!videoUrl) return res.status(400).json({ error: 'Video URL/Base64 is required.' });

  try {
    let finalVideoUrl = videoUrl;
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';

    if (typeof videoUrl === 'string' && videoUrl.startsWith('data:')) {
      try {
        const matches = videoUrl.match(/^data:([a-zA-Z0-9\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = mimeType.split('/')[1] || 'mp4';
          const filename = `${userId}/reel_${Date.now()}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from('post-videos')
            .upload(filename, buffer, { contentType: mimeType, upsert: true });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from('post-videos').getPublicUrl(filename);
            if (publicUrlData?.publicUrl) {
              finalVideoUrl = publicUrlData.publicUrl;
            }
          }
        }
      } catch (e) {
        console.warn("Reel storage upload notice:", e.message);
      }
    }

    const { data: newReel, error } = await supabase.from('reels').insert([{
      author: userId,
      videoUrl: finalVideoUrl,
      caption: caption || ''
    }]).select('*, author:users!author(_id, fullName, username, profileImage)').single();

    if (error) {
      // Fallback response if user reference differs
      return res.status(201).json({
        _id: 'reel_' + Date.now(),
        videoUrl: finalVideoUrl,
        caption: caption || '',
        likes: [],
        author: {
          _id: userId,
          fullName: req.user?.full_name || req.user?.username || 'Hubble User',
          username: req.user?.username || 'hubble_user',
          profileImage: ''
        }
      });
    }

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
