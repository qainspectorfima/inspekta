import { supabase } from './supabase-client.js';

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error) throw error;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('nama, role')
    .eq('id', data.user.id)
    .single();

  // Kalau profile belum ada, tetap izinkan login dengan default
  return {
    user: data.user,
    profile: profile || { nama: data.user.email, role: 'VIEWER' }
  };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('nama, role')
    .eq('id', session.user.id)
    .single();

  return {
    user: session.user,
    profile: profile || { nama: session.user.email, role: 'VIEWER' }
  };
}