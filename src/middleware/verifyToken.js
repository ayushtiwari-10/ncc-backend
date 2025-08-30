import jwt from 'jsonwebtoken';

export default function(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('No Authorization header');
    return res.status(401).json({ message: 'No token' });
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  console.log('Token received:', token);
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('Token verification error:', err.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
    console.log('Token decoded:', decoded);
    req.user = decoded; // contains username
    next();
  });
}
