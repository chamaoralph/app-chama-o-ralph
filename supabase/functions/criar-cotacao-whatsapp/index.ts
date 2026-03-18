import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
};

const EMPRESA_ID = "a5006ac5-230b-4687-bb88-e49ebc7811a2";

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 3600000;

interface ClientePayload {
  nome: string;
  telefone: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
}

interface CotacaoPayload {
  tipo_servico?: string[];
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
  cotacao?: CotacaoPayload;
}

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);
  if (!entry || (now - entry.windowStart) >= RATE_LIMIT_WINDOW) {
    rateLimitMap.set(clientIp, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

function jsonError(erro: string, codigo: string, status: number) {
  return new Response(
    JSON.stringify({ sucesso: false, erro, codigo }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get('cf-connecting-ip') || 
                   req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   'unknown';

  try {
    console.log("📩 Recebendo requisição de cotação via WhatsApp...");

    if (req.method !== 'POST') {
      return jsonError("Método não permitido. Use POST.", "METODO_INVALIDO", 405);
    }

    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Limite de requisições excedido.", codigo: "RATE_LIMIT_EXCEEDED" }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' } }
      );
    }

    // Autenticação por token simples (mesmo padrão do inserir-conversao-offline)
    const token = req.headers.get('x-webhook-token');
    const expectedToken = Deno.env.get('WEBHOOK_SECRET');

    if (!expectedToken) {
      return jsonError("Configuração do servidor incompleta", "CONFIG_ERROR", 500);
    }

    if (!token || token !== expectedToken) {
      return jsonError("Token de autenticação inválido", "AUTH_INVALID", 401);
    }

    let payload: RequestPayload;
    try {
      payload = await req.json();
    } catch {
      return jsonError("JSON inválido no corpo da requisição", "JSON_INVALIDO", 400);
    }

    // Validar cliente
    if (!payload.cliente) {
      return jsonError("Objeto 'cliente' é obrigatório", "VALIDACAO_FALHOU", 400);
    }
    if (!payload.cliente.nome || payload.cliente.nome.trim() === "") {
      return jsonError("Campo 'cliente.nome' é obrigatório", "VALIDACAO_FALHOU", 400);
    }
    if (payload.cliente.nome.length > 100) {
      return jsonError("Nome muito longo (máximo 100 caracteres)", "VALIDACAO_FALHOU", 400);
    }
    if (!payload.cliente.telefone || payload.cliente.telefone.trim() === "") {
      return jsonError("Campo 'cliente.telefone' é obrigatório", "VALIDACAO_FALHOU", 400);
    }

    const telefoneLimpo = payload.cliente.telefone.replace(/\D/g, '');
    if (!/^\d{10,13}$/.test(telefoneLimpo)) {
      return jsonError("Telefone inválido. Use formato brasileiro com DDD (10-13 dígitos)", "VALIDACAO_FALHOU", 400);
    }

    // Cotação é opcional — usar defaults se não enviada
    const cotacaoInput = payload.cotacao || {};

    // Validar tipo_servico se fornecido
    if (cotacaoInput.tipo_servico && cotacaoInput.tipo_servico.length > 10) {
      return jsonError("Máximo de 10 tipos de serviço permitidos", "VALIDACAO_FALHOU", 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar ou criar cliente
    const { data: clienteExistente, error: erroConsulta } = await supabase
      .from('clientes')
      .select('id, nome')
      .eq('empresa_id', EMPRESA_ID)
      .eq('telefone', telefoneLimpo)
      .maybeSingle();

    if (erroConsulta) {
      console.error("❌ Erro ao consultar cliente:", erroConsulta);
      return jsonError("Erro ao consultar cliente existente", "ERRO_CONSULTA", 500);
    }

    let clienteId: string;
    let clienteNovo = false;

    if (clienteExistente) {
      clienteId = clienteExistente.id;
      console.log("✅ Cliente encontrado:", clienteExistente.nome);
    } else {
      const nomeCliente = payload.cliente.nome.trim().substring(0, 100);
      const { data: novoCliente, error: erroCriacao } = await supabase
        .from('clientes')
        .insert({
          empresa_id: EMPRESA_ID,
          nome: nomeCliente,
          telefone: telefoneLimpo,
          endereco_completo: payload.cliente.endereco?.trim().substring(0, 200) || null,
          bairro: payload.cliente.bairro?.trim().substring(0, 100) || null,
          cep: payload.cliente.cep?.replace(/\D/g, '').substring(0, 8) || null,
          origem_lead: cotacaoInput.origem_lead?.substring(0, 50) || 'WhatsApp',
          ativo: true
        })
        .select('id')
        .single();

      if (erroCriacao) {
        console.error("❌ Erro ao criar cliente:", erroCriacao);
        return jsonError("Erro ao criar cliente", "ERRO_CRIACAO_CLIENTE", 500);
      }

      clienteId = novoCliente.id;
      clienteNovo = true;
      console.log("✅ Novo cliente criado - ID:", clienteId);
    }

    // Deduplicação 24h: verificar cotação pendente recente para o mesmo cliente
    const { data: cotacaoRecente, error: erroDedupQuery } = await supabase
      .from('cotacoes')
      .select('id, created_at')
      .eq('empresa_id', EMPRESA_ID)
      .eq('cliente_id', clienteId)
      .eq('status', 'pendente')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (erroDedupQuery) {
      console.error("⚠️ Erro na verificação de dedup (continuando):", erroDedupQuery);
    }

    if (cotacaoRecente) {
      console.log("🔄 Cotação pendente recente encontrada - ID:", cotacaoRecente.id);
      return new Response(
        JSON.stringify({
          sucesso: true,
          cliente_id: clienteId,
          cotacao_id: cotacaoRecente.id,
          cliente_novo: clienteNovo,
          cotacao_existente: true,
          mensagem: `✅ Cotação pendente já existe para este cliente (criada em ${cotacaoRecente.created_at}). Nenhuma duplicata criada.`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar defaults para campos não enviados
    const dataServico = cotacaoInput.data_servico_desejada || null;
    const horarioInicio = cotacaoInput.horario_inicio || null;

    // tipo_servico: usar default se não enviado ou vazio
    const tiposServico = (cotacaoInput.tipo_servico && cotacaoInput.tipo_servico.length > 0)
      ? cotacaoInput.tipo_servico.map(t => String(t).trim().substring(0, 50)).filter(t => t.length > 0)
      : ["A definir"];

    const { data: novaCotacao, error: erroCotacao } = await supabase
      .from('cotacoes')
      .insert({
        empresa_id: EMPRESA_ID,
        cliente_id: clienteId,
        tipo_servico: tiposServico,
        descricao_servico: cotacaoInput.descricao?.trim().substring(0, 1000) || null,
        valor_estimado: cotacaoInput.valor_estimado && cotacaoInput.valor_estimado > 0
          ? Math.min(cotacaoInput.valor_estimado, 1000000)
          : null,
        data_servico_desejada: dataServico,
        horario_inicio: horarioInicio,
        horario_fim: cotacaoInput.horario_fim || null,
        origem_lead: cotacaoInput.origem_lead?.substring(0, 50) || 'WhatsApp Auto',
        ocasiao: cotacaoInput.ocasiao?.trim().substring(0, 100) || null,
        observacoes: cotacaoInput.observacoes?.trim().substring(0, 500) || null,
        status: 'pendente'
      })
      .select('id')
      .single();

    if (erroCotacao) {
      console.error("❌ Erro ao criar cotação:", erroCotacao);
      return jsonError("Erro ao criar cotação", "ERRO_CRIACAO_COTACAO", 500);
    }

    console.log("✅ Cotação criada - ID:", novaCotacao.id);

    return new Response(
      JSON.stringify({
        sucesso: true,
        cliente_id: clienteId,
        cotacao_id: novaCotacao.id,
        cliente_novo: clienteNovo,
        cotacao_existente: false,
        mensagem: `✅ Cotação criada com sucesso! ${clienteNovo ? 'Novo cliente cadastrado.' : 'Cliente já existente.'}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("❌ Erro inesperado:", error);
    return jsonError("Erro interno no servidor", "ERRO_INTERNO", 500);
  }
});
