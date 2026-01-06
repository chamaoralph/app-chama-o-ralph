import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

// ID fixo da empresa
const EMPRESA_ID = "a5006ac5-230b-4687-bb88-e49ebc7811a2";

// Rate limiting em memória (por IP, janela de 1 hora)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 100; // máximo 100 requisições por hora
const RATE_LIMIT_WINDOW = 3600000; // 1 hora em ms

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

// Função para verificar assinatura HMAC
function verifySignature(body: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

// Função para verificar rate limit
function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);
  
  if (!entry || (now - entry.windowStart) >= RATE_LIMIT_WINDOW) {
    // Nova janela
    rateLimitMap.set(clientIp, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Obter IP do cliente para rate limiting
  const clientIp = req.headers.get('cf-connecting-ip') || 
                   req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   'unknown';

  try {
    console.log("📩 Recebendo requisição de cotação via WhatsApp...");
    console.log("🌐 IP do cliente:", clientIp);

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

    // Verificar rate limit
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      console.error("❌ Rate limit excedido para IP:", clientIp);
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Limite de requisições excedido. Tente novamente mais tarde.",
          codigo: "RATE_LIMIT_EXCEEDED"
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '3600'
          } 
        }
      );
    }

    // Ler body como texto para verificação de assinatura
    const bodyText = await req.text();
    
    // Verificar assinatura HMAC
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error("❌ WEBHOOK_SECRET não configurado");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Configuração do servidor incompleta",
          codigo: "CONFIG_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const signature = req.headers.get('X-Webhook-Signature') || req.headers.get('x-webhook-signature');
    if (!signature) {
      console.error("❌ Assinatura não fornecida");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Assinatura de autenticação não fornecida",
          codigo: "AUTH_MISSING"
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!verifySignature(bodyText, signature, webhookSecret)) {
      console.error("❌ Assinatura inválida detectada de IP:", clientIp);
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Assinatura de autenticação inválida",
          codigo: "AUTH_INVALID"
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("✅ Assinatura verificada com sucesso");

    // Parse do body
    let payload: RequestPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      console.error("❌ JSON inválido no body");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "JSON inválido no corpo da requisição",
          codigo: "JSON_INVALIDO"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("📋 Payload recebido (sanitizado)");

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

    // Validar tamanho do nome (max 100 caracteres)
    if (payload.cliente.nome.length > 100) {
      console.error("❌ Nome muito longo");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Nome muito longo (máximo 100 caracteres)",
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

    // Limpar e validar telefone (apenas números, formato brasileiro)
    const telefoneLimpo = payload.cliente.telefone.replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(telefoneLimpo)) {
      console.error("❌ Telefone inválido:", telefoneLimpo);
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Telefone inválido. Use formato brasileiro com DDD (10-11 dígitos)",
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

    if (!payload.cotacao.tipo_servico || !Array.isArray(payload.cotacao.tipo_servico) || payload.cotacao.tipo_servico.length === 0) {
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

    // Validar tamanho do array de tipos de serviço
    if (payload.cotacao.tipo_servico.length > 10) {
      console.error("❌ Muitos tipos de serviço");
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: "Máximo de 10 tipos de serviço permitidos",
          codigo: "VALIDACAO_FALHOU"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      
      // Sanitizar inputs
      const nomeCliente = payload.cliente.nome.trim().substring(0, 100);
      const enderecoCliente = payload.cliente.endereco?.trim().substring(0, 200) || null;
      const bairroCliente = payload.cliente.bairro?.trim().substring(0, 100) || null;
      const cepCliente = payload.cliente.cep?.replace(/\D/g, '').substring(0, 8) || null;
      
      const { data: novoCliente, error: erroCriacao } = await supabase
        .from('clientes')
        .insert({
          empresa_id: EMPRESA_ID,
          nome: nomeCliente,
          telefone: telefoneLimpo,
          endereco_completo: enderecoCliente,
          bairro: bairroCliente,
          cep: cepCliente,
          origem_lead: payload.cotacao.origem_lead?.substring(0, 50) || 'WhatsApp',
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
    
    // Sanitizar tipos de serviço (máximo 50 caracteres cada)
    const tiposServicoSanitizados = payload.cotacao.tipo_servico
      .map(t => String(t).trim().substring(0, 50))
      .filter(t => t.length > 0);

    const { data: novaCotacao, error: erroCotacao } = await supabase
      .from('cotacoes')
      .insert({
        empresa_id: EMPRESA_ID,
        cliente_id: clienteId,
        tipo_servico: tiposServicoSanitizados,
        descricao_servico: payload.cotacao.descricao?.trim().substring(0, 1000) || null,
        valor_estimado: payload.cotacao.valor_estimado && payload.cotacao.valor_estimado > 0 
          ? Math.min(payload.cotacao.valor_estimado, 1000000) 
          : null,
        data_servico_desejada: payload.cotacao.data_servico_desejada || null,
        horario_inicio: payload.cotacao.horario_inicio || null,
        horario_fim: payload.cotacao.horario_fim || null,
        origem_lead: payload.cotacao.origem_lead?.substring(0, 50) || 'WhatsApp',
        ocasiao: payload.cotacao.ocasiao?.trim().substring(0, 100) || null,
        observacoes: payload.cotacao.observacoes?.trim().substring(0, 500) || null,
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
        codigo: "ERRO_INTERNO"
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
