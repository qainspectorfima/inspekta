import { supabase } from './supabase-client.js';

export async function getPpiDocuments(statusVersi) {
  let query = supabase
    .from('ppi_documents')
    .select('*, products(kode_produk, nama_produk, line, batch_size, ansi_1, ansi_2, ansi_3)')
    .order('created_at', { ascending: false });

  if (statusVersi) {
    query = query.eq('status_versi', statusVersi);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPpiAktifByProduct(productId, jenis) {
  const { data, error } = await supabase
    .from('ppi_documents')
    .select('*')
    .eq('product_id', productId)
    .eq('jenis', jenis)
    .eq('status_versi', 'AKTIF')
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Simpan PPI baru + otomatis geser versi lama
 */
export async function savePpiDocument(data) {
  // Ambil dokumen aktif lama untuk product+jenis yang sama
  const { data: existingAktif } = await supabase
    .from('ppi_documents')
    .select('*')
    .eq('product_id', data.product_id)
    .eq('jenis', data.jenis)
    .eq('status_versi', 'AKTIF');

  // Geser AKTIF → WIP, WIP → OBSOLETE
  if (existingAktif && existingAktif.length) {
    for (const doc of existingAktif) {
      // yang WIP lama → OBSOLETE
      await supabase
        .from('ppi_documents')
        .update({ status_versi: 'OBSOLETE' })
        .eq('product_id', data.product_id)
        .eq('jenis', data.jenis)
        .eq('status_versi', 'WIP');

      // yang AKTIF → WIP
      await supabase
        .from('ppi_documents')
        .update({ status_versi: 'WIP' })
        .eq('id', doc.id);
    }
  }

  const insertPayload = {
    product_id: data.product_id,
    jenis: data.jenis,
    no_dokumen: data.no_dokumen,
    berlaku_tanggal: data.berlaku_tanggal || null,
    menggantikan_no: data.menggantikan_no || (existingAktif?.[0]?.no_dokumen || null),
    tgl_berlaku_lama: data.tgl_berlaku_lama || (existingAktif?.[0]?.berlaku_tanggal || null),
    status_versi: 'AKTIF',
    created_by: data.created_by || ''
  };

  const { error } = await supabase.from('ppi_documents').insert(insertPayload);
  if (error) throw error;
  return '✅ Master PPI berhasil disimpan sebagai AKTIF.';
}