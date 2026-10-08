import { supabase } from './supabase-client.js';

export async function getIpcFillingByBatch(batchId) {
  const { data, error } = await supabase
    .from('ipc_filling')
    .select('*')
    .eq('batch_id', batchId);
  if (error) throw error;
  return data;
}