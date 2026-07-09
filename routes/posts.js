import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.post('/api/posts', authenticateToken, async (req, res) => {
  const { mediaUrl, mediaType, caption } = req.body;
  if (!mediaUrl) return res.status(400).json({ error: 'Media URL/Base64 is required.' });

  try {
    const { data: newPost, error } = await supabase.from('posts').insert([{
      author: req.user.id,
      mediaUrl,
      mediaType: mediaType || 'image',
      caption: caption || ''
    }]).select('*, author:users!author(_id, fullName, username, profileImage)').single();
    if (error) throw error;

    res.status(201).json({ ...newPost, likes: [], comments: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/posts', async (req, res) => {
  try {
    const { data: postsData, error } = await supabase.from('posts')
      .select('*, author:users!author(_id, fullName, username, profileImage)')
      .order('createdAt', { ascending: false });
    if (error) throw error;

    const posts = [];
    if (postsData) {
      for (const p of postsData) {
        const { data: comments } = await supabase.from('post_comments').select('*, author:users!author(_id, fullName, username, profileImage)').eq('postId', p._id);
        const { data: likes } = await supabase.from('post_likes').select('userId').eq('postId', p._id);
        posts.push({ ...p, comments: comments || [], likes: likes ? likes.map(l => l.userId) : [] });
      }
    }

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: post, error: postError } = await supabase.from('posts').select('author').eq('_id', postId).single();
    if (postError || !post) return res.status(404).json({ error: 'Post not found.' });

    const { data: existingLike } = await supabase.from('post_likes').select('userId').eq('postId', postId).eq('userId', userId).single();
    const isLiked = !existingLike;

    if (isLiked) {
      await supabase.from('post_likes').insert([{ postId, userId }]);
      if (post.author !== userId) {
        try {
          await supabase.from('notifications').insert([{
            recipient: post.author,
            sender: userId,
            type: 'like_post',
            post: postId
          }]);
        } catch (notifErr) {
          console.error("Failed to create post like notification:", notifErr);
        }
      }
    } else {
      await supabase.from('post_likes').delete().eq('postId', postId).eq('userId', userId);
    }

    const { count: likesCount } = await supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('postId', postId);
    res.json({ likesCount: likesCount || 0, isLiked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/posts/:id/comment', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text is required.' });

  try {
    const { data: post, error: postError } = await supabase.from('posts').select('_id').eq('_id', postId).single();
    if (postError || !post) return res.status(404).json({ error: 'Post not found.' });

    await supabase.from('post_comments').insert([{
      postId,
      author: req.user.id,
      text
    }]);

    const { data: comments, error: commentsError } = await supabase.from('post_comments')
      .select('*, author:users!author(_id, fullName, username, profileImage)')
      .eq('postId', postId);
    if (commentsError) throw commentsError;

    res.json(comments || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
