import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.get('/api/chats/threads', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: messages, error } = await supabase.from('messages')
      .select('*')
      .or(`sender.eq.${userId},recipient.eq.${userId}`)
      .order('createdAt', { ascending: false });
    if (error) throw error;

    const threadsMap = new Map();
    for (const msg of (messages || [])) {
      const otherUserId = msg.sender === userId ? msg.recipient : msg.sender;
      if (!threadsMap.has(otherUserId)) {
        threadsMap.set(otherUserId, msg);
      }
    }

    const threadUsers = [];
    for (const [otherId, lastMsg] of threadsMap.entries()) {
      const { data: otherUser } = await supabase.from('users').select('_id, fullName, username, profileImage, lastActive').eq('_id', otherId).single();
      if (otherUser) {
        const { count: unreadCount } = await supabase.from('messages').select('*', { count: 'exact', head: true })
          .eq('sender', otherId)
          .eq('recipient', userId)
          .eq('read', false);

        threadUsers.push({
          user: otherUser,
          lastMessage: lastMsg,
          unreadCount: unreadCount || 0
        });
      }
    }

    if (threadUsers.length === 0) {
      const { data: allUsers } = await supabase.from('users').select('_id, fullName, username, profileImage, lastActive').neq('_id', userId).limit(20);
      const suggestedThreads = (allUsers || []).map(u => ({
        user: u,
        lastMessage: null,
        unreadCount: 0
      }));
      return res.json(suggestedThreads);
    }

    res.json(threadUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/chats/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    const { data: messages, error } = await supabase.from('messages')
      .select('*')
      .or(`and(sender.eq.${currentUserId},recipient.eq.${targetUserId}),and(sender.eq.${targetUserId},recipient.eq.${currentUserId})`)
      .order('createdAt', { ascending: true });
    if (error) throw error;

    res.json(messages || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/chats/message', authenticateToken, async (req, res) => {
  try {
    const { recipient, content, mediaUrl, mediaType, mediaName, mediaSize } = req.body;
    if (!recipient || !content) {
      return res.status(400).json({ error: 'Recipient and content are required.' });
    }

    const { data: newMessage, error } = await supabase.from('messages').insert([{
      sender: req.user.id,
      recipient,
      content,
      mediaUrl,
      mediaType,
      mediaName,
      mediaSize
    }]).select().single();
    if (error) throw error;

    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/chats/:userId/read', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const senderId = req.params.userId;

    const { error } = await supabase.from('messages').update({ read: true })
      .eq('sender', senderId)
      .eq('recipient', currentUserId)
      .eq('read', false);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
