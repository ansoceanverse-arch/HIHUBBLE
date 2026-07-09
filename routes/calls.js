import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.post('/api/calls/initiate', authenticateToken, async (req, res) => {
  try {
    const { recipientId, offer } = req.body;
    if (!recipientId || !offer) {
      return res.status(400).json({ error: 'recipientId and offer are required.' });
    }

    const { error: cleanupError } = await supabase.from('calls').update({ status: 'ended' })
      .in('status', ['ringing', 'connected'])
      .or(`caller.eq.${req.user.id},recipient.eq.${req.user.id},caller.eq.${recipientId},recipient.eq.${recipientId}`);
    
    if (cleanupError) throw cleanupError;

    const { data: newCall, error } = await supabase.from('calls').insert([{
      caller: req.user.id,
      recipient: recipientId,
      status: 'ringing',
      offer: typeof offer === 'string' ? offer : JSON.stringify(offer),
      callerCandidates: [],
      recipientCandidates: []
    }]).select().single();
    if (error) throw error;

    res.status(201).json(newCall);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/calls/incoming', authenticateToken, async (req, res) => {
  try {
    const { data: incomingCall, error } = await supabase.from('calls')
      .select('*, caller:users!caller(_id, fullName, username, profileImage)')
      .eq('recipient', req.user.id)
      .eq('status', 'ringing')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // Ignore not found error

    res.json(incomingCall || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/calls/accept', authenticateToken, async (req, res) => {
  try {
    const { callId, answer } = req.body;
    if (!callId || !answer) {
      return res.status(400).json({ error: 'callId and answer are required.' });
    }

    const { data: call, error } = await supabase.from('calls').update({
      status: 'connected',
      answer: typeof answer === 'string' ? answer : JSON.stringify(answer)
    }).eq('_id', callId).select().single();
    
    if (error) throw error;
    res.json({ success: true, call });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/calls/decline', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ error: 'callId is required.' });

    const { error } = await supabase.from('calls').update({ status: 'declined' }).eq('_id', callId);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/calls/end', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ error: 'callId is required.' });

    const { error } = await supabase.from('calls').update({ status: 'ended' }).eq('_id', callId);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/calls/ice-candidate', authenticateToken, async (req, res) => {
  try {
    const { callId, candidate, role } = req.body;
    if (!callId || !candidate || !role) {
      return res.status(400).json({ error: 'callId, candidate, and role are required.' });
    }

    const { data: call, error: callError } = await supabase.from('calls').select('callerCandidates, recipientCandidates').eq('_id', callId).single();
    if (callError || !call) return res.status(404).json({ error: 'Call not found.' });

    const updates = {};
    if (role === 'caller') {
      updates.callerCandidates = [...(call.callerCandidates || []), candidate];
    } else if (role === 'recipient') {
      updates.recipientCandidates = [...(call.recipientCandidates || []), candidate];
    } else {
      return res.status(400).json({ error: 'Invalid role. Must be "caller" or "recipient".' });
    }

    const { error } = await supabase.from('calls').update(updates).eq('_id', callId);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/calls/:callId/state', authenticateToken, async (req, res) => {
  try {
    const { data: call, error } = await supabase.from('calls').select('*').eq('_id', req.params.callId).single();
    if (error || !call) return res.status(404).json({ error: 'Call not found.' });

    const isUserCaller = call.caller === req.user.id;
    const peerCandidates = isUserCaller ? call.recipientCandidates : call.callerCandidates;

    res.json({
      status: call.status,
      offer: call.offer,
      answer: call.answer,
      peerCandidates
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
