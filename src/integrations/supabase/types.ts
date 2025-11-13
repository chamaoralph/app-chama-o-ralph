export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          created_at: string | null
          empresa_id: string
          endereco_completo: string | null
          id: string
          idade: number | null
          nome: string
          origem_lead: string
          telefone: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          created_at?: string | null
          empresa_id: string
          endereco_completo?: string | null
          id?: string
          idade?: number | null
          nome: string
          origem_lead: string
          telefone: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          created_at?: string | null
          empresa_id?: string
          endereco_completo?: string | null
          id?: string
          idade?: number | null
          nome?: string
          origem_lead?: string
          telefone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          cliente_id: string
          created_at: string | null
          data_servico_desejada: string | null
          descricao_servico: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          ocasiao: string | null
          origem_lead: string | null
          status: string
          tipo_servico: string[] | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_servico_desejada?: string | null
          descricao_servico?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          ocasiao?: string | null
          origem_lead?: string | null
          status?: string
          tipo_servico?: string[] | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_servico_desejada?: string | null
          descricao_servico?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          ocasiao?: string | null
          origem_lead?: string | null
          status?: string
          tipo_servico?: string[] | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean | null
          cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string
          plano: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          plano?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          plano?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      instaladores: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nivel: number
          pontos_gamificacao: number
          saldo_a_receber: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id: string
          nivel?: number
          pontos_gamificacao?: number
          saldo_a_receber?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nivel?: number
          pontos_gamificacao?: number
          saldo_a_receber?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instaladores_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_caixa: {
        Row: {
          categoria: string
          created_at: string | null
          data_lancamento: string
          descricao: string | null
          empresa_id: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          servico_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          data_lancamento?: string
          descricao?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          servico_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          data_lancamento?: string
          descricao?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          servico_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_caixa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_caixa_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          cliente_id: string
          codigo: string
          cotacao_id: string | null
          created_at: string | null
          data_servico_agendada: string
          descricao: string | null
          empresa_id: string
          endereco_completo: string
          fotos_conclusao: string[] | null
          id: string
          instalador_id: string | null
          nota_fiscal_url: string | null
          observacoes_instalador: string | null
          status: string | null
          tipo_servico: string[]
          updated_at: string | null
          valor_mao_obra_instalador: number | null
          valor_reembolso_despesas: number | null
          valor_total: number
        }
        Insert: {
          cliente_id: string
          codigo: string
          cotacao_id?: string | null
          created_at?: string | null
          data_servico_agendada: string
          descricao?: string | null
          empresa_id: string
          endereco_completo: string
          fotos_conclusao?: string[] | null
          id?: string
          instalador_id?: string | null
          nota_fiscal_url?: string | null
          observacoes_instalador?: string | null
          status?: string | null
          tipo_servico: string[]
          updated_at?: string | null
          valor_mao_obra_instalador?: number | null
          valor_reembolso_despesas?: number | null
          valor_total: number
        }
        Update: {
          cliente_id?: string
          codigo?: string
          cotacao_id?: string | null
          created_at?: string | null
          data_servico_agendada?: string
          descricao?: string | null
          empresa_id?: string
          endereco_completo?: string
          fotos_conclusao?: string[] | null
          id?: string
          instalador_id?: string | null
          nota_fiscal_url?: string | null
          observacoes_instalador?: string | null
          status?: string | null
          tipo_servico?: string[]
          updated_at?: string | null
          valor_mao_obra_instalador?: number | null
          valor_reembolso_despesas?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "servicos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "instaladores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          empresa_id: string
          id: string
          nome: string
          telefone?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "instalador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "instalador"],
    },
  },
} as const
