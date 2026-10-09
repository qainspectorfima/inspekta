import { supabase } from './supabase-client.js';

export async function getCapaList(status) {
  let q = supabase.from('capa_records').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createCapa(payload) {
  const { data, error } = await supabase
    .from('capa_records')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCapaStatus(id, status) {
  const { error } = await supabase
    .from('capa_records')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
