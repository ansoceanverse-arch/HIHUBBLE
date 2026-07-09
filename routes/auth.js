import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';
import { otps, sendOTPEmailHelper, sendOTPSMSHelper, JWT_SECRET } from '../utils.js';

const router = express.Router();

router.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    type: 'generic'
  });

  const mailResult = await sendOTPEmailHelper(email, otp);
  if (mailResult.success) {
    res.json({ success: true, message: 'OTP sent successfully' });
  } else {
    res.status(500).json({ 
      error: 'Failed to send OTP email via SMTP', 
      details: mailResult.details,
      devFallbackOtp: mailResult.devFallbackOtp
    });
  }
});

router.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  const record = otps.get(email.toLowerCase());
  if (!record) return res.status(400).json({ error: 'No OTP generated for this email' });
  if (Date.now() > record.expiresAt) {
    otps.delete(email.toLowerCase());
    return res.status(400).json({ error: 'OTP has expired' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid verification code' });

  otps.delete(email.toLowerCase());
  res.json({ success: true, message: 'OTP verified successfully' });
});

router.post('/api/auth/signup-otp', async (req, res) => {
  const { fullName, email, username, password, dob, age, phoneNumber, preferred2faMethod } = req.body;
  if (!fullName || !email || !username || !password || !dob || !age) {
    return res.status(400).json({ error: 'All signup fields are required.' });
  }

  const method = preferred2faMethod || 'email';
  if (method === 'sms' && !phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required for SMS 2FA.' });
  }

  try {
    const { data: emailExists } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
    if (emailExists) return res.status(400).json({ error: 'Email already registered.' });

    const { data: usernameExists } = await supabase.from('users').select('*').eq('username', username.toLowerCase()).single();
    if (usernameExists) return res.status(400).json({ error: 'Username already registered.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      type: 'signup',
      payload: { fullName, email, username, password, dob, age, phoneNumber: phoneNumber || '', preferred2faMethod: method }
    });

    let result;
    if (method === 'sms') {
      result = await sendOTPSMSHelper(phoneNumber, otp);
    } else {
      result = await sendOTPEmailHelper(email, otp);
    }

    if (result.success) {
      res.json({ success: true, message: 'OTP sent successfully.', email, phoneNumber: phoneNumber || '', preferred2faMethod: method });
    } else {
      res.status(500).json({
        error: `Failed to send OTP via ${method.toUpperCase()}`,
        details: result.details,
        devFallbackOtp: result.devFallbackOtp,
        email,
        phoneNumber: phoneNumber || '',
        preferred2faMethod: method
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/auth/login-otp', async (req, res) => {
  const { username, password, deliveryMethod } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  try {
    const { data: user } = await supabase.from('users').select('*').eq('username', username.toLowerCase()).single();
    if (!user) return res.status(404).json({ error: 'Username not found. Please sign up.' });

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) return res.status(400).json({ error: 'Invalid password. Please try again.' });

    const preferredMethod = user.preferred2faMethod || 'email';
    const method = deliveryMethod || preferredMethod;

    if (method === 'sms' && !user.phoneNumber) {
      return res.status(400).json({ error: 'No phone number is registered for this account. Please use Email verification.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(user.email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      type: 'login',
      payload: { userId: user._id, email: user.email }
    });

    let result;
    if (method === 'sms') {
      result = await sendOTPSMSHelper(user.phoneNumber, otp);
    } else {
      result = await sendOTPEmailHelper(user.email, otp);
    }

    if (result.success) {
      res.json({
        success: true,
        message: 'OTP sent successfully.',
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        preferred2faMethod: preferredMethod,
        activeDeliveryMethod: method
      });
    } else {
      res.status(500).json({
        error: `Failed to send OTP via ${method.toUpperCase()}`,
        details: result.details,
        devFallbackOtp: result.devFallbackOtp,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        preferred2faMethod: preferredMethod,
        activeDeliveryMethod: method
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/auth/forgot-otp', async (req, res) => {
  const { username, newPassword, deliveryMethod } = req.body;
  if (!username || !newPassword) return res.status(400).json({ error: 'Username and new password are required.' });

  try {
    const { data: user } = await supabase.from('users').select('*').eq('username', username.toLowerCase()).single();
    if (!user) return res.status(404).json({ error: 'Username not found.' });

    const preferredMethod = user.preferred2faMethod || 'email';
    const method = deliveryMethod || preferredMethod;

    if (method === 'sms' && !user.phoneNumber) {
      return res.status(400).json({ error: 'No phone number is registered for this account. Please use Email verification.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(user.email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      type: 'forgot',
      payload: { userId: user._id, newPassword }
    });

    let result;
    if (method === 'sms') {
      result = await sendOTPSMSHelper(user.phoneNumber, otp);
    } else {
      result = await sendOTPEmailHelper(user.email, otp);
    }

    if (result.success) {
      res.json({
        success: true,
        message: 'OTP sent successfully.',
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        preferred2faMethod: preferredMethod,
        activeDeliveryMethod: method
      });
    } else {
      res.status(500).json({
        error: `Failed to send OTP via ${method.toUpperCase()}`,
        details: result.details,
        devFallbackOtp: result.devFallbackOtp,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        preferred2faMethod: preferredMethod,
        activeDeliveryMethod: method
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    if (record.type === 'signup') {
      const { fullName, username, password, dob, age, phoneNumber, preferred2faMethod } = record.payload;

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const { data: newUser, error } = await supabase.from('users').insert([{
        fullName,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        passwordHash,
        dob,
        age,
        phoneNumber: phoneNumber || '',
        preferred2faMethod: preferred2faMethod || 'email'
      }]).select().single();

      if (error) throw error;

      const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        message: 'Account registered successfully.',
        token,
        user: {
          id: newUser._id,
          fullName: newUser.fullName,
          email: newUser.email,
          username: newUser.username,
          dob: newUser.dob,
          age: newUser.age,
          profileImage: newUser.profileImage,
          phoneNumber: newUser.phoneNumber,
          preferred2faMethod: newUser.preferred2faMethod
        }
      });
    }

    if (record.type === 'login') {
      const { userId } = record.payload;
      const { data: user, error } = await supabase.from('users').select('*').eq('_id', userId).single();
      if (error || !user) return res.status(404).json({ error: 'User account not found.' });

      const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        message: 'Signed in successfully.',
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          username: user.username,
          dob: user.dob,
          age: user.age,
          profileImage: user.profileImage,
          phoneNumber: user.phoneNumber,
          preferred2faMethod: user.preferred2faMethod
        }
      });
    }

    if (record.type === 'forgot') {
      const { userId, newPassword } = record.payload;
      const { data: user, error } = await supabase.from('users').select('*').eq('_id', userId).single();
      if (error || !user) return res.status(404).json({ error: 'User account not found.' });

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      const { data: updatedUser, error: updateError } = await supabase.from('users').update({ passwordHash }).eq('_id', userId).select().single();
      if (updateError) throw updateError;

      const token = jwt.sign({ id: updatedUser._id, username: updatedUser.username }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        message: 'Password reset completed successfully.',
        token,
        user: {
          id: updatedUser._id,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          username: updatedUser.username,
          dob: updatedUser.dob,
          age: updatedUser.age,
          profileImage: updatedUser.profileImage,
          phoneNumber: updatedUser.phoneNumber,
          preferred2faMethod: updatedUser.preferred2faMethod
        }
      });
    }

    res.status(400).json({ error: 'Unsupported action verification.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
