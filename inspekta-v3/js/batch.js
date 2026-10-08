import { supabase } from './supabase-client.js';

export async function getBatches() {
  const { data, error } = await supabase
    .from('batch_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createBatch(payload) {
  const { data, error } = await supabase
    .from('batch_records')
    .insert({
      no_bn: (payload.no_bn || '').toString().trim().toUpperCase(),
      product_id: payload.product_id,
      ppi_filling_id: payload.ppi_filling_id || null,
      ppi_kemas_id: payload.ppi_kemas_id || null,
      md: payload.md || '',
      ed: payload.ed || '',
      het_rp: payload.het_rp || '',
      max_lot: (payload.max_lot || '').toString().toUpperCase(),
      status: 'DRAFT',
      created_by: payload.created_by || ''
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBatchByBN(noBN) {
  const key = (noBN || '').toString().trim().toUpperCase();
  const { data, error } = await supabase
    .from('batch_records')
    .select('*')
    .eq('no_bn', key)
    .maybeSingle();

  if (error) throw error;
  return data;
}