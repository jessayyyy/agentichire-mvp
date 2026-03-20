import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cstnwppqxnjxxczrwpbk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdG53cHBxeG5qeHhjenJ3cGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Nzk1MjMsImV4cCI6MjA4OTU1NTUyM30.ldRXQ2aSWLkrRQ3wtLwLL7t_4E2hTnlqZ9yYaiL1ZiE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
