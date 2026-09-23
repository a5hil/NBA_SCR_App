import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://iynufzhopcrdadtluqnx.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnVmemhvcGNyZGFkdGx1cW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNjMwOTEsImV4cCI6MjEwNDkzOTA5MX0.JqwsP1SB7gAHCFu_Ed60PU0MOmdPakFmD0KNtZMXqa4';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Check if valid Supabase configuration is present
export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawUrl.trim() !== '' &&
  rawUrl.startsWith('http') &&
  !rawUrl.includes('placeholder') &&
  rawKey &&
  rawKey.trim() !== ''
);

const supabaseUrl = rawUrl;
const supabaseAnonKey = rawKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});