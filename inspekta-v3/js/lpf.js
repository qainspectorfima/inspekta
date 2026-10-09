import { supabase } from './supabase-client.js';

export async function getLpfList(status) {
  let q = supabase.from('lpf_records').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createLpf(payload) {
  const { data, error } = await supabase.from('lpf_records').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function verifyLpf(id, catatan, verifier) {
  const { error } = await supabase.from('lpf_records').update({
    status: 'CLOSED',
    diverifikasi_oleh: verifier,
    catatan_verifikasi: catatan,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
}
