import dotenv from 'dotenv';
import { supabase } from './supabase.js';

dotenv.config();

/**
 * Middleware to authenticate requests using Supabase Auth JWTs.
 * Extracts the Bearer token from the Authorization header and securely validates it.
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Validate the token via Supabase Auth
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      console.error('Supabase token verification failed:', error?.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Attach user data and raw token to request so downstream routes can use it
    req.token = token;
    req.user = {
      id: data.user.id,
      email: data.user.email,
      ...data.user.user_metadata
    };

    // Note: We don't block the request for this background update
    supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', data.user.id)
      .then()
      .catch();

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}
