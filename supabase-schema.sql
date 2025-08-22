-- Enable Row Level Security
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user profiles table
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create movie wishlist table
CREATE TABLE public.movie_wishlist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  poster_url TEXT,
  director TEXT,
  actors TEXT,
  genres JSONB,
  overview TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, tmdb_id)
);

-- Create TV wishlist table
CREATE TABLE public.tv_wishlist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  first_air_year INTEGER,
  poster_url TEXT,
  creator TEXT,
  seasons INTEGER,
  genres JSONB,
  overview TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, tmdb_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_wishlist ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create policies for movie_wishlist
CREATE POLICY "Users can view own movie wishlist" ON public.movie_wishlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movie wishlist items" ON public.movie_wishlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own movie wishlist items" ON public.movie_wishlist
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own movie wishlist items" ON public.movie_wishlist
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for tv_wishlist
CREATE POLICY "Users can view own TV wishlist" ON public.tv_wishlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own TV wishlist items" ON public.tv_wishlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own TV wishlist items" ON public.tv_wishlist
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own TV wishlist items" ON public.tv_wishlist
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.movie_wishlist
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.tv_wishlist
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_movie_wishlist_user_id ON public.movie_wishlist(user_id);
CREATE INDEX idx_tv_wishlist_user_id ON public.tv_wishlist(user_id);