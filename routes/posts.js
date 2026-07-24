import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

// HELPER: Map Supabase Postgres schema to Frontend schema
function mapPostToFrontend(post, media, author, comments, likes) {
  return {
    _id: post.id,
    author: author ? {
      _id: author.id,
      fullName: author.full_name || author.username,
      username: author.username,
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
  if (!req.user) return res.status(401).json({ error: 'Authentication required to create a post.' });
  const { mediaUrl, mediaType, caption } = req.body;
  if (!mediaUrl && !caption) {
    return res.status(400).json({ error: 'Media URL or caption is required.' });
  }

  try {
    const userId = req.user.id;

    // 1. Ensure profile exists in public.profiles table
    const { data: dbProfile } = await supabase.from('profiles').select('id, full_name, username, profile_image_url').eq('id', userId).maybeSingle();
    if (!dbProfile) {
      await supabase.from('profiles').upsert([{
        id: userId,
        username: req.user.username,
        full_name: req.user.full_name || req.user.username,
        email: req.user.email
      }], { onConflict: 'id' });
    }

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
      let finalMediaUrl = mediaUrl;

      if (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:')) {
        try {
          const matches = mediaUrl.match(/^data:([a-zA-Z0-9\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const isVideo = mimeType.startsWith('video');
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = mimeType.split('/')[1] || (isVideo ? 'mp4' : 'png');
            const bucketName = isVideo ? 'post-videos' : 'post-images';
            const filename = `${userId}/post_${Date.now()}.${ext}`;

            const { error: uploadErr } = await supabase.storage
              .from(bucketName)
              .upload(filename, buffer, { contentType: mimeType, upsert: true });

            if (!uploadErr) {
              const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filename);
              if (publicUrlData?.publicUrl) {
                finalMediaUrl = publicUrlData.publicUrl;
              }
            }
          }
        } catch (uploadExc) {
          console.warn("Storage upload exception:", uploadExc.message);
        }
      }

      const { data: mediaData, error: mediaErr } = await supabase
        .from('post_media')
        .insert([{
          post_id: newPost.id,
          media_url: finalMediaUrl,
          media_type: mediaType || (mediaUrl.includes('video') || mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') ? 'video' : 'image'),
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

    // Increment user post count in profiles table
    try {
      const { count: currentPostCount } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId);
      await supabase.from('profiles').update({ post_count: currentPostCount || 1 }).eq('id', userId);
    } catch (_) {}

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
        // Skip legacy hubble_user placeholder posts
        if (!p.author_profile || p.author_profile.username === 'hubble_user' || p.author_id === '00000000-0000-0000-0000-000000000001') {
          continue;
        }

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
            fullName: c.author_profile.full_name || c.author_profile.username,
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
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: post, error: postError } = await supabase.from('posts').select('author_id').eq('id', postId).single();
    if (postError || !post) return res.status(404).json({ error: 'Post not found.' });

    const { data: existingLike } = await supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
    const isLiked = !existingLike;

    if (isLiked) {
      await supabase.from('likes').insert([{ post_id: postId, user_id: userId, target_type: 'post' }]);
      if (post.author_id && post.author_id !== userId) {
        try {
          await supabase.from('notifications').insert([{
            recipient_id: post.author_id,
            sender_id: userId,
            type: 'like',
            post_id: postId
          }]);
        } catch (_) {}
      }
    } else {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
    }

    const { count: likesCount } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
    await supabase.from('posts').update({ like_count: likesCount || 0 }).eq('id', postId);

    res.json({ likesCount: likesCount || 0, isLiked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/posts/:id/comment', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const postId = req.params.id;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text is required.' });
  const userId = req.user.id;

  try {
    const { data: post, error: postError } = await supabase.from('posts').select('id, author_id').eq('id', postId).single();
    if (postError || !post) return res.status(404).json({ error: 'Post not found.' });

    await supabase.from('comments').insert([{
      post_id: postId,
      author_id: userId,
      content: text
    }]);

    if (post.author_id && post.author_id !== userId) {
      try {
        await supabase.from('notifications').insert([{
          recipient_id: post.author_id,
          sender_id: userId,
          type: 'comment',
          post_id: postId
        }]);
      } catch (_) {}
    }

    const { count: commentsCount } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId);
    await supabase.from('posts').update({ comment_count: commentsCount || 0 }).eq('id', postId);

    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, author_profile:profiles!author_id(id, full_name, username, profile_image_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    const mappedComments = (commentsData || []).map(c => ({
      _id: c.id,
      text: c.content,
      createdAt: c.created_at,
      author: c.author_profile ? {
        _id: c.author_profile.id,
        fullName: c.author_profile.full_name || c.author_profile.username,
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
