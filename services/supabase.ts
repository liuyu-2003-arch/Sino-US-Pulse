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

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};