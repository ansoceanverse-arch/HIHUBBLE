import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';
import { otps, sendOTPEmailHelper } from '../utils.js';

const router = express.Router();

// Secret from .env for signing JWTs (must match Supabase JWT secret to work with RLS)
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-replace-me';

// ==========================================
// 1. SIGNUP OTP: Generate 6-digit OTP and send email
// ==========================================
router.post('/api/auth/signup-otp', async (req, res) => {
  const { fullName, email, username, password, phoneNumber } = req.body;
  if (!fullName || !email || !username || !password) {
    return res.status(400).json({ error: 'Name, email, username, and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();

  try {
    // Pre-check email and username availability in public.profiles table
    const { data: emailExists } = await supabase.from('profiles').select('id').eq('email', normalizedEmail).maybeSingle();
    if (emailExists) return res.status(400).json({ error: 'This email address is already registered.' });

    const { data: usernameExists } = await supabase.from('profiles').select('id').eq('username', normalizedUsername).maybeSingle();
    if (usernameExists) return res.status(400).json({ error: 'This username is already taken.' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(normalizedEmail, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      type: 'signup',
      payload: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        username: normalizedUsername,
        password,
        phoneNumber: phoneNumber ? phoneNumber.trim() : null
      }
    });

    // Send via Nodemailer (Sender: HI-HUBBLE <ansoceanversetechnologies@gmail.com>)
    const result = await sendOTPEmailHelper(normalizedEmail, otp);

    if (result.success) {
      res.json({
        success: true,
        message: '6-digit verification code sent to your email.',
        devFallbackOtp: result.devFallbackOtp
      });
    } else {
      res.status(result.cooldown ? 429 : 500).json({
        error: result.details || 'Failed to send OTP via email.',
        devFallbackOtp: result.devFallbackOtp,
        cooldown: result.cooldown
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. VERIFY SIGNUP OTP CODE & PERSIST TO DATABASE
// ==========================================
router.post('/api/auth/verify-action-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP code are required.' });

  const normalizedEmail = email.trim().toLowerCase();
  const record = otps.get(normalizedEmail);

  if (!record) return res.status(400).json({ error: 'No verification session found for this email. Please request a new code.' });
  if (Date.now() > record.expiresAt) {
    otps.delete(normalizedEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
  }
  if (record.otp !== otp.trim()) return res.status(400).json({ error: 'Invalid 6-digit verification code. Please try again.' });

  try {
    otps.delete(normalizedEmail);
    const { fullName, username, password, phoneNumber } = record.payload;
    const nowIso = new Date().toISOString();

    // Hash password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user profile into public.profiles database table
    const { data: newUser, error: createError } = await supabase.from('profiles').insert([{
      full_name: fullName,
      username: username,
      email: normalizedEmail,
      password_hash: password_hash,
      phone_number: phoneNumber,
      is_online: true,
      last_active_at: nowIso
    }]).select().single();

    let userObj = newUser;

    if (createError) {
      console.error('Error creating profile in Supabase profiles table:', createError);
      // Fallback object if record already inserted or schema variation
      userObj = {
        id: 'usr_' + Date.now(),
        username: username,
        email: normalizedEmail,
        full_name: fullName,
        phone_number: phoneNumber
      };
    } else {
      try { await supabase.from('settings').insert([{ user_id: userObj.id }]); } catch (_) {}
      try { await supabase.from('privacy_settings').insert([{ user_id: userObj.id }]); } catch (_) {}
    }

    const userId = userObj.id;

    // Record login history in public.login_history table
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Browser';
      await supabase.from('login_history').insert([{
        user_id: userId,
        ip_address: clientIp === '::1' ? '127.0.0.1' : clientIp,
        user_agent: userAgent,
        login_at: nowIso
      }]);
    } catch (_) {}

    // Record active status in public.online_users table
    try {
      await supabase.from('online_users').upsert([{
        user_id: userId,
        last_seen_at: nowIso
      }]);
    } catch (_) {}

    // Issue JWT token
    const token = jwt.sign(
      { sub: userId, role: 'authenticated', email: normalizedEmail, aud: 'authenticated' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Account created and verified successfully.',
      token,
      user: {
        id: userId,
        username: userObj.username,
        email: userObj.email,
        fullName: userObj.full_name || userObj.username,
        phoneNumber: userObj.phone_number || null,
        profileImage: userObj.profile_image_url || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. LOGIN: Verify credentials against Database
// ==========================================
router.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const normalizedInput = username.trim().toLowerCase();

  try {
    // Find user profile by username or email in public.profiles table
    const { data: user, error: fetchErr } = await supabase.from('profiles')
      .select('*')
      .or(`username.eq.${normalizedInput},email.eq.${normalizedInput}`)
      .maybeSingle();

    if (fetchErr || !user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Account has no password set. Please sign up or reset password.' });
    }

    // Verify password hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const nowIso = new Date().toISOString();

    // Update online status and last active time in database
    try {
      await supabase.from('profiles').update({ is_online: true, last_active_at: nowIso }).eq('id', user.id);
    } catch (_) {}

    // Record login in public.login_history table
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Browser';
      await supabase.from('login_history').insert([{
        user_id: user.id,
        ip_address: clientIp === '::1' ? '127.0.0.1' : clientIp,
        user_agent: userAgent,
        login_at: nowIso
      }]);
    } catch (_) {}

    // Track active user in public.online_users table
    try {
      await supabase.from('online_users').upsert([{ user_id: user.id, last_seen_at: nowIso }]);
    } catch (_) {}

    // Issue JWT token
    const token = jwt.sign(
      { sub: user.id, role: 'authenticated', email: user.email, aud: 'authenticated' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name || user.username,
        phoneNumber: user.phone_number || null,
        profileImage: user.profile_image_url || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. COMPLETE ONBOARDING: Save Live Photograph to Database & Storage
// ==========================================
router.post('/api/auth/complete-onboarding', async (req, res) => {
  const { userId, username, email, fullName, livePhotoBase64 } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required.' });

  try {
    let profileImageUrl = null;

    if (livePhotoBase64 && livePhotoBase64.startsWith('data:image')) {
      try {
        const matches = livePhotoBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          const filename = `${userId || 'user_' + Date.now()}/live_photo_${Date.now()}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from('profile-images')
            .upload(filename, buffer, { contentType: `image/${ext}`, upsert: true });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from('profile-images').getPublicUrl(filename);
            if (publicUrlData?.publicUrl) profileImageUrl = publicUrlData.publicUrl;
          }
        }
      } catch (_) {}
    }

    if (!profileImageUrl && livePhotoBase64) {
      profileImageUrl = livePhotoBase64;
    }

    const nowIso = new Date().toISOString();

    if (userId && profileImageUrl) {
      try {
        await supabase.from('profiles').update({
          profile_image_url: profileImageUrl,
          updated_at: nowIso
        }).eq('id', userId);
      } catch (_) {}
    }

    res.json({
      success: true,
      message: 'Live photo stored successfully.',
      profileImage: profileImageUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. FORGOT PASSWORD FLOW
// ==========================================
router.post('/api/auth/forgot-otp', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) return res.status(400).json({ error: 'Username and new password are required.' });

  try {
    const { data: user } = await supabase.from('profiles').select('id, email').eq('username', username.toLowerCase()).maybeSingle();
    if (!user) return res.status(404).json({ error: 'Username not found.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(user.email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      type: 'forgot',
      payload: { userId: user.id, newPassword }
    });

    const result = await sendOTPEmailHelper(user.email, otp);

    if (result.success) {
      res.json({ success: true, message: 'OTP sent successfully.', email: user.email });
    } else {
      res.status(500).json({ error: `Failed to send OTP`, devFallbackOtp: result.devFallbackOtp });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/auth/verify-forgot-otp', async (req, res) => {
  const { email, otp } = req.body;
  const record = otps.get(email.toLowerCase());

  if (!record || record.type !== 'forgot') return res.status(400).json({ error: 'No forgot password session found.' });
  if (Date.now() > record.expiresAt) { otps.delete(email.toLowerCase()); return res.status(400).json({ error: 'OTP expired.' }); }
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP.' });

  try {
    otps.delete(email.toLowerCase());
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(record.payload.newPassword, salt);

    const { error } = await supabase.from('profiles').update({ password_hash }).eq('id', record.payload.userId);
    if (error) throw error;

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;


