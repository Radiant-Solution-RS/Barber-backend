const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Access denied. Admin or owner only.' });
  }
  next();
};

const receptionistMiddleware = (req, res, next) => {
  if (req.user.role !== 'receptionist' && req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Access denied. Receptionist, Admin or Owner only.' });
  }
  next();
};

const adminOrReceptionistMiddleware = (req, res, next) => {
  console.log('🔐 Checking admin/receptionist access for user:', req.user);
  if (req.user.role !== 'receptionist' && req.user.role !== 'admin' && req.user.role !== 'owner') {
    console.log('❌ Access denied! User role:', req.user.role);
    return res.status(403).json({ message: 'Access denied. Staff access required.' });
  }
  console.log('✅ Access granted! User role:', req.user.role);
  next();
};

module.exports = { authMiddleware, adminMiddleware, receptionistMiddleware, adminOrReceptionistMiddleware };
