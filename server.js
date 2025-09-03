require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI
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
                database: credentials.database
            });

            await connection.ping();
            await connection.end();

        } else if (dbType === 'mongodb') {
            let uri;
            if (credentials.username && credentials.password) {
                // Include authSource parameter for authentication database
                const authSource = credentials.authDatabase || 'admin';
                uri = `mongodb://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.database || 'test'}?authSource=${authSource}`;
            } else {
                uri = `mongodb://${credentials.host}:${credentials.port}/${credentials.database || 'test'}`;
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
app.post('/api/get-tables', async (req, res) => {
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
app.post('/api/get-table-schemas', async (req, res) => {
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
app.post('/api/generate-query', async (req, res) => {
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
app.post('/api/execute-query', async (req, res) => {
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

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});