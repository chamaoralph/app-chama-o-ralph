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
      alternativas: {
        Row: {
          correta: boolean
          created_at: string | null
          id: string
          ordem: number
          pergunta_id: string
          texto: string
        }
        Insert: {
          correta?: boolean
          created_at?: string | null
          id?: string
          ordem: number
          pergunta_id: string
          texto: string
        }
        Update: {
          correta?: boolean
          created_at?: string | null
          id?: string
          ordem?: number
          pergunta_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "alternativas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      artigos: {
        Row: {
          categoria: string
          conteudo: string
          created_at: string | null
          empresa_id: string
          id: string
          publicado: boolean | null
          tags: string[] | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          categoria: string
          conteudo: string
          created_at?: string | null
          empresa_id: string
          id?: string
          publicado?: boolean | null
          tags?: string[] | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          categoria?: string
          conteudo?: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          publicado?: boolean | null
          tags?: string[] | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artigos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      certificacoes: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          empresa_id: string
          id: string
          instalador_id: string
          questionario_id: string
          tentativa_id: string
          tipos_servico_liberados: string[]
          validade_ate: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          empresa_id: string
          id?: string
          instalador_id: string
          questionario_id: string
          tentativa_id: string
          tipos_servico_liberados: string[]
          validade_ate?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          instalador_id?: string
          questionario_id?: string
          tentativa_id?: string
          tipos_servico_liberados?: string[]
          validade_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificacoes_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificacoes_questionario_id_fkey"
            columns: ["questionario_id"]
            isOneToOne: false
            referencedRelation: "questionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificacoes_tentativa_id_fkey"
            columns: ["tentativa_id"]
            isOneToOne: false
            referencedRelation: "tentativas"
            referencedColumns: ["id"]
          },
        ]
      }
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
          observacao_alerta: string | null
          origem_lead: string
          telefone: string
          tipo_alerta: string | null
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
          observacao_alerta?: string | null
          origem_lead: string
          telefone: string
          tipo_alerta?: string | null
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
          observacao_alerta?: string | null
          origem_lead?: string
          telefone?: string
          tipo_alerta?: string | null
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
      clientes_rfm_cache: {
        Row: {
          cliente_id: string
          created_at: string | null
          empresa_id: string
          frequency_count: number
          frequency_score: number
          id: string
          monetary_score: number
          monetary_value: number
          periodo_analise: number
          recency_days: number
          recency_score: number
          rfm_score: string
          segmento: string
          ultima_atualizacao: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          empresa_id: string
          frequency_count?: number
          frequency_score?: number
          id?: string
          monetary_score?: number
          monetary_value?: number
          periodo_analise?: number
          recency_days?: number
          recency_score?: number
          rfm_score?: string
          segmento?: string
          ultima_atualizacao?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          empresa_id?: string
          frequency_count?: number
          frequency_score?: number
          id?: string
          monetary_score?: number
          monetary_value?: number
          periodo_analise?: number
          recency_days?: number
          recency_score?: number
          rfm_score?: string
          segmento?: string
          ultima_atualizacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_rfm_cache_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_rfm_cache_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_rfm: {
        Row: {
          created_at: string | null
          empresa_id: string
          frequency_2: number
          frequency_3: number
          frequency_4: number
          frequency_5: number
          id: string
          monetary_2: number
          monetary_3: number
          monetary_4: number
          monetary_5: number
          recency_2: number
          recency_3: number
          recency_4: number
          recency_5: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          frequency_2?: number
          frequency_3?: number
          frequency_4?: number
          frequency_5?: number
          id?: string
          monetary_2?: number
          monetary_3?: number
          monetary_4?: number
          monetary_5?: number
          recency_2?: number
          recency_3?: number
          recency_4?: number
          recency_5?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          frequency_2?: number
          frequency_3?: number
          frequency_4?: number
          frequency_5?: number
          id?: string
          monetary_2?: number
          monetary_3?: number
          monetary_4?: number
          monetary_5?: number
          recency_2?: number
          recency_3?: number
          recency_4?: number
          recency_5?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_rfm_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
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
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          observacoes: string | null
          ocasiao: string | null
          origem_lead: string | null
          status: string
          tipo_servico: string[] | null
          updated_at: string | null
          valor_estimado: number | null
          valor_material: number | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_servico_desejada?: string | null
          descricao_servico?: string | null
          empresa_id: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          observacoes?: string | null
          ocasiao?: string | null
          origem_lead?: string | null
          status?: string
          tipo_servico?: string[] | null
          updated_at?: string | null
          valor_estimado?: number | null
          valor_material?: number | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_servico_desejada?: string | null
          descricao_servico?: string | null
          empresa_id?: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          observacoes?: string | null
          ocasiao?: string | null
          origem_lead?: string | null
          status?: string
          tipo_servico?: string[] | null
          updated_at?: string | null
          valor_estimado?: number | null
          valor_material?: number | null
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
      importacao_clientes_log: {
        Row: {
          arquivo_nome: string
          clientes_atualizados: number
          created_at: string | null
          empresa_id: string
          erros: Json | null
          id: string
          novos_clientes: number
          total_linhas: number
        }
        Insert: {
          arquivo_nome: string
          clientes_atualizados?: number
          created_at?: string | null
          empresa_id: string
          erros?: Json | null
          id?: string
          novos_clientes?: number
          total_linhas?: number
        }
        Update: {
          arquivo_nome?: string
          clientes_atualizados?: number
          created_at?: string | null
          empresa_id?: string
          erros?: Json | null
          id?: string
          novos_clientes?: number
          total_linhas?: number
        }
        Relationships: [
          {
            foreignKeyName: "importacao_clientes_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
      perguntas: {
        Row: {
          created_at: string | null
          enunciado: string
          id: string
          ordem: number
          pontos: number | null
          questionario_id: string
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          enunciado: string
          id?: string
          ordem: number
          pontos?: number | null
          questionario_id: string
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          enunciado?: string
          id?: string
          ordem?: number
          pontos?: number | null
          questionario_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perguntas_questionario_id_fkey"
            columns: ["questionario_id"]
            isOneToOne: false
            referencedRelation: "questionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      progresso_visualizacao: {
        Row: {
          conteudo_id: string
          created_at: string | null
          id: string
          instalador_id: string
          tempo_visualizacao_segundos: number | null
          tipo_conteudo: string
          ultima_visualizacao: string | null
          visualizado_completo: boolean | null
        }
        Insert: {
          conteudo_id: string
          created_at?: string | null
          id?: string
          instalador_id: string
          tempo_visualizacao_segundos?: number | null
          tipo_conteudo: string
          ultima_visualizacao?: string | null
          visualizado_completo?: boolean | null
        }
        Update: {
          conteudo_id?: string
          created_at?: string | null
          id?: string
          instalador_id?: string
          tempo_visualizacao_segundos?: number | null
          tipo_conteudo?: string
          ultima_visualizacao?: string | null
          visualizado_completo?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "progresso_visualizacao_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      questionarios: {
        Row: {
          ativo: boolean | null
          conteudo_id: string
          created_at: string | null
          empresa_id: string
          id: string
          nota_minima: number | null
          tempo_limite_minutos: number | null
          tentativas_maximas: number | null
          tipo_conteudo: string
          tipos_servico_liberados: string[]
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          conteudo_id: string
          created_at?: string | null
          empresa_id: string
          id?: string
          nota_minima?: number | null
          tempo_limite_minutos?: number | null
          tentativas_maximas?: number | null
          tipo_conteudo: string
          tipos_servico_liberados: string[]
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          conteudo_id?: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          nota_minima?: number | null
          tempo_limite_minutos?: number | null
          tentativas_maximas?: number | null
          tipo_conteudo?: string
          tipos_servico_liberados?: string[]
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_tentativa: {
        Row: {
          alternativa_escolhida_id: string
          correta: boolean
          created_at: string | null
          id: string
          pergunta_id: string
          tentativa_id: string
        }
        Insert: {
          alternativa_escolhida_id: string
          correta: boolean
          created_at?: string | null
          id?: string
          pergunta_id: string
          tentativa_id: string
        }
        Update: {
          alternativa_escolhida_id?: string
          correta?: boolean
          created_at?: string | null
          id?: string
          pergunta_id?: string
          tentativa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_tentativa_alternativa_escolhida_id_fkey"
            columns: ["alternativa_escolhida_id"]
            isOneToOne: false
            referencedRelation: "alternativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_tentativa_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_tentativa_tentativa_id_fkey"
            columns: ["tentativa_id"]
            isOneToOne: false
            referencedRelation: "tentativas"
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
            foreignKeyName: "fk_servicos_instalador"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
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
      tentativas: {
        Row: {
          acertos: number
          aprovado: boolean
          created_at: string | null
          empresa_id: string
          finalizada_em: string | null
          id: string
          iniciada_em: string | null
          instalador_id: string
          nota_obtida: number
          questionario_id: string
          tempo_gasto_minutos: number | null
          total_perguntas: number
        }
        Insert: {
          acertos: number
          aprovado: boolean
          created_at?: string | null
          empresa_id: string
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string | null
          instalador_id: string
          nota_obtida: number
          questionario_id: string
          tempo_gasto_minutos?: number | null
          total_perguntas: number
        }
        Update: {
          acertos?: number
          aprovado?: boolean
          created_at?: string | null
          empresa_id?: string
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string | null
          instalador_id?: string
          nota_obtida?: number
          questionario_id?: string
          tempo_gasto_minutos?: number | null
          total_perguntas?: number
        }
        Relationships: [
          {
            foreignKeyName: "tentativas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tentativas_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tentativas_questionario_id_fkey"
            columns: ["questionario_id"]
            isOneToOne: false
            referencedRelation: "questionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_servico: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          empresa_id: string
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tipos_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos: {
        Row: {
          categoria: string | null
          created_at: string | null
          descricao: string | null
          duracao_minutos: number | null
          empresa_id: string
          id: string
          publicado: boolean | null
          titulo: string
          updated_at: string | null
          video_url: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          empresa_id: string
          id?: string
          publicado?: boolean | null
          titulo: string
          updated_at?: string | null
          video_url: string
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          empresa_id?: string
          id?: string
          publicado?: boolean | null
          titulo?: string
          updated_at?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      calculate_rfm: {
        Args: { p_empresa_id: string; p_periodo_dias?: number }
        Returns: Json
      }
      get_empresa_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_clientes_csv: {
        Args: { p_arquivo_nome?: string; p_dados: Json; p_empresa_id: string }
        Returns: Json
      }
      instalador_certificado_para_tipo: {
        Args: { _instalador_id: string; _tipos_servico: string[] }
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
