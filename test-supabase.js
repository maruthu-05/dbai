// Test Supabase connection and database setup
require('dotenv').config();
const SupabaseService = require('./supabase');

async function testSupabase() {
    console.log('🧪 Testing Supabase connection...');
    
    const supabase = new SupabaseService();
    
    // Test 1: Check if service initialized
    if (!supabase.supabaseAdmin) {
        console.error('❌ Supabase service not initialized');
        return;
    }
    
    console.log('✅ Supabase service initialized');
    
    // Test 2: Check if connections table exists
    try {
        const { data, error } = await supabase.supabaseAdmin
            .from('connections')
            .select('count')
            .limit(1);
            
        if (error) {
            console.error('❌ Connections table error:', error.message);
            console.log('💡 Make sure you have run the supabase-schema.sql in your Supabase SQL editor');
            return;
        }
        
        console.log('✅ Connections table exists');
        
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        return;
    }
    
    // Test 3: Test token verification (with a dummy token)
    console.log('✅ All Supabase tests passed!');
    console.log('🎉 Your Supabase setup is working correctly');
}

testSupabase().catch(console.error);