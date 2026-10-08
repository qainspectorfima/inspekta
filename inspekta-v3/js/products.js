import { supabase } from './supabase-client.js';

export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createProduct(payload) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      kode_produk: payload.kode_produk.toUpperCase(),
      nama_produk: payload.nama_produk,
      line: payload.line || '',
      batch_size: parseInt(payload.batch_size) || 0,
      jumlah_lot: parseInt(payload.jumlah_lot) || 1,
      ansi_1: payload.ansi_1 || null,
      ansi_2: payload.ansi_2 || null,
      ansi_3: payload.ansi_3 || null,
      created_by: payload.created_by || ''
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
  return true;
}