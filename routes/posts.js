import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

// HELPER: Map Supabase Postgres schema to Frontend MongoDB-style schema
function mapPostToFrontend(post, media, author, comments, likes) {
  return {
    _id: post.id,
    author: author ? {
      _id: author.id,
      fullName: author.full_name || author.username || 'Hubble User',
      username: author.username || 'hubble_user',
      profileImage: author.profile_image_url || ''
    } : null,
    caption: post.caption || '',
    mediaUrl: media && media.length > 0 ? media[0].media_url : '',
    mediaType: media && media.length > 0 ? media[0].media_type : 'image',
    location: post.location || '',
    createdAt: post.created_at,
    likes: likes || [],
    comments: comments || []
  };
}

router.post('/api/posts', authenticateToken, async (req, res) => {
  const { mediaUrl, mediaType, caption } = req.body;
  if (!mediaUrl && !caption) {
    return res.status(400).json({ error: 'Media URL or caption is required.' });
  }

  try {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';

    // 1. Ensure profile exists in public.profiles table
    await supabase.from('profiles').upsert([{
      id: userId,
      username: req.user?.username || 'hubble_user',
      full_name: req.user?.full_name || req.user?.username || 'Hubble User',
      email: req.user?.email || 'hubble_user@hihubble.com'
    }], { onConflict: 'id' });

    // 2. Insert Post via Supabase JS SDK
    const { data: newPost, error: postErr } = await supabase
      .from('posts')
      .insert([{
        author_id: userId,
        caption: caption || ''
      }])
      .select()
      .single();

    if (postErr) throw postErr;

    // 3. Insert Post Media if provided
    let newMediaArr = [];
    if (mediaUrl) {
      const { data: mediaData, error: mediaErr } = await supabase
        .from('post_media')
        .insert([{
          post_id: newPost.id,
          media_url: mediaUrl,
          media_type: mediaType || 'image',
          display_order: 1
        }])
        .select();

      if (mediaErr) console.warn("Media insert warning:", mediaErr.message);
      newMediaArr = mediaData || [];
    }

    // 4. Get Author Profile
    const { data: authorProfile } = await supabase
      .from('profiles')
      .select('id, full_name, username, profile_image_url')
      .eq('id', userId)
      .maybeSingle();

    const mappedPost = mapPostToFrontend(newPost, newMediaArr, authorProfile, [], []);
    res.status(201).json(mappedPost);
  } catch (err) {
    console.error("POST /api/posts error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/posts', async (req, res) => {
  try {
    const { data: postsData, error } = await supabase
      .from('posts')
      .select(`
        *,
        author_profile:profiles!author_id(id, full_name, username, profile_image_url),
        media:post_media(media_url, media_type)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("GET /api/posts notice:", error.message);
      return res.json([]);
    }

    const posts = [];
    if (postsData) {
      for (const p of postsData) {
        // Fetch comments
        const { data: commentsData } = await supabase
          .from('comments')
          .select('*, author_profile:profiles!author_id(id, full_name, username, profile_image_url)')
          .eq('post_id', p.id)
          .order('created_at', { ascending: true });

        const mappedComments = (commentsData || []).map(c => ({
          _id: c.id,
          text: c.content,
          createdAt: c.created_at,
          author: c.author_profile ? {
            _id: c.author_profile.id,
            fullName: c.author_profile.full_name,
            username: c.author_profile.username,
            profileImage: c.author_profile.profile_image_url
          } : null
        }));

        // Fetch likes
        const { data: likesData } = await supabase
          .from('likes')
          .select('user_id')
          .eq('post_id', p.id);

        const mappedLikes = (likesData || []).map(l => l.user_id);

        posts.push(mapPostToFrontend(p, p.media || [], p.author_profile, mappedComments, mappedLikes));
      }
    }

    res.json(posts);
  } catch (err) {
    console.error("GET /api/posts error:", err);
    res.json([]);
  }
});

router.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';

  try {
    const { data: post, error: postError } = await supabase.from('posts').select('author_id').eq('id', postId).single();
    if (postError || !post) return res.status(404).json({ error: 'Post not found.' });

    const { data: existingLike } = await supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
    const isLiked = !existingLike;

    if (isLiked) {
      await supabase.from('likes').insert([{ post_id: postId, user_id: userId }]);
    } else {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
    }

    const { count: likesCount } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
    res.json({ likesCount: likesCount || 0, isLiked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/posts/:id/comment', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text is required.' });
  const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';

  try {
    const { data: post, error: postError } = await supabase.from('posts').select('id').eq('id', postId).single();
    if (postError || !post) return res.status(404).json({ error: 'Post not found.' });

    await supabase.from('comments').insert([{
      post_id: postId,
      author_id: userId,
      content: text
    }]);

    const { data: commentsData, error: commentsError } = await supabase
      .from('comments')
      .select('*, author_profile:profiles!author_id(id, full_name, username, profile_image_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (commentsError) throw commentsError;

    const mappedComments = (commentsData || []).map(c => ({
      _id: c.id,
      text: c.content,
      createdAt: c.created_at,
      author: c.author_profile ? {
        _id: c.author_profile.id,
        fullName: c.author_profile.full_name,
        username: c.author_profile.username,
        profileImage: c.author_profile.profile_image_url
      } : null
    }));

    res.json(mappedComments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
