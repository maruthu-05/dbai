require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Database = require('./database');
const AuthService = require('./auth');
const SupabaseService = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const db = new Database();
const auth = new AuthService();
const supabase = new SupabaseService();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Gemini AI integration
async function generateQueryWithGemini(naturalLanguage, dbType, selectedTables = [], tableSchemas = null) {
    console.log('=== GEMINI QUERY GENERATION START ===');
    console.log('Natural Language:', naturalLanguage);
    console.log('DB Type:', dbType);
    console.log('Selected Tables:', selectedTables);
    console.log('Table Schemas Available:', !!tableSchemas);

    try {
        // Check if API key is available
        if (!process.env.GEMINI_API_KEY) {
            console.log('❌ GEMINI API KEY NOT FOUND - Using fallback');
            return generateFallbackQuery(naturalLanguage, dbType, selectedTables);
        }

        console.log('✅ GEMINI API KEY FOUND');

        // Create detailed schema information for Gemini
        let schemaDetails = '';
        if (tableSchemas && Object.keys(tableSchemas).length > 0) {
            console.log('✅ BUILDING SCHEMA DETAILS FOR GEMINI');
            schemaDetails = '\n\nDETAILED TABLE SCHEMAS:\n';
            Object.keys(tableSchemas).forEach(tableName => {
                schemaDetails += `\nTable: ${tableName}\n`;
                if (tableSchemas[tableName].length > 0) {
                    tableSchemas[tableName].forEach(column => {
                        schemaDetails += `  - ${column.name} (${column.type})`;
                        if (column.key === 'PRI') schemaDetails += ' [PRIMARY KEY]';
                        if (!column.nullable) schemaDetails += ' [NOT NULL]';
                        schemaDetails += '\n';
                    });
                } else {
                    schemaDetails += '  - No columns found\n';
                }
            });
            schemaDetails += '\nIMPORTANT: You MUST use these exact column names in your query!\n';
            console.log('Schema Details Built:', schemaDetails);
        } else {
            console.log('❌ NO SCHEMA INFORMATION AVAILABLE FOR GEMINI');
        }

        let prompt;
        if (dbType === 'mysql') {
            prompt = `You are an expert MySQL query generator. Convert the following natural language request into a precise MySQL query.

${schemaDetails ? 'AVAILABLE TABLE SCHEMAS:' + schemaDetails : 'Available tables: ' + selectedTables.join(', ')}

Natural language request: "${naturalLanguage}"

CRITICAL REQUIREMENTS:
1. Generate ONLY the SQL query - no explanations, no markdown, no extra text
2. ${schemaDetails ? 'Use ONLY the exact column names listed in the schemas above' : 'Use common column names like id, name, email, created_at'}
3. For SELECT queries, include LIMIT clause (maximum 100 rows)
4. End with semicolon
5. Support all SQL operations: SELECT, INSERT, UPDATE, DELETE
6. For INSERT, use proper column names and data types
7. For UPDATE, include WHERE clause to avoid updating all rows
8. For DELETE, include WHERE clause to avoid deleting all rows
9. Use proper WHERE clauses for filtering
10. Use appropriate data types for comparisons

${schemaDetails ? 'EXAMPLES with your schema:' : 'EXAMPLES:'}
${schemaDetails ?
                    `- SELECT: SELECT column1, column2, column3 FROM ${selectedTables[0]} LIMIT 100;
- COUNT: SELECT COUNT(*) as total FROM ${selectedTables[0]};
- INSERT: INSERT INTO ${selectedTables[0]} (column1, column2) VALUES ('value1', 'value2');
- UPDATE: UPDATE ${selectedTables[0]} SET column1 = 'new_value' WHERE id = 1;
- DELETE: DELETE FROM ${selectedTables[0]} WHERE id = 1;` :
                    `- SELECT * FROM ${selectedTables[0]} LIMIT 100;
- INSERT INTO ${selectedTables[0]} (name, email) VALUES ('John', 'john@email.com');
- UPDATE ${selectedTables[0]} SET name = 'Jane' WHERE id = 1;
- DELETE FROM ${selectedTables[0]} WHERE id = 1;`}

Generate the MySQL query now:`;
        } else {
            prompt = `You are an expert MongoDB query generator. Convert the following natural language request into a precise MongoDB query.

${schemaDetails ? 'AVAILABLE COLLECTION SCHEMAS:' + schemaDetails : 'Available collections: ' + selectedTables.join(', ')}

Natural language request: "${naturalLanguage}"

CRITICAL REQUIREMENTS:
1. Generate ONLY the MongoDB query - no explanations, no markdown, no extra text
2. ${schemaDetails ? 'Use ONLY the exact field names listed in the schemas above' : 'Use common field names like _id, name, email, createdAt'}
3. For find queries, include .limit() clause (maximum 100 documents)
4. Support all MongoDB operations: find, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany
5. For insert operations, use proper field names and data types
6. For update operations, use proper update operators ($set, $inc, $push, etc.)
7. For delete operations, include proper filter criteria
8. Use proper MongoDB operators ($eq, $gt, $gte, $regex, etc.)

${schemaDetails ? 'EXAMPLES with your schema:' : 'EXAMPLES:'}
${schemaDetails ?
                    `- FIND: db.${selectedTables[0]}.find({}).limit(100)
- COUNT: db.${selectedTables[0]}.countDocuments({})
- INSERT: db.${selectedTables[0]}.insertOne({field1: "value1", field2: "value2"})
- UPDATE: db.${selectedTables[0]}.updateOne({_id: ObjectId("...")}, {$set: {field1: "new_value"}})
- DELETE: db.${selectedTables[0]}.deleteOne({_id: ObjectId("...")})` :
                    `- db.${selectedTables[0]}.find({}).limit(100)
- db.${selectedTables[0]}.insertOne({name: "John", email: "john@email.com"})
- db.${selectedTables[0]}.updateOne({_id: ObjectId("...")}, {$set: {name: "Jane"}})
- db.${selectedTables[0]}.deleteOne({_id: ObjectId("...")})`}

Generate the MongoDB query now:`;
        }

        console.log('📤 SENDING PROMPT TO GEMINI:');
        console.log('--- PROMPT START ---');
        console.log(prompt);
        console.log('--- PROMPT END ---');

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let query = response.text().trim();

        console.log('📥 RAW GEMINI RESPONSE:', query);

        // Clean up the response - remove any markdown formatting
        query = query.replace(/```sql\n?/g, '').replace(/```mongodb\n?/g, '').replace(/```\n?/g, '');
        query = query.replace(/^Query:\s*/i, '');
        query = query.replace(/^\s*```\s*/g, '').replace(/\s*```\s*$/g, '');

        console.log('✅ CLEANED GEMINI QUERY:', query);
        console.log('=== GEMINI QUERY GENERATION SUCCESS ===');

        return query;

    } catch (error) {
        console.error('❌ GEMINI API ERROR:', error);
        console.log('🔄 FALLING BACK TO SIMPLE QUERY GENERATION');
        console.log('=== GEMINI QUERY GENERATION FAILED ===');
        // Fallback to simple query generation
        return generateFallbackQuery(naturalLanguage, dbType, selectedTables);
    }
}

// Fallback query generation when Gemini API fails
function generateFallbackQuery(naturalLanguage, dbType, selectedTables = []) {
    console.log('🔄 USING FALLBACK QUERY GENERATION');
    console.log('Input:', naturalLanguage);
    console.log('DB Type:', dbType);
    console.log('Tables:', selectedTables);

    const lower = naturalLanguage.toLowerCase();
    const firstTable = selectedTables[0] || 'users';

    if (dbType === 'mysql') {
        if (lower.includes('all') || lower.includes('show all')) {
            return `SELECT * FROM ${firstTable} LIMIT 100;`;
        } else if (lower.includes('count')) {
            return `SELECT COUNT(*) as total_count FROM ${firstTable};`;
        } else if (lower.includes('recent') || lower.includes('last month')) {
            return `SELECT * FROM ${firstTable} WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH) ORDER BY created_at DESC;`;
        } else if (lower.includes('latest') || lower.includes('newest')) {
            return `SELECT * FROM ${firstTable} ORDER BY created_at DESC LIMIT 10;`;
        } else {
            return `SELECT * FROM ${firstTable} LIMIT 10;`;
        }
    } else {
        if (lower.includes('all') || lower.includes('show all')) {
            return `db.${firstTable}.find({}).limit(100)`;
        } else if (lower.includes('count')) {
            return `db.${firstTable}.countDocuments({})`;
        } else if (lower.includes('recent') || lower.includes('last month')) {
            return `db.${firstTable}.find({"createdAt": {"$gte": new Date(Date.now() - 30*24*60*60*1000)}}).sort({"createdAt": -1})`;
        } else {
            return `db.${firstTable}.find({}).limit(10)`;
        }
    }
}

// Test database connection
app.post('/api/test-connection', async (req, res) => {
    const { dbType, credentials } = req.body;

    try {
        if (dbType === 'mysql') {
            const connection = await mysql.createConnection({
                host: credentials.host,
                port: credentials.port,
                user: credentials.username,
                password: credentials.password,
                database: credentials.database || 'information_schema' // Use information_schema as default for testing
            });

            await connection.ping();
            await connection.end();

        } else if (dbType === 'mongodb') {
            let uri;
            if (credentials.username && credentials.password) {
                // Include authSource parameter for authentication database
                const authSource = credentials.authDatabase || 'admin';
                uri = `mongodb://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.database || 'admin'}?authSource=${authSource}`;
            } else {
                uri = `mongodb://${credentials.host}:${credentials.port}/${credentials.database || 'admin'}`;
            }

            console.log('MongoDB connection URI:', uri.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in log

            const client = new MongoClient(uri);
            await client.connect();
            await client.db(credentials.database || 'test').admin().ping();
            await client.close();
        }

        res.json({ success: true, message: 'Connection successful' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Get tables/collections from database
app.post('/api/get-tables', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    const { dbType, credentials } = req.body;

    try {
        let tables = [];

        if (dbType === 'mysql') {
            const connection = await mysql.createConnection({
                host: credentials.host,
                port: credentials.port,
                user: credentials.username,
                password: credentials.password,
                database: credentials.database
            });

            const [rows] = await connection.execute('SHOW TABLES');
            tables = rows.map(row => ({
                name: Object.values(row)[0],
                type: 'table'
            }));

            await connection.end();

        } else if (dbType === 'mongodb') {
            let uri;
            if (credentials.username && credentials.password) {
                const authSource = credentials.authDatabase || 'admin';
                uri = `mongodb://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.database || 'test'}?authSource=${authSource}`;
            } else {
                uri = `mongodb://${credentials.host}:${credentials.port}/${credentials.database || 'test'}`;
            }

            const client = new MongoClient(uri);
            await client.connect();
            const db = client.db(credentials.database || 'test');

            const collections = await db.listCollections().toArray();
            tables = collections.map(col => ({
                name: col.name,
                type: 'collection'
            }));

            await client.close();
        }

        res.json({ success: true, tables });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get table schemas (column names and data types)
app.post('/api/get-table-schemas', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    const { dbType, credentials, selectedTables } = req.body;

    try {
        const schemas = await getTableSchemas(dbType, credentials, selectedTables);
        res.json({ success: true, schemas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to get table schemas
async function getTableSchemas(dbType, credentials, selectedTables) {
    let schemas = {};

    if (dbType === 'mysql') {
        const connection = await mysql.createConnection({
            host: credentials.host,
            port: credentials.port,
            user: credentials.username,
            password: credentials.password,
            database: credentials.database
        });

        for (const tableName of selectedTables) {
            console.log(`Describing table: ${tableName}`);

            // Sanitize table name to prevent SQL injection
            const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

            try {
                const [columns] = await connection.execute(
                    `DESCRIBE \`${sanitizedTableName}\``
                );

                console.log(`Found ${columns.length} columns in ${tableName}:`, columns);

                schemas[tableName] = columns.map(col => ({
                    name: col.Field,
                    type: col.Type,
                    nullable: col.Null === 'YES',
                    key: col.Key,
                    default: col.Default
                }));

                console.log(`Schema for ${tableName}:`, schemas[tableName]);
            } catch (tableError) {
                console.error(`Error describing table ${tableName}:`, tableError.message);
                schemas[tableName] = [];
            }
        }

        await connection.end();

    } else if (dbType === 'mongodb') {
        let uri;
        if (credentials.username && credentials.password) {
            const authSource = credentials.authDatabase || 'admin';
            uri = `mongodb://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.database || 'test'}?authSource=${authSource}`;
        } else {
            uri = `mongodb://${credentials.host}:${credentials.port}/${credentials.database || 'test'}`;
        }

        const client = new MongoClient(uri);
        await client.connect();
        const db = client.db(credentials.database || 'test');

        for (const collectionName of selectedTables) {
            console.log(`Sampling collection: ${collectionName}`);

            // Sample a few documents to infer schema
            const sampleDocs = await db.collection(collectionName)
                .find({})
                .limit(10)
                .toArray();

            console.log(`Found ${sampleDocs.length} sample documents in ${collectionName}`);

            if (sampleDocs.length > 0) {
                const fieldTypes = {};

                sampleDocs.forEach(doc => {
                    Object.keys(doc).forEach(field => {
                        const value = doc[field];
                        let type;

                        if (value === null || value === undefined) {
                            type = 'null';
                        } else if (Array.isArray(value)) {
                            type = 'array';
                        } else if (value instanceof Date) {
                            type = 'date';
                        } else if (typeof value === 'object' && value.constructor.name === 'ObjectId') {
                            type = 'ObjectId';
                        } else if (typeof value === 'object') {
                            type = 'object';
                        } else {
                            type = typeof value;
                        }

                        if (!fieldTypes[field]) {
                            fieldTypes[field] = new Set();
                        }
                        fieldTypes[field].add(type);
                    });
                });

                schemas[collectionName] = Object.keys(fieldTypes).map(field => ({
                    name: field,
                    type: Array.from(fieldTypes[field]).join(' | '),
                    nullable: true
                }));

                console.log(`Schema for ${collectionName}:`, schemas[collectionName]);
            } else {
                schemas[collectionName] = [];
                console.log(`No documents found in ${collectionName}`);
            }
        }

        await client.close();
    }

    return schemas;
}

// Generate query using Gemini AI
app.post('/api/generate-query', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    const { naturalLanguage, dbType, selectedTables, credentials } = req.body;

    try {
        // Use environment variable API key only
        if (!process.env.GEMINI_API_KEY) {
            return res.status(400).json({
                success: false,
                error: 'Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.'
            });
        }

        // Fetch table schemas for better query generation
        let tableSchemas = null;
        try {
            console.log('Fetching schemas for tables:', selectedTables);
            tableSchemas = await getTableSchemas(dbType, credentials, selectedTables);
            console.log('Fetched schemas:', JSON.stringify(tableSchemas, null, 2));
        } catch (schemaError) {
            console.error('Could not fetch schemas:', schemaError.message);
        }

        console.log('Generating query with schemas:', tableSchemas ? 'YES' : 'NO');
        const query = await generateQueryWithGemini(naturalLanguage, dbType, selectedTables, tableSchemas);
        console.log('Generated query:', query);

        res.json({ success: true, query });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});



// Execute database query
app.post('/api/execute-query', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    const { query, dbType, credentials } = req.body;

    try {
        let results;

        if (dbType === 'mysql') {
            const connection = await mysql.createConnection({
                host: credentials.host,
                port: credentials.port,
                user: credentials.username,
                password: credentials.password,
                database: credentials.database
            });

            const [rows] = await connection.execute(query);

            // Handle different types of MySQL queries
            if (query.trim().toUpperCase().startsWith('SELECT')) {
                results = rows;
            } else if (query.trim().toUpperCase().startsWith('INSERT')) {
                results = [{
                    message: 'Insert successful',
                    affectedRows: rows.affectedRows,
                    insertId: rows.insertId
                }];
            } else if (query.trim().toUpperCase().startsWith('UPDATE')) {
                results = [{
                    message: 'Update successful',
                    affectedRows: rows.affectedRows,
                    changedRows: rows.changedRows
                }];
            } else if (query.trim().toUpperCase().startsWith('DELETE')) {
                results = [{
                    message: 'Delete successful',
                    affectedRows: rows.affectedRows
                }];
            } else {
                results = rows;
            }

            await connection.end();

        } else if (dbType === 'mongodb') {
            let uri;
            if (credentials.username && credentials.password) {
                const authSource = credentials.authDatabase || 'admin';
                uri = `mongodb://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.database || 'test'}?authSource=${authSource}`;
            } else {
                uri = `mongodb://${credentials.host}:${credentials.port}/${credentials.database || 'test'}`;
            }

            const client = new MongoClient(uri);
            await client.connect();
            const db = client.db(credentials.database || 'test');

            // Parse and execute MongoDB query
            try {
                if (query.includes('find(')) {
                    const collection = query.match(/db\.(\w+)\.find/)[1];
                    const cursor = db.collection(collection).find({});
                    results = await cursor.limit(100).toArray();
                } else if (query.includes('countDocuments')) {
                    const collection = query.match(/db\.(\w+)\.countDocuments/)[1];
                    const count = await db.collection(collection).countDocuments({});
                    results = [{ count }];
                } else if (query.includes('insertOne')) {
                    const match = query.match(/db\.(\w+)\.insertOne\((.+)\)/);
                    if (match) {
                        const collection = match[1];
                        const docString = match[2];
                        const document = eval('(' + docString + ')'); // Note: In production, use a proper JSON parser
                        const result = await db.collection(collection).insertOne(document);
                        results = [{
                            message: 'Insert successful',
                            insertedId: result.insertedId,
                            acknowledged: result.acknowledged
                        }];
                    }
                } else if (query.includes('insertMany')) {
                    const match = query.match(/db\.(\w+)\.insertMany\((.+)\)/);
                    if (match) {
                        const collection = match[1];
                        const docsString = match[2];
                        const documents = eval('(' + docsString + ')'); // Note: In production, use a proper JSON parser
                        const result = await db.collection(collection).insertMany(documents);
                        results = [{
                            message: 'Insert many successful',
                            insertedCount: result.insertedCount,
                            insertedIds: result.insertedIds,
                            acknowledged: result.acknowledged
                        }];
                    }
                } else if (query.includes('updateOne')) {
                    const match = query.match(/db\.(\w+)\.updateOne\((.+),\s*(.+)\)/);
                    if (match) {
                        const collection = match[1];
                        const filterString = match[2];
                        const updateString = match[3];
                        const filter = eval('(' + filterString + ')');
                        const update = eval('(' + updateString + ')');
                        const result = await db.collection(collection).updateOne(filter, update);
                        results = [{
                            message: 'Update successful',
                            matchedCount: result.matchedCount,
                            modifiedCount: result.modifiedCount,
                            acknowledged: result.acknowledged
                        }];
                    }
                } else if (query.includes('updateMany')) {
                    const match = query.match(/db\.(\w+)\.updateMany\((.+),\s*(.+)\)/);
                    if (match) {
                        const collection = match[1];
                        const filterString = match[2];
                        const updateString = match[3];
                        const filter = eval('(' + filterString + ')');
                        const update = eval('(' + updateString + ')');
                        const result = await db.collection(collection).updateMany(filter, update);
                        results = [{
                            message: 'Update many successful',
                            matchedCount: result.matchedCount,
                            modifiedCount: result.modifiedCount,
                            acknowledged: result.acknowledged
                        }];
                    }
                } else if (query.includes('deleteOne')) {
                    const match = query.match(/db\.(\w+)\.deleteOne\((.+)\)/);
                    if (match) {
                        const collection = match[1];
                        const filterString = match[2];
                        const filter = eval('(' + filterString + ')');
                        const result = await db.collection(collection).deleteOne(filter);
                        results = [{
                            message: 'Delete successful',
                            deletedCount: result.deletedCount,
                            acknowledged: result.acknowledged
                        }];
                    }
                } else if (query.includes('deleteMany')) {
                    const match = query.match(/db\.(\w+)\.deleteMany\((.+)\)/);
                    if (match) {
                        const collection = match[1];
                        const filterString = match[2];
                        const filter = eval('(' + filterString + ')');
                        const result = await db.collection(collection).deleteMany(filter);
                        results = [{
                            message: 'Delete many successful',
                            deletedCount: result.deletedCount,
                            acknowledged: result.acknowledged
                        }];
                    }
                } else if (query.includes('show collections')) {
                    const collections = await db.listCollections().toArray();
                    results = collections.map(c => ({ name: c.name }));
                } else {
                    results = [{ error: 'Unsupported MongoDB operation' }];
                }
            } catch (mongoError) {
                console.error('MongoDB execution error:', mongoError);
                results = [{ error: 'MongoDB query execution failed: ' + mongoError.message }];
            }

            await client.close();
        }

        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test Gemini API endpoint
app.get('/api/test-gemini', async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.json({ success: false, error: 'No API key found' });
        }

        const testPrompt = 'Generate a simple MySQL query to select all users. Respond with only the SQL query.';
        const result = await model.generateContent(testPrompt);
        const response = await result.response;
        const text = response.text();

        res.json({
            success: true,
            prompt: testPrompt,
            response: text,
            apiKeyPresent: !!process.env.GEMINI_API_KEY
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            apiKeyPresent: !!process.env.GEMINI_API_KEY
        });
    }
});

// Authentication endpoints
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // Validation
        if (!auth.isValidUsername(username)) {
            return res.status(400).json({
                success: false,
                error: 'Username must be 3-50 characters and contain only letters, numbers, and underscores'
            });
        }

        if (!auth.isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Please enter a valid email address'
            });
        }

        if (!auth.isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters long'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: 'Passwords do not match'
            });
        }

        // Check if user already exists
        const existingUserByUsername = await db.getUserByUsername(username);
        if (existingUserByUsername) {
            return res.status(400).json({
                success: false,
                error: 'Username already exists'
            });
        }

        const existingUserByEmail = await db.getUserByEmail(email);
        if (existingUserByEmail) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Hash password and create user
        const passwordHash = await auth.hashPassword(password);
        const user = await db.createUser(username, email, passwordHash);

        res.json({
            success: true,
            message: 'User created successfully',
            user: { id: user.id, username: user.username, email: user.email }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during registration'
        });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        // Get user from database
        const user = await db.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        // Verify password
        const isValidPassword = await auth.verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        // Generate token
        const token = auth.generateToken(user);

        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during login'
        });
    }
});

app.get('/api/verify-token', auth.authenticateToken.bind(auth), async (req, res) => {
    try {
        // Get fresh user data
        const user = await db.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            user: user
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Legacy connection endpoints removed - using Supabase endpoints instead

app.get('/api/connections', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await supabase.getUserConnections(userId);

        if (result.success) {
            res.json({
                success: true,
                connections: result.connections
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Get connections error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load connections'
        });
    }
});

// Legacy connection endpoints removed - using Supabase endpoints instead

// Get connection for query interface
app.get('/api/selected-connection', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    try {
        const connectionId = req.query.id;
        const userId = req.user.id;

        if (!connectionId) {
            return res.status(400).json({
                success: false,
                error: 'Connection ID is required'
            });
        }

        const result = await supabase.getConnection(userId, connectionId);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error || 'Connection not found'
            });
        }

        res.json({
            success: true,
            connection: {
                id: result.connection.id,
                name: result.connection.connection_name,
                dbType: result.connection.db_type,
                credentials: result.connection.credentials
            }
        });

    } catch (error) {
        console.error('Get selected connection error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load connection'
        });
    }
});

// Serve Supabase config to frontend
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// Supabase authentication endpoints
app.post('/api/connections', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    try {
        const userId = req.user.id;
        const connectionData = req.body;

        const result = await supabase.createConnection(userId, connectionData);
        
        if (result.success) {
            res.json({ success: true, connection: result.connection });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error creating connection:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.put('/api/connections/:id', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    try {
        const userId = req.user.id;
        const connectionId = req.params.id;
        const connectionData = req.body;

        const result = await supabase.updateConnection(userId, connectionId, connectionData);
        
        if (result.success) {
            res.json({ success: true, connection: result.connection });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error updating connection:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.delete('/api/connections/:id', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    try {
        const userId = req.user.id;
        const connectionId = req.params.id;

        const result = await supabase.deleteConnection(userId, connectionId);
        
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error deleting connection:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/api/connections/:id', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    try {
        const userId = req.user.id;
        const connectionId = req.params.id;

        const result = await supabase.getConnection(userId, connectionId);
        
        if (result.success) {
            res.json({ success: true, connection: result.connection });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error fetching connection:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Supabase Connection Management Endpoints
app.post('/api/connections', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    try {
        console.log('📝 Creating new connection...');
        const userId = req.user.id;
        const connectionData = req.body;

        const result = await supabase.createConnection(userId, connectionData);
        
        if (result.success) {
            console.log('✅ Connection created successfully');
            res.json({ success: true, connection: result.connection });
        } else {
            console.log('❌ Failed to create connection:', result.error);
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('❌ Error creating connection:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.put('/api/connections/:id', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    try {
        console.log('📝 Updating connection...');
        const userId = req.user.id;
        const connectionId = req.params.id;
        const connectionData = req.body;

        const result = await supabase.updateConnection(userId, connectionId, connectionData);
        
        if (result.success) {
            console.log('✅ Connection updated successfully');
            res.json({ success: true, connection: result.connection });
        } else {
            console.log('❌ Failed to update connection:', result.error);
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('❌ Error updating connection:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.delete('/api/connections/:id', supabase.authenticateRequest.bind(supabase), async (req, res) => {
    try {
        console.log('🗑️ Deleting connection...');
        const userId = req.user.id;
        const connectionId = req.params.id;

        const result = await supabase.deleteConnection(userId, connectionId);
        
        if (result.success) {
            console.log('✅ Connection deleted successfully');
            res.json({ success: true });
        } else {
            console.log('❌ Failed to delete connection:', result.error);
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('❌ Error deleting connection:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Clean routing: landing → signin → dashboard → query
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/signin', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/query', (req, res) => {
    res.sendFile(path.join(__dirname, 'query-simple.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    db.close();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Database initialized and ready');
});