import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ID fixo da empresa
const EMPRESA_ID = "a5006ac5-230b-4687-bb88-e49ebc7811a2";

interface ClientePayload {
  nome: string;
  telefone: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
}

interface CotacaoPayload {
  tipo_servico: string[];
  descricao?: string;
  valor_estimado?: number;
  data_servico_desejada?: string;
  horario_inicio?: string;
  horario_fim?: string;
  origem_lead?: string;
  ocasiao?: string;
  observacoes?: string;
}

interface RequestPayload {
  cliente: ClientePayload;
  cotacao: CotacaoPayload;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📩 Recebendo requisição de cotação via WhatsApp...");

    // Validar método
    if (req.method !== 'POST') {
      console.error("❌ Método não permitido:", req.method);
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Método não permitido. Use POST.",
          codigo: "METODO_INVALIDO"
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse do body
    const payload: RequestPayload = await req.json();
    console.log("📋 Payload recebido:", JSON.stringify(payload, null, 2));

    // Validar campos obrigatórios
    if (!payload.cliente) {
      console.error("❌ Objeto 'cliente' não enviado");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Objeto 'cliente' é obrigatório",
          codigo: "VALIDACAO_FALHOU"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.cliente.nome || payload.cliente.nome.trim() === "") {
      console.error("❌ Nome do cliente não informado");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Campo 'cliente.nome' é obrigatório",
          codigo: "VALIDACAO_FALHOU"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.cliente.telefone || payload.cliente.telefone.trim() === "") {
      console.error("❌ Telefone do cliente não informado");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Campo 'cliente.telefone' é obrigatório",
          codigo: "VALIDACAO_FALHOU"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.cotacao) {
      console.error("❌ Objeto 'cotacao' não enviado");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Objeto 'cotacao' é obrigatório",
          codigo: "VALIDACAO_FALHOU"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.cotacao.tipo_servico || payload.cotacao.tipo_servico.length === 0) {
      console.error("❌ Tipo de serviço não informado");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Campo 'cotacao.tipo_servico' é obrigatório (array de strings)",
          codigo: "VALIDACAO_FALHOU"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Limpar telefone (apenas números)
    const telefoneLimpo = payload.cliente.telefone.replace(/\D/g, '');
    console.log("📞 Telefone limpo:", telefoneLimpo);

    // Verificar se cliente já existe pelo telefone
    console.log("🔍 Buscando cliente existente...");
    const { data: clienteExistente, error: erroConsulta } = await supabase
      .from('clientes')
      .select('id, nome')
      .eq('empresa_id', EMPRESA_ID)
      .eq('telefone', telefoneLimpo)
      .maybeSingle();

    if (erroConsulta) {
      console.error("❌ Erro ao consultar cliente:", erroConsulta);
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Erro ao consultar cliente existente",
          detalhes: erroConsulta.message,
          codigo: "ERRO_CONSULTA"
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let clienteId: string;
    let clienteNovo = false;

    if (clienteExistente) {
      // Cliente já existe
      clienteId = clienteExistente.id;
      console.log("✅ Cliente encontrado:", clienteExistente.nome, "- ID:", clienteId);
    } else {
      // Criar novo cliente
      console.log("🆕 Criando novo cliente...");
      const { data: novoCliente, error: erroCriacao } = await supabase
        .from('clientes')
        .insert({
          empresa_id: EMPRESA_ID,
          nome: payload.cliente.nome.trim(),
          telefone: telefoneLimpo,
          endereco_completo: payload.cliente.endereco?.trim() || null,
          bairro: payload.cliente.bairro?.trim() || null,
          cep: payload.cliente.cep?.trim() || null,
          origem_lead: payload.cotacao.origem_lead || 'WhatsApp',
          ativo: true
        })
        .select('id')
        .single();

      if (erroCriacao) {
        console.error("❌ Erro ao criar cliente:", erroCriacao);
        return new Response(
          JSON.stringify({ 
            sucesso: false, 
            erro: "Erro ao criar cliente",
            detalhes: erroCriacao.message,
            codigo: "ERRO_CRIACAO_CLIENTE"
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      clienteId = novoCliente.id;
      clienteNovo = true;
      console.log("✅ Novo cliente criado - ID:", clienteId);
    }

    // Criar cotação
    console.log("📝 Criando cotação...");
    const { data: novaCotacao, error: erroCotacao } = await supabase
      .from('cotacoes')
      .insert({
        empresa_id: EMPRESA_ID,
        cliente_id: clienteId,
        tipo_servico: payload.cotacao.tipo_servico,
        descricao_servico: payload.cotacao.descricao?.trim() || null,
        valor_estimado: payload.cotacao.valor_estimado || null,
        data_servico_desejada: payload.cotacao.data_servico_desejada || null,
        horario_inicio: payload.cotacao.horario_inicio || null,
        horario_fim: payload.cotacao.horario_fim || null,
        origem_lead: payload.cotacao.origem_lead || 'WhatsApp',
        ocasiao: payload.cotacao.ocasiao?.trim() || null,
        observacoes: payload.cotacao.observacoes?.trim() || null,
        status: 'pendente'
      })
      .select('id')
      .single();

    if (erroCotacao) {
      console.error("❌ Erro ao criar cotação:", erroCotacao);
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Erro ao criar cotação",
          detalhes: erroCotacao.message,
          codigo: "ERRO_CRIACAO_COTACAO"
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("✅ Cotação criada - ID:", novaCotacao.id);
    console.log("🎉 Processo concluído com sucesso!");

    // Retornar sucesso
    return new Response(
      JSON.stringify({
        sucesso: true,
        cliente_id: clienteId,
        cotacao_id: novaCotacao.id,
        cliente_novo: clienteNovo,
        mensagem: `✅ Cotação criada com sucesso! ${clienteNovo ? 'Novo cliente cadastrado.' : 'Cliente já existente.'}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("❌ Erro inesperado:", error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: "Erro interno no servidor",
        detalhes: errorMessage,
        codigo: "ERRO_INTERNO"
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
