const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!this.supabaseUrl || !this.supabaseAnonKey || !this.supabaseServiceKey) {
            console.error('Missing Supabase configuration. Please check your .env file.');
            return;
        }

        // Client for frontend operations (with RLS)
        this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
        
        // Admin client for backend operations (bypasses RLS)
        this.supabaseAdmin = createClient(this.supabaseUrl, this.supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        console.log('✅ Supabase service initialized');
    }

    // Verify JWT token from frontend
    async verifyToken(token) {
        try {
            const { data: { user }, error } = await this.supabaseAdmin.auth.getUser(token);
            
            if (error) {
                console.error('Token verification error:', error);
                return null;
            }

            return user;
        } catch (error) {
            console.error('Token verification failed:', error);
            return null;
        }
    }

    // Get user connections
    async getUserConnections(userId) {
        try {
            const { data, error } = await this.supabaseAdmin
                .from('connections')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching connections:', error);
                return { success: false, error: error.message };
            }

            return { success: true, connections: data };
        } catch (error) {
            console.error('Error in getUserConnections:', error);
            return { success: false, error: error.message };
        }
    }

    // Create new connection
    async createConnection(userId, connectionData) {
        try {
            // Encrypt credentials before storing
            const encryptedCredentials = this.encryptCredentials(connectionData.credentials);

            const { data, error } = await this.supabaseAdmin
                .from('connections')
                .insert([{
                    user_id: userId,
                    connection_name: connectionData.connectionName,
                    db_type: connectionData.dbType,
                    credentials: encryptedCredentials
                }])
                .select()
                .single();

            if (error) {
                console.error('Error creating connection:', error);
                return { success: false, error: error.message };
            }

            return { success: true, connection: data };
        } catch (error) {
            console.error('Error in createConnection:', error);
            return { success: false, error: error.message };
        }
    }

    // Update connection
    async updateConnection(userId, connectionId, connectionData) {
        try {
            // Encrypt credentials before storing
            const encryptedCredentials = this.encryptCredentials(connectionData.credentials);

            const { data, error } = await this.supabaseAdmin
                .from('connections')
                .update({
                    connection_name: connectionData.connectionName,
                    db_type: connectionData.dbType,
                    credentials: encryptedCredentials,
                    updated_at: new Date().toISOString()
                })
                .eq('id', connectionId)
                .eq('user_id', userId) // Ensure user owns the connection
                .select()
                .single();

            if (error) {
                console.error('Error updating connection:', error);
                return { success: false, error: error.message };
            }

            if (!data) {
                return { success: false, error: 'Connection not found or access denied' };
            }

            return { success: true, connection: data };
        } catch (error) {
            console.error('Error in updateConnection:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete connection
    async deleteConnection(userId, connectionId) {
        try {
            const { error } = await this.supabaseAdmin
                .from('connections')
                .delete()
                .eq('id', connectionId)
                .eq('user_id', userId); // Ensure user owns the connection

            if (error) {
                console.error('Error deleting connection:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Error in deleteConnection:', error);
            return { success: false, error: error.message };
        }
    }

    // Get single connection
    async getConnection(userId, connectionId) {
        try {
            const { data, error } = await this.supabaseAdmin
                .from('connections')
                .select('*')
                .eq('id', connectionId)
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Error fetching connection:', error);
                return { success: false, error: error.message };
            }

            if (!data) {
                return { success: false, error: 'Connection not found or access denied' };
            }

            // Decrypt credentials before returning
            const decryptedConnection = {
                ...data,
                credentials: this.decryptCredentials(data.credentials)
            };

            return { success: true, connection: decryptedConnection };
        } catch (error) {
            console.error('Error in getConnection:', error);
            return { success: false, error: error.message };
        }
    }

    // Encrypt credentials (using existing crypto logic)
    encryptCredentials(credentials) {
        const crypto = require('crypto');
        const algorithm = 'aes-256-cbc';
        const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encrypted: encrypted,
            iv: iv.toString('hex')
        };
    }

    // Decrypt credentials (using existing crypto logic)
    decryptCredentials(encryptedData) {
        try {
            const crypto = require('crypto');
            const algorithm = 'aes-256-cbc';
            const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
            const iv = Buffer.from(encryptedData.iv, 'hex');

            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Error decrypting credentials:', error);
            return null;
        }
    }

    // Middleware for protecting routes
    async authenticateRequest(req, res, next) {
        try {
            console.log('🔐 Authenticating request...');
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                console.log('❌ No authorization header or invalid format');
                return res.status(401).json({ success: false, error: 'No token provided' });
            }

            const token = authHeader.substring(7);
            console.log('🎫 Token received, verifying...');
            
            const user = await this.verifyToken(token);

            if (!user) {
                console.log('❌ Token verification failed');
                return res.status(401).json({ success: false, error: 'Invalid or expired token' });
            }

            console.log('✅ User authenticated:', user.email);
            req.user = user;
            next();
        } catch (error) {
            console.error('❌ Authentication middleware error:', error);
            res.status(500).json({ success: false, error: 'Authentication failed' });
        }
    }
}

module.exports = SupabaseService;