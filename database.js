const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

class Database {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        const dbPath = path.join(__dirname, 'users.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database');
                this.createTables();
            }
        });
    }

    createTables() {
        // Users table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Saved database connections
        this.db.run(`
            CREATE TABLE IF NOT EXISTS saved_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                connection_name VARCHAR(100) NOT NULL,
                db_type VARCHAR(20) NOT NULL,
                encrypted_credentials TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('Database tables created/verified');
    }

    // Encryption for credentials
    encryptCredentials(credentials) {
        const algorithm = 'aes-256-cbc';
        const key = this.getEncryptionKey();
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex')
        };
    }

    decryptCredentials(encryptedData) {
        const algorithm = 'aes-256-cbc';
        const key = this.getEncryptionKey();
        const iv = Buffer.from(encryptedData.iv, 'hex');
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    // Helper method to get proper encryption key
    getEncryptionKey() {
        const keyString = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32-chars';
        // Ensure key is exactly 32 bytes for AES-256
        const key = crypto.createHash('sha256').update(keyString).digest();
        return key;
    }

    // User methods
    createUser(username, email, passwordHash) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO users (username, email, password_hash) 
                VALUES (?, ?, ?)
            `);
            
            stmt.run([username, email, passwordHash], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, username, email });
                }
            });
            
            stmt.finalize();
        });
    }

    getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE email = ?',
                [email],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    getUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id, username, email, created_at FROM users WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    // Connection methods
    saveConnection(userId, connectionName, dbType, credentials) {
        return new Promise((resolve, reject) => {
            const encryptedCreds = this.encryptCredentials(credentials);
            
            const stmt = this.db.prepare(`
                INSERT INTO saved_connections (user_id, connection_name, db_type, encrypted_credentials) 
                VALUES (?, ?, ?, ?)
            `);
            
            stmt.run([userId, connectionName, dbType, JSON.stringify(encryptedCreds)], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        id: this.lastID, 
                        connectionName, 
                        dbType,
                        userId 
                    });
                }
            });
            
            stmt.finalize();
        });
    }

    getUserConnections(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, connection_name, db_type, created_at FROM saved_connections WHERE user_id = ? ORDER BY created_at DESC',
                [userId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    getConnection(connectionId, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM saved_connections WHERE id = ? AND user_id = ?',
                [connectionId, userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        try {
                            const encryptedData = JSON.parse(row.encrypted_credentials);
                            const credentials = this.decryptCredentials(encryptedData);
                            resolve({
                                id: row.id,
                                connectionName: row.connection_name,
                                dbType: row.db_type,
                                credentials: credentials,
                                createdAt: row.created_at
                            });
                        } catch (decryptError) {
                            reject(new Error('Failed to decrypt credentials'));
                        }
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    deleteConnection(connectionId, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM saved_connections WHERE id = ? AND user_id = ?',
                [connectionId, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ deletedCount: this.changes });
                    }
                }
            );
        });
    }

    updateConnection(connectionId, userId, connectionName, credentials) {
        return new Promise((resolve, reject) => {
            const encryptedCreds = this.encryptCredentials(credentials);
            
            this.db.run(
                'UPDATE saved_connections SET connection_name = ?, encrypted_credentials = ? WHERE id = ? AND user_id = ?',
                [connectionName, JSON.stringify(encryptedCreds), connectionId, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ updatedCount: this.changes });
                    }
                }
            );
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = Database;