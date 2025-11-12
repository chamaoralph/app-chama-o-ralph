import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam as variáveis de ambiente do Supabase. Verifique seu .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string
          empresa_id: string
          nome: string
          telefone: string | null
          tipo: 'admin' | 'instalador'
          ativo: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          empresa_id: string
          nome: string
          telefone?: string | null
          tipo: 'admin' | 'instalador'
          ativo?: boolean
          avatar_url?: string | null
        }
        Update: {
          nome?: string
          telefone?: string | null
          tipo?: 'admin' | 'instalador'
          ativo?: boolean
          avatar_url?: string | null
        }
      }
      instaladores: {
        Row: {
          id: string
          empresa_id: string
          pontos_gamificacao: number
          nivel: number
          saldo_a_receber: number
          ativo: boolean
        }
      }
    }
  }
}
