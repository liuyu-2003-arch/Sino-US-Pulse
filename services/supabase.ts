
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ossrsfyqbrzeauzksvpv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zc3JzZnlxYnJ6ZWF1emtzdnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDgwMDksImV4cCI6MjA3OTY4NDAwOX0.IwEfjxM_wNBf2DXDC9ue8X6ztSOJV2rEN1vrQqv7eqI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const ADMIN_EMAIL = 'jemchmi@gmail.com';

export const isUserAdmin = (user: any) => {
  return user?.email === ADMIN_EMAIL;
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
        redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
};

export const signInWithGithub = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
        redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
};

export const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
};

export const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    if (error) throw error;
    return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// --- Favorites System ---

export const getFavorites = async (userId: string): Promise<string[]> => {
    const { data, error } = await supabase
        .from('favorites')
        .select('comparison_key')
        .eq('user_id', userId);
    
    if (error) {
        console.error('Error fetching favorites:', error);
        return [];
    }
    return data.map(item => item.comparison_key);
};

export const getGlobalFavoriteCounts = async (): Promise<Record<string, number>> => {
    const { data, error } = await supabase
        .from('favorites')
        .select('comparison_key');
    
    if (error) {
        console.error('Error fetching global favorites:', error);
        return {};
    }

    const counts: Record<string, number> = {};
    data?.forEach((item: any) => {
        const k = item.comparison_key;
        counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
};

export const addFavorite = async (userId: string, key: string) => {
    const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, comparison_key: key });
    if (error) throw error;
};

export const removeFavorite = async (userId: string, key: string) => {
    const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('comparison_key', key);
    if (error) throw error;
};