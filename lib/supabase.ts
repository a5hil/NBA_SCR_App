import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Check if valid Supabase configuration is present
export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawUrl.trim() !== '' &&
  rawUrl.startsWith('http') &&
  !rawUrl.includes('placeholder') &&
  rawKey &&
  rawKey.trim() !== ''
);

// Fallback to safe dummy parameters to prevent createClient from crashing during module load
const supabaseUrl = isSupabaseConfigured ? rawUrl! : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawKey! : 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});