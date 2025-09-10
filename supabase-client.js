// Frontend Supabase client
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

class SupabaseClient {
    constructor() {
        // These will be set from environment or config
        this.supabaseUrl = window.SUPABASE_URL || 'your_supabase_url';
        this.supabaseAnonKey = window.SUPABASE_ANON_KEY || 'your_supabase_anon_key';

        this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);

        // Listen for auth state changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session);
            this.handleAuthStateChange(event, session);
        });


    }

    // Handle authentication state changes
    handleAuthStateChange(event, session) {
        if (event === 'SIGNED_IN') {
            console.log('User signed in:', session.user);
            // Store session token for API calls
            localStorage.setItem('supabase_token', session.access_token);
            // Trigger dashboard refresh
            if (window.dashboardApp) {
                window.dashboardApp.onUserSignedIn(session.user);
            }
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            localStorage.removeItem('supabase_token');
            // Trigger dashboard refresh
            if (window.dashboardApp) {
                window.dashboardApp.onUserSignedOut();
            }
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('Token refreshed');
            localStorage.setItem('supabase_token', session.access_token);
        }
    }

    // Get current session
    async getSession() {
        const { data: { session }, error } = await this.supabase.auth.getSession();
        if (error) {
            console.error('Error getting session:', error);
            return null;
        }
        return session;
    }

    // Get current user
    async getUser() {
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error) {
            console.error('Error getting user:', error);
            return null;
        }
        return user;
    }

    // Sign up with email and password
    async signUp(email, password, userData = {}) {
        const { data, error } = await this.supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: userData
            }
        });

        if (error) {
            console.error('Sign up error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, user: data.user, session: data.session };
    }

    // Sign in with email and password
    async signIn(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('Sign in error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, user: data.user, session: data.session };
    }

    // Sign out
    async signOut() {
        try {
            console.log('Supabase signOut called');
            const { error } = await this.supabase.auth.signOut();

            if (error) {
                console.error('Sign out error:', error);
                return { success: false, error: error.message };
            }

            console.log('Supabase signOut successful');
            return { success: true };
        } catch (error) {
            console.error('Sign out exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Reset password
    async resetPassword(email) {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`
        });

        if (error) {
            console.error('Reset password error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    // Update password
    async updatePassword(newPassword) {
        const { error } = await this.supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            console.error('Update password error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    // Get access token for API calls
    getAccessToken() {
        return localStorage.getItem('supabase_token');
    }
}

// Create global instance
window.supabaseClient = new SupabaseClient();