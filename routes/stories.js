import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.post('/api/stories', authenticateToken, async (req, res) => {
  const { mediaUrl, mediaType } = req.body;
  if (!mediaUrl) return res.status(400).json({ error: 'Media URL is required.' });

  try {
    const { data: newStory, error } = await supabase.from('stories').insert([{
      author: req.user.id,
      mediaUrl,
      mediaType: mediaType || 'image'
    }]).select('*, author:users!author(_id, fullName, username, profileImage)').single();
    if (error) throw error;

    res.status(201).json({ ...newStory, likes: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/stories', authenticateToken, async (req, res) => {
  try {
    const { data: storiesData, error } = await supabase.from('stories')
      .select('*, author:users!author(_id, fullName, username, profileImage)')
      .order('createdAt', { ascending: false });
    if (error) throw error;

    const stories = [];
    if (storiesData) {
      for (const s of storiesData) {
        const { data: likes } = await supabase.from('story_likes').select('userId').eq('storyId', s._id);
        stories.push({ ...s, likes: likes ? likes.map(l => l.userId) : [] });
      }
    }

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/stories/:id/like', authenticateToken, async (req, res) => {
  const storyId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: story, error: storyError } = await supabase.from('stories').select('author').eq('_id', storyId).single();
    if (storyError || !story) return res.status(404).json({ error: 'Story not found.' });

    const { data: existingLike } = await supabase.from('story_likes').select('userId').eq('storyId', storyId).eq('userId', userId).single();
    const isLiked = !existingLike;

    if (isLiked) {
      await supabase.from('story_likes').insert([{ storyId, userId }]);
      if (story.author !== userId) {
        try {
          await supabase.from('notifications').insert([{
            recipient: story.author,
            sender: userId,
            type: 'like_story',
            story: storyId
          }]);
        } catch (notifErr) {
          console.error("Failed to create story like notification:", notifErr);
        }
      }
    } else {
      await supabase.from('story_likes').delete().eq('storyId', storyId).eq('userId', userId);
    }

    const { count: likesCount } = await supabase.from('story_likes').select('*', { count: 'exact', head: true }).eq('storyId', storyId);
    res.json({ likesCount: likesCount || 0, isLiked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
