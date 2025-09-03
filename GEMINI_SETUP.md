# Gemini AI Integration Setup

## Getting Your Gemini API Key

1. **Visit Google AI Studio**: Go to [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

2. **Sign in**: Use your Google account to sign in

3. **Create API Key**: Click "Create API Key" button

4. **Copy the Key**: Copy your generated API key (it starts with "AIza...")

## Using the API Key

You have **two options** to provide your Gemini API key:

### Option 1: Environment Variable (Recommended for Development)

1. Create a `.env` file in your project root (already created)
2. Add your API key:
   ```
   GEMINI_API_KEY=AIzaSyC-your-actual-api-key-here
   PORT=3000
   ```
3. The application will automatically use this key

### Option 2: Web Interface (Recommended for Users)

1. Start the application: `npm start`
2. Go through the database setup steps
3. Enter your Gemini API key in the "Gemini API Key" field
4. The key will be used for that session only

## Installation Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Your API Key** (choose one method above)

3. **Start the Server**:
   ```bash
   npm start
   ```

4. **Open Browser**: Navigate to `http://localhost:3000`

## How It Works

The Gemini AI integration:

1. **Takes your natural language question**
2. **Analyzes your selected tables/collections**
3. **Generates contextual prompts** for MySQL or MongoDB
4. **Returns optimized queries** based on your database structure
5. **Falls back to simple queries** if API fails

## Example Queries You Can Ask

- "Show me all users from the last month"
- "Count how many orders we have"
- "Find the newest products"
- "Get users with email addresses containing 'gmail'"
- "Show me the top 10 customers by order count"
- "Find all products with price greater than 100"

## Security Notes

- **Never commit your API key** to version control
- **Use environment variables** in production
- **The .env file is gitignored** for security
- **API keys entered in the web interface** are only used for that session

## Troubleshooting

### "API key is required" Error
- Make sure you've set the API key in `.env` OR entered it in the web form
- Check that your `.env` file is in the project root
- Restart the server after adding the `.env` file

### "Invalid API key" Error
- Verify your API key is correct
- Make sure you copied the full key (starts with "AIza...")
- Check that your Google AI Studio account is active

### Query Generation Fails
- The app will fall back to simple query generation
- Check the console for detailed error messages
- Verify your internet connection

## API Limits

- Gemini API has rate limits and quotas
- Free tier includes generous limits for testing
- For production use, consider upgrading to paid tier
- Monitor your usage in Google AI Studio

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check the server logs for API errors
3. Verify your API key is valid
4. Test with simple queries first