# 🚀 Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new project
4. Choose a name and password for your database

## Step 2: Get Your Keys

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon public key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
   - **service_role secret key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

## Step 3: Update Environment Variables

Update your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Step 4: Set Up Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. **Important**: Select **`postgres`** role from the dropdown (this is the superuser role)
3. Copy and paste the contents of `supabase-schema.sql`
4. Click **Run** to create the tables and policies

### 🔐 **Database Roles Explained:**
- **`postgres`** - Superuser role (use this for schema creation)
- **`anon`** - Anonymous users (unauthenticated)
- **`authenticated`** - Signed-in users (respects RLS policies)

### ⚠️ Common Issue: "must be owner of table users"

If you get this error:

1. **Make sure you selected `postgres` role** in the SQL editor dropdown
2. The updated schema avoids modifying `auth.users` table
3. If still having issues, run each section separately

## Step 5: Configure Authentication

1. Go to **Authentication** → **Settings**
2. Configure your site URL: `http://localhost:3000` (for development)
3. Add redirect URLs if needed
4. Enable email confirmations (optional)

## Step 6: Install Dependencies

```bash
npm install @supabase/supabase-js
```

## Step 7: Test the Setup

1. Start your server: `npm start`
2. Visit `http://localhost:3000`
3. Try signing up with a new account
4. Check if authentication works

## 🔧 Features Enabled

✅ **User Authentication** - Sign up, sign in, sign out
✅ **Email Verification** - Optional email confirmation
✅ **Password Reset** - Forgot password functionality
✅ **Secure Storage** - Encrypted database connections
✅ **Row Level Security** - Users only see their own data
✅ **Real-time Sessions** - Automatic token refresh
✅ **Social Logins** - Can be enabled later (Google, GitHub, etc.)

## 🛡️ Security Features

- **Row Level Security (RLS)** - Database-level access control
- **JWT Tokens** - Secure authentication tokens
- **Encrypted Credentials** - Database connection details are encrypted
- **HTTPS Only** - All communication is encrypted
- **Session Management** - Automatic token refresh and expiry

## 🚨 Important Notes

1. **Never commit your service role key** - Keep it secret
2. **Use environment variables** - Don't hardcode keys
3. **Enable RLS** - Always use Row Level Security in production
4. **Regular backups** - Supabase provides automatic backups
5. **Monitor usage** - Check your Supabase dashboard for usage stats

## 🔄 Migration from SQLite

The app will automatically use Supabase once configured. Your existing SQLite data won't be migrated automatically. If you have existing connections, you'll need to re-add them after setting up Supabase.

## 🆘 Troubleshooting

### "Invalid API key" error
- Check your SUPABASE_ANON_KEY in .env
- Make sure there are no extra spaces or quotes

### "must be owner of table users" error
- **Solution**: Select **`postgres`** role in SQL Editor dropdown
- **Alternative**: Run the schema in smaller chunks
- **Note**: The `auth.users` table is managed by Supabase automatically

### "Failed to create connection" error
- Verify your SUPABASE_SERVICE_ROLE_KEY
- Check if the connections table was created properly
- Ensure RLS policies are enabled

### Authentication not working
- Verify SUPABASE_URL is correct
- Check browser console for errors
- Ensure your site URL is configured in Supabase
- Clear browser localStorage and try again

### Database connection issues
- Run the SQL schema in Supabase SQL Editor **as `postgres` role**
- Check if RLS policies are enabled
- Verify the connections table exists in the public schema
- Check the Table Editor to see if the `connections` table was created

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Check the server logs
3. Verify your Supabase project settings
4. Test with a fresh browser session (clear localStorage)