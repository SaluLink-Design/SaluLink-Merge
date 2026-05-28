import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const PLACEHOLDER_KEY_PATTERNS = [
  'your-anon-key',
  'your_anon_key',
  'replace-me',
  'changeme',
];

const isPlaceholderKey = PLACEHOLDER_KEY_PATTERNS.some((pattern) =>
  supabaseAnonKey.toLowerCase().includes(pattern)
);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials are missing. Create a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

if (isPlaceholderKey || !supabaseAnonKey.startsWith('eyJ')) {
  throw new Error(
    'Supabase anon key is invalid or still a placeholder. In Supabase: Project Settings → API → copy the anon public key into NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
