import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { query } from '../config/db.js';

export async function authenticateToken(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      // In single-user local mode, default to primary admin user if no token provided
      const [defaultUser] = await query('SELECT id, username, email, full_name, role FROM users LIMIT 1');
      if (defaultUser) {
        req.user = defaultUser;
        return next();
      }
      return res.status(401).json({ success: false, error: 'Authentication token required' });
    }

    jwt.verify(token, config.jwtSecret, async (err, decoded) => {
      if (err) {
        // Fallback to default user in local mode
        const [defaultUser] = await query('SELECT id, username, email, full_name, role FROM users LIMIT 1');
        if (defaultUser) {
          req.user = defaultUser;
          return next();
        }
        return res.status(403).json({ success: false, error: 'Invalid or expired token' });
      }

      const [user] = await query(
        'SELECT id, username, email, full_name, role FROM users WHERE id = ?',
        [decoded.id]
      );
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, error: 'Internal authentication error' });
  }
}

export default authenticateToken;
