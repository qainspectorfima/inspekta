import { supabase } from './supabase-client.js';

export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nama, role, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateRole(userId, role) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}
