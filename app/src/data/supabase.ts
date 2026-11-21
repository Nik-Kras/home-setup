import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Null when the keys are missing, so the app falls back to demo data instead of crashing. */
export const db: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

// Refresh the session only while the app is in front, as Supabase recommends for React Native.
if (db) {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') db.auth.startAutoRefresh();
    else db.auth.stopAutoRefresh();
  });
}

export const kv = AsyncStorage;
