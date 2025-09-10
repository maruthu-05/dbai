# AI Database Query Assistant

An intelligent database query assistant with user authentication that converts natural language questions into SQL/MongoDB queries using Google's Gemini AI.

## 🚀 Features

### Core Features
- **Natural Language Processing**: Ask questions in plain English
- **Multi-Database Support**: Works with MySQL and MongoDB
- **AI-Powered Query Generation**: Uses Google Gemini AI for intelligent query creation
- **Multiple Output Formats**: View results as chat, table, JSON, or CSV
- **Schema-Aware**: Automatically detects table structures for better query generation
- **Real-time Query Execution**: Execute generated queries directly
- **Query Editing**: Modify generated queries before execution
- **Export Results**: Download results in JSON or CSV format

### Authentication & User Management
- **User Registration & Login**: Secure user accounts with JWT authentication
- **Credential Management**: Save and manage multiple database connections
- **Encrypted Storage**: Database credentials are encrypted and stored securely
- **User Dashboard**: Manage saved connections with easy access
- **Session Management**: Secure session handling with token expiration

### Database Operations
- **Read Operations**: SELECT queries, data retrieval, aggregations
- **Write Operations**: INSERT, UPDATE, DELETE operations
- **Schema Detection**: Automatic table/collection structure analysis
- **Connection Testing**: Verify database connections before saving

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│                 │    │                  │    │                 │
│ • Login/Register│◄──►│ • Authentication │◄──►│ • User Data     │
│ • Dashboard     │    │ • JWT Tokens     │    │ • Credentials   │
│ • Query Interface│   │ • Encryption     │    │ • SQLite        │
│ • Results View  │    │ • Query Gen      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   External DBs   │
                       │                  │
                       │ • MySQL         │
                       │ • MongoDB       │
                       └──────────────────┘
```

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd ai-database-query-assistant
npm install
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ENCRYPTION_KEY=your-32-character-encryption-key-here
PORT=3000
```

### 3. Start the Application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 4. Access the Application
1. Open `http://localhost:3000`
2. Register a new account or login
3. Add your database connections
4. Start querying with natural language!

## 📱 User Flow

### First Time Setup
1. **Register Account** → Create username, email, password
2. **Login** → Access your dashboard
3. **Add Database Connection** → Save MySQL/MongoDB credentials
4. **Test Connection** → Verify database access
5. **Start Querying** → Select tables and ask questions

### Daily Usage
1. **Login** → Access your dashboard
2. **Select Connection** → Choose from saved databases
3. **Pick Tables** → Select relevant tables/collections
4. **Ask Questions** → Natural language queries
5. **View Results** → Multiple output formats
6. **Export Data** → Download as JSON/CSV

## 🗄️ Database Support

### MySQL
```sql
-- Example generated queries
SELECT * FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH);
INSERT INTO products (name, price) VALUES ('New Product', 99.99);
UPDATE users SET status = 'active' WHERE id = 1;
DELETE FROM orders WHERE status = 'cancelled';
```

### MongoDB
```javascript
// Example generated queries
db.users.find({"createdAt": {"$gte": new Date(Date.now() - 30*24*60*60*1000)}})
db.products.insertOne({name: "New Product", price: 99.99})
db.users.updateOne({_id: ObjectId("...")}, {$set: {status: "active"}})
db.orders.deleteMany({status: "cancelled"})
```

## 🔒 Security Features

### Authentication
- **JWT Tokens**: Secure session management
- **Password Hashing**: bcrypt with salt rounds
- **Token Expiration**: 24-hour session timeout
- **Input Validation**: Server-side validation for all inputs

### Data Protection
- **Credential Encryption**: AES-256 encryption for stored credentials
- **Environment Variables**: Sensitive config in .env files
- **SQL Injection Prevention**: Parameterized queries
- **CORS Protection**: Cross-origin request security

### Best Practices
- Never commit `.env` files
- Use strong JWT secrets in production
- Regular security updates
- Database user permissions (read-only recommended)

## 🛠️ Development

### Project Structure
```
├── server.js          # Main server file
├── database.js        # SQLite database operations
├── auth.js           # Authentication service
├── login.html        # Login page
├── register.html     # Registration page
├── dashboard.html    # User dashboard
├── dashboard.js      # Dashboard functionality
├── index.html        # Query interface
├── script.js         # Query interface logic
├── styles.css        # Styling
└── users.db          # SQLite database (auto-created)
```

### API Endpoints
```
Authentication:
POST /api/register     # User registration
POST /api/login        # User login
GET  /api/verify-token # Token verification

Connection Management:
GET    /api/connections     # List user connections
POST   /api/connections     # Save new connection
GET    /api/connections/:id # Get connection details
PUT    /api/connections/:id # Update connection
DELETE /api/connections/:id # Delete connection

Database Operations:
POST /api/test-connection    # Test database connection
POST /api/get-tables        # Get tables/collections
POST /api/get-table-schemas # Get table structures
POST /api/generate-query    # Generate AI query
POST /api/execute-query     # Execute database query
```

### Development Commands
```bash
# Install dependencies
npm install

# Development with auto-restart
npm run dev

# Production start
npm start

# Database reset (if needed)
rm users.db && npm start
```

## 📋 Example Natural Language Queries

### Data Retrieval
- "Show me all users who registered last month"
- "Find the top 10 products by sales"
- "Get all orders from the last week"
- "Count total customers by region"

### Data Modification
- "Add a new user with name John and email john@email.com"
- "Update the price of product with ID 5 to $29.99"
- "Delete all cancelled orders"
- "Set all inactive users to active status"

### Analytics
- "Show me monthly sales trends"
- "Find customers who haven't ordered in 6 months"
- "Calculate average order value by customer"
- "List products with low inventory"

## 🔧 Configuration

### Environment Variables
```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key

# Optional
PORT=3000
```

### Database Connections
The app supports various connection formats:

**MySQL:**
- Host: localhost or remote server
- Port: 3306 (default)
- Authentication: username/password
- Database: specific database name

**MongoDB:**
- Host: localhost or remote server  
- Port: 27017 (default)
- Authentication: username/password + auth database
- Database: specific database name

## 📚 Additional Documentation

- [GEMINI_SETUP.md](GEMINI_SETUP.md) - Gemini AI API setup
- [DATABASE_ACCESS_GUIDE.md](DATABASE_ACCESS_GUIDE.md) - Database connection help

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the documentation files
2. Review the example queries
3. Verify your environment configuration
4. Check database connection settings