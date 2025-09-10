-- Supabase Database Schema for AI Database Query Assistant
-- IMPORTANT: Run this as 'postgres' role in your Supabase SQL editor
-- (Select 'postgres' from the role dropdown before running)

-- Create connections table
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    connection_name TEXT NOT NULL,
    db_type TEXT NOT NULL CHECK (db_type IN ('mysql', 'mongodb')),
    credentials JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on connections table
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for connections table
-- Users can only see their own connections
CREATE POLICY "Users can view their own connections" ON public.connections
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own connections
CREATE POLICY "Users can insert their own connections" ON public.connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own connections
CREATE POLICY "Users can update their own connections" ON public.connections
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own connections
CREATE POLICY "Users can delete their own connections" ON public.connections
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON public.connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_created_at ON public.connections(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER handle_connections_updated_at
    BEFORE UPDATE ON public.connections
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();