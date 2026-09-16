const SUPABASE_URL = "https://zevdqmrlcrnwkeqejbxm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH";

window.simanis = {
  supabase: window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  )
};
