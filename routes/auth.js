import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';
import { otps, sendOTPEmailHelper } from '../utils.js';

const router = express.Router();

// Secret from .env for signing JWTs (must match Supabase JWT secret to work with RLS)
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-replace-me';

// ==========================================
// 1. SIGNUP: Generate OTP and send email
// ==========================================
router.post('/api/auth/signup-otp', async (req, res) => {
  const { fullName, email, username, password, dob } = req.body;
  if (!fullName || !email || !username || !password || !dob) {
    return res.status(400).json({ error: 'All signup fields are required.' });
  }

  try {
    // Pre-check email and username availability
    const { data: emailExists } = await supabase.from('profiles').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (emailExists) return res.status(400).json({ error: 'Email already registered.' });

    const { data: usernameExists } = await supabase.from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle();
    if (usernameExists) return res.status(400).json({ error: 'Username already registered.' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      type: 'signup',
      payload: { fullName, email, username, password, dob }
    });

    // Send via standard Nodemailer (Bypassing Supabase limits)
    const result = await sendOTPEmailHelper(email, otp);

    if (result.success) {
      res.json({ success: true, message: 'OTP sent successfully.' });
    } else {
      res.status(500).json({
        error: `Failed to send OTP via Email`,
        details: result.details,
        devFallbackOtp: result.devFallbackOtp
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. LOGIN: Verify password and send OTP
// ==========================================
router.post('/api/auth/login-otp', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  try {
    // Find user by username or email
    const { data: user } = await supabase.from('profiles')
      .select('*')
      .or(`username.eq.${username.toLowerCase()},email.eq.${username.toLowerCase()}`)
      .maybeSingle();

    if (!user) return res.status(404).json({ error: 'Account not found.' });

    // Verify password
    if (!user.password_hash) return res.status(400).json({ error: 'Password not set. Try resetting.' });
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return res.status(400).json({ error: 'Invalid password. Please try again.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(user.email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      type: 'login',
      payload: { userId: user.id, email: user.email }
    });

    const result = await sendOTPEmailHelper(user.email, otp);

    if (result.success) {
      res.json({ success: true, message: 'OTP sent successfully.', email: user.email });
    } else {
      res.status(500).json({
        error: `Failed to send OTP via Email`,
        details: result.details,
        devFallbackOtp: result.devFallbackOtp
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. VERIFY OTP: Complete Signup / Login
// ==========================================
router.post('/api/auth/verify-action-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

  const record = otps.get(email.toLowerCase());
  if (!record) return res.status(400).json({ error: 'No verification session found for this email.' });
  if (Date.now() > record.expiresAt) {
    otps.delete(email.toLowerCase());
    return res.status(400).json({ error: 'Verification code has expired.' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid verification code.' });

  try {
    otps.delete(email.toLowerCase());

    // --- SIGNUP FLOW ---
    if (record.type === 'signup') {
      const { fullName, username, password, dob } = record.payload;

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      // Insert directly into the public.profiles table (bypassing auth.users)
      const { data: newUser, error } = await supabase.from('profiles').insert([{
        full_name: fullName,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password_hash,
      }]).select().single();

      if (error) throw error;
      
      // Auto-create settings
      await supabase.from('settings').insert([{ user_id: newUser.id }]);

      // Issue custom JWT (Must match Supabase format for RLS!)
      const token = jwt.sign(
        { 
          sub: newUser.id,
          role: 'authenticated', 
          email: newUser.email,
          aud: 'authenticated'
        }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );
      
      return res.json({
        success: true,
        message: 'Account registered successfully.',
        token,
        user: newUser
      });
    }

    // --- LOGIN FLOW ---
    if (record.type === 'login') {
      const { userId } = record.payload;
      const { data: user, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error || !user) return res.status(404).json({ error: 'User account not found.' });

      const token = jwt.sign(
        { 
          sub: user.id,
          role: 'authenticated', 
          email: user.email,
          aud: 'authenticated'
        }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );
      
      return res.json({
        success: true,
        message: 'Login successful.',
        token,
        user
      });
    }

    return res.status(400).json({ error: 'Invalid OTP type.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. FORGOT PASSWORD FLOW
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
