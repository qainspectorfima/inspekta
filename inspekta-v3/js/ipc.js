import { supabase } from './supabase-client.js';

export async function getBatchFullByBN(noBN) {
  const key = (noBN || '').toString().trim().toUpperCase();
  const { data: batch, error } = await supabase
    .from('batch_records')
    .select('*')
    .eq('no_bn', key)
    .maybeSingle();
  if (error) throw error;
  if (!batch) return null;

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', batch.product_id)
    .maybeSingle();

  return { ...batch, product: product || {} };
}

export async function getLotsDone(batchId, jenis) {
  const table = jenis === 'KEMAS' ? 'ipc_kemas' : 'ipc_filling';
  const { data, error } = await supabase
    .from(table)
    .select('lot')
    .eq('batch_id', batchId);
  if (error) throw error;
  return (data || []).map(r => (r.lot || '').toUpperCase());
}

export async function getAnsiStatus(productId) {
  const { data, error } = await supabase
    .from('ansi_status')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateAnsiAfterIpc(productId, hasil, noBN) {
  let row = await getAnsiStatus(productId);
  let level = row?.ansi_aktif || 2;
  let clean = row?.clean_streak || 0;
  let problem = row?.problem_streak || 0;
  let riwayat = row?.riwayat || '';

  if (hasil === 'OK') {
    clean += 1;
    problem = 0;
    if (clean >= 10) {
      if (level === 3) level = 2;
      else if (level === 2) level = 1;
      clean = 0;
    }
  } else {
    problem += 1;
    clean = 0;
    if (problem >= 1 && level === 1) level = 2;
    if (problem >= 2 && level < 3) level = 3;
  }

  const note = `${new Date().toISOString().slice(0, 10)} BN:${noBN} ${hasil} → L${level}`;
  riwayat = ((riwayat ? riwayat + ' | ' : '') + note).slice(-500);

  if (row) {
    const { error } = await supabase.from('ansi_status').update({
      ansi_aktif: level,
      clean_streak: clean,
      problem_streak: problem,
      last_bn: noBN,
      updated_at: new Date().toISOString(),
      riwayat
    }).eq('id', row.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('ansi_status').insert({
      product_id: productId,
      ansi_aktif: level,
      clean_streak: clean,
      problem_streak: problem,
      last_bn: noBN,
      riwayat
    });
    if (error) throw error;
  }
  return { level, clean, problem };
}

export async function saveIpcFilling(payload) {
  const { data, error } = await supabase
    .from('ipc_filling')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveIpcKemas(payload) {
  const { data, error } = await supabase
    .from('ipc_kemas')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBatchStatus(batchId, status) {
  const { error } = await supabase
    .from('batch_records')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', batchId);
  if (error) throw error;
}
