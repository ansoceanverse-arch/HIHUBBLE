import dotenv from 'dotenv';
import { supabase } from './supabase.js';

dotenv.config();

/**
 * Middleware to authenticate requests using Supabase Auth JWTs or local session fallback.
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    // Default fallback user if no token provided
    req.token = process.env.SUPABASE_ANON_KEY;
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'hubble_user@hihubble.com',
      username: 'hubble_user',
      full_name: 'Hubble User'
    };
    return next();
  }

  try {
    // Validate the token via Supabase Auth if it's a Supabase JWT
    const { data, error } = await supabase.auth.getUser(token);
    
    if (!error && data?.user) {
      req.token = token;
      req.user = {
        id: data.user.id,
        email: data.user.email,
        ...data.user.user_metadata
      };
      return next();
    }

    // Fallback for custom / local onboarding session token
    req.token = process.env.SUPABASE_ANON_KEY;
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'hubble_user@hihubble.com',
      username: 'hubble_user',
      full_name: 'Hubble User'
    };
    next();
  } catch (err) {
    req.token = process.env.SUPABASE_ANON_KEY;
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'hubble_user@hihubble.com',
      username: 'hubble_user',
      full_name: 'Hubble User'
    };
    next();
  }
}
