import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Ganti dengan nilai dari Supabase → Settings → API
const SUPABASE_URL = 'https://quugnqxwozwtqkaeshim.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1dWducXh3b3p3dHFrYWVzaGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0Mzk4NzUsImV4cCI6MjEwNzAxNTg3NX0.axbqCwXwOLvFjLuOiQfJ70Mm1wBSNQnrVmUX7qgiWDQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);