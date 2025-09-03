# AI Database Query Assistant

A web application that allows users to query databases using natural language, powered by AI to convert human questions into database queries.

## Features

- **Multi-Database Support**: MySQL and MongoDB
- **Natural Language Processing**: Ask questions in plain English
- **AI Query Generation**: Uses Gemini AI to convert natural language to database queries
- **Multiple Output Formats**: Chat, Table, JSON, and CSV formats
- **Real-time Results**: Execute queries and see results instantly
- **Secure Connections**: Encrypted database connections

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Access to MySQL and/or MongoDB databases

### Installation

1. Clone or download the project files
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Development Mode

For development with auto-reload:
```bash
npm run dev
```

## Usage

1. **Select Database Type**: Choose between MySQL or MongoDB
2. **Enter Credentials**: Provide your database connection details
3. **Ask Questions**: Type your question in natural language
4. **Review Query**: Check the generated SQL/MongoDB query
5. **Execute & View Results**: Run the query and see results in your preferred format

## Example Questions

- "Show me all users"
- "Count how many orders we have"
- "Find users who registered last month"
- "Get the most recent products"
- "Show me all tables/collections"

## Configuration

### Gemini AI Integration

To integrate with Google's Gemini AI API:

1. Get your Gemini API key from Google AI Studio
2. Replace the placeholder `generateQueryWithGemini` function in `server.js`
3. Add your API key to environment variables:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```

### Database Security

- Always use secure connections in production
- Consider using environment variables for sensitive configuration
- Implement proper authentication and authorization

## File Structure

```
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # Frontend JavaScript
├── server.js           # Backend Node.js server
├── package.json        # Node.js dependencies
└── README.md          # This file
```

## API Endpoints

- `POST /api/test-connection` - Test database connection
- `POST /api/generate-query` - Generate query from natural language
- `POST /api/execute-query` - Execute database query

## Security Considerations

- Input validation and sanitization
- SQL injection prevention
- Secure credential handling
- Rate limiting for API calls
- HTTPS in production

## Future Enhancements

- Support for PostgreSQL and other databases
- Advanced query optimization
- Query history and favorites
- User authentication
- Database schema visualization
- Export to more formats (Excel, PDF)

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check database credentials and network connectivity
2. **Query Generation Error**: Ensure your question is clear and specific
3. **Execution Timeout**: Large queries may need optimization

### Support

For issues or questions, please check the console logs for detailed error messages.