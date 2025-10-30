import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __supabaseWarned__: boolean | undefined;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
} else if (!globalThis.__supabaseWarned__) {
  console.warn('[Prototype] Supabase credentials not configured. Database calls will be disabled.');
  globalThis.__supabaseWarned__ = true;
}

export const supabase = supabaseClient;

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export async function testSupabaseConnection(): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('[Prototype] Cannot test Supabase connection: credentials not configured.');
      return false;
    }

    const { error } = await supabase.from('sessions').select('count').limit(1);

    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }

    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
}

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

export const isSupabaseConfigured = Boolean(supabase && supabaseAdmin);
