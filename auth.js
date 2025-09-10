const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        this.saltRounds = 10;
    }

    // Hash password
    async hashPassword(password) {
        return await bcrypt.hash(password, this.saltRounds);
    }

    // Verify password
    async verifyPassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    // Generate JWT token
    generateToken(user) {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                email: user.email
            },
            this.jwtSecret,
            { expiresIn: '24h' }
        );
    }

    // Verify JWT token
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            return null;
        }
    }

    // Middleware to authenticate requests
    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ success: false, error: 'Access token required' });
        }

        const user = this.verifyToken(token);
        if (!user) {
            return res.status(403).json({ success: false, error: 'Invalid or expired token' });
        }

        req.user = user;
        next();
    }
    

    // Validate email format
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate password strength
    isValidPassword(password) {
        // At least 6 characters
        return password && password.length >= 6;
    }

    // Validate username
    isValidUsername(username) {
        // 3-50 characters, alphanumeric and underscore only
        const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
        return usernameRegex.test(username);
    }
}

module.exports = AuthService;