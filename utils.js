import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { supabase } from './supabase.js';

dotenv.config();

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-replace-me';

// In-memory store for OTPs
export const otps = new Map();

// Map to enforce 25-second cooldown between consecutive email requests
export const lastEmailSentMap = new Map();

// Initialize Nodemailer transport using Gmail SMTP
const emailUser = process.env.GMAIL_USER || process.env.EMAIL_USER || 'ansoceanversetechnologies@gmail.com';
const rawPass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || 'vuyb kilq pfzv ruxw';
const emailPass = rawPass.replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass
  }
});

/**
 * Send 6-Digit Verification Code OTP via Email
 */
export async function sendOTPEmailHelper(targetEmail, otpCode) {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  const now = Date.now();

  // Enforce 25-second cooldown between consecutive emails
  const lastSent = lastEmailSentMap.get(normalizedEmail);
  if (lastSent && (now - lastSent) < 25000) {
    const waitSecs = Math.ceil((25000 - (now - lastSent)) / 1000);
    return {
      success: false,
      details: `Please wait ${waitSecs} seconds before requesting another verification code.`,
      cooldown: waitSecs
    };
  }

  const mailOptions = {
    from: `"HI-HUBBLE" <${emailUser}>`,
    to: normalizedEmail,
    subject: `Your Hi-HUBBLE Verification Code: ${otpCode}`,
    html: `
      <div style="background-color: #0b0914; color: #ffffff; font-family: 'Outfit', 'Inter', Helvetica, Arial, sans-serif; padding: 40px 20px; text-align: center; border-radius: 16px; max-width: 520px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
        <div style="margin-bottom: 24px;">
          <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Hi-HUBBLE ❤️</h1>
          <p style="color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">CONNECT • SHARE • BELONG</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 30px 20px; margin-bottom: 24px;">
          <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px;">Two-Factor Verification Code</h2>
          <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 24px; line-height: 1.5;">Use the 6-digit verification code below to complete your Hi-HUBBLE authentication:</p>
          
          <div style="background: #130f26; border: 2px solid #a855f7; border-radius: 12px; padding: 18px; font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #ffffff; display: inline-block; margin-bottom: 20px;">
            ${otpCode}
          </div>
          
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">This verification code will expire in <strong>5 minutes</strong>.</p>
        </div>
        
        <p style="color: #64748b; font-size: 12px; margin: 0;">If you did not request this verification code, please ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    lastEmailSentMap.set(normalizedEmail, now);
    return { success: true };
  } catch (err) {
    console.error('[Nodemailer Error] Email send failed:', err.message);
    return {
      success: false,
      details: err.message,
      devFallbackOtp: otpCode
    };
  }
}

/**
 * Middleware to authenticate requests using JWTs or local session fallback.
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.token = null;
    req.user = null;
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    // 1. Try decoding custom app JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && decoded.id) {
      req.token = token;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        full_name: decoded.full_name || decoded.fullName || decoded.username
      };

      // Fetch fresh profile details from public.profiles
      try {
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('id, full_name, username, email, profile_image_url, is_private')
          .eq('id', decoded.id)
          .maybeSingle();

        if (dbProfile) {
          req.user.username = dbProfile.username || req.user.username;
          req.user.full_name = dbProfile.full_name || req.user.full_name;
          req.user.profile_image_url = dbProfile.profile_image_url || '';
          req.user.is_private = dbProfile.is_private || false;
        }
      } catch (_) {}

      return next();
    }
  } catch (jwtErr) {
    // 2. Fallback to Supabase Auth user check if custom JWT verify failed
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        req.token = token;
        req.user = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.user_metadata?.username || data.user.email.split('@')[0],
          full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.fullName || data.user.email.split('@')[0]
        };
        return next();
      }
    } catch (_) {}
  }

  req.token = null;
  req.user = null;
  return res.status(401).json({ error: 'Invalid authentication token. Please log in again.' });
}
