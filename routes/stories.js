import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.post('/api/stories', authenticateToken, async (req, res) => {
  const { mediaUrl, mediaType, isDraft } = req.body;
  if (!mediaUrl) return res.status(400).json({ error: 'Media URL is required.' });

  try {
    const finalMediaType = isDraft ? `draft-${mediaType || 'image'}` : (mediaType || 'image');
    
    const { data: newStory, error } = await supabase.from('stories').insert([{
      author: req.user.id,
      mediaUrl,
      mediaType: finalMediaType
    }]).select('*, author:users!author(_id, fullName, username, profileImage)').single();
    if (error) throw error;

    res.status(201).json({ ...newStory, likes: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/stories', authenticateToken, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: storiesData, error } = await supabase.from('stories')
      .select('*, author:users!author(_id, fullName, username, profileImage)')
      .gt('createdAt', twentyFourHoursAgo)
      .order('createdAt', { ascending: false });
    if (error) throw error;

    const stories = [];
    if (storiesData) {
      for (const s of storiesData) {
        if (s.mediaType && s.mediaType.startsWith('draft-')) continue;
        const { data: likes } = await supabase.from('story_likes').select('userId').eq('storyId', s._id);
        stories.push({ ...s, likes: likes ? likes.map(l => l.userId) : [] });
      }
    }

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/stories/drafts', authenticateToken, async (req, res) => {
  try {
    const { data: drafts, error } = await supabase.from('stories')
      .select('*, author:users!author(_id, fullName, username, profileImage)')
      .like('mediaType', 'draft-%')
      .eq('author', req.user.id)
      .order('createdAt', { ascending: false });
    if (error) throw error;

    res.json(drafts || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/stories/:id/publish', authenticateToken, async (req, res) => {
  const storyId = req.params.id;
  try {
    const { data: story, error: fetchError } = await supabase.from('stories').select('author, mediaType').eq('_id', storyId).single();
    if (fetchError || !story) return res.status(404).json({ error: 'Story not found.' });
    if (story.author !== req.user.id) return res.status(403).json({ error: 'Unauthorized.' });

    const newMediaType = story.mediaType ? story.mediaType.replace('draft-', '') : 'image';
    const { data: updatedStory, error: updateError } = await supabase.from('stories')
      .update({ mediaType: newMediaType, createdAt: new Date().toISOString() })
      .eq('_id', storyId)
      .select('*, author:users!author(_id, fullName, username, profileImage)')
      .single();
      
    if (updateError) throw updateError;
    res.json(updatedStory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/stories/:id', authenticateToken, async (req, res) => {
  const storyId = req.params.id;
  try {
    const { data: story, error: fetchError } = await supabase.from('stories').select('author').eq('_id', storyId).single();
    if (fetchError || !story) return res.status(404).json({ error: 'Story not found.' });
    if (story.author !== req.user.id) return res.status(403).json({ error: 'Unauthorized.' });

    const { error: deleteError } = await supabase.from('stories').delete().eq('_id', storyId);
    if (deleteError) throw deleteError;
    
    res.json({ message: 'Story deleted successfully.' });
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
