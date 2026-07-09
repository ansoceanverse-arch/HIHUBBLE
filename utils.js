import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { supabase } from './supabase.js';

dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'hi_hubble_secret_key_12345';

// Temporary in-memory store for OTPs
export const otps = new Map();

// Nodemailer Transporter
export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'ansoceanversetechnologies@gmail.com',
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendOTPEmailHelper(email, otp) {
  const mailOptions = {
    from: `"Hi-Hubble Support" <${process.env.EMAIL_USER || 'ansoceanversetechnologies@gmail.com'}>`,
    to: email,
    subject: 'Hi-Hubble Verification Code',
    text: `Hello,\n\nPlease use the following verification code to complete your request:\n\n${otp}\n\nThis code is valid for 5 minutes. If you did not request this verification, please ignore this email.\n\nBest regards,\nHi-Hubble Support`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-top: 0;">Hi-Hubble Verification Code</h2>
        <p>Hello,</p>
        <p>Please use the following One-Time Password (OTP) to verify your account. This code is valid for 5 minutes.</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #4f46e5; margin: 20px 0; background-color: #f8fafc; padding: 12px 20px; border-radius: 6px; display: inline-block; border: 1px solid #e2e8f0;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #64748b;">If you did not request this verification, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 11px; color: #94a3b8;">Sent by Hi-Hubble Support Team</p>
      </div>
    `
  };

  try {
    if (!process.env.EMAIL_PASS || process.env.EMAIL_PASS === 'your_gmail_app_password') {
      throw new Error("SMTP credentials are not configured in the .env file.");
    }
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent successfully to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error.message);
    console.log('\x1b[33m%s\x1b[0m', `[DEVELOPMENT MODE - OTP CODE FOR ${email} IS: ${otp}]`);
    return { success: false, devFallbackOtp: otp, details: error.message };
  }
}

export async function sendOTPSMSHelper(phoneNumber, otp) {
  let targetNumber = (phoneNumber || '').trim().replace(/\s+/g, '');
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone || accountSid === 'your_twilio_sid') {
      throw new Error("Twilio credentials are not configured in the .env file.");
    }

    if (!targetNumber.startsWith('+')) {
      if (targetNumber.length === 10) {
        targetNumber = '+91' + targetNumber;
      } else {
        throw new Error("Phone number must include a country code starting with '+' (e.g. +919347712945)");
      }
    }

    const twilioModule = await import('twilio');
    const twilio = twilioModule.default;
    const client = twilio(accountSid, authToken);

    await client.messages.create({
      body: `Your Hi-Hubble verification code is: ${otp}. It is valid for 5 minutes.`,
      from: twilioPhone,
      to: targetNumber
    });

    console.log(`OTP sent successfully to SMS: ${targetNumber}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending SMS to', targetNumber, ':', error.message);
    console.log('\x1b[33m%s\x1b[0m', `[DEVELOPMENT MODE - OTP CODE FOR MOBILE ${targetNumber} IS: ${otp}]`);
    return { success: false, devFallbackOtp: otp, details: error.message };
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;

    // Asynchronously update user's lastActive timestamp
    try {
      await supabase.from('users').update({ lastActive: new Date().toISOString() }).eq('_id', decoded.id);
    } catch (e) {
      console.error('Error updating lastActive in middleware:', e.message);
    }

    next();
  });
}
