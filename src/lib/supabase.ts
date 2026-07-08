import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlı olmalı. .env.example dosyasını .env olarak kopyalayıp doldurun.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
