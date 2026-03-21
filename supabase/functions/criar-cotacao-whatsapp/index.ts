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

interface RpcResponse {
  sucesso: boolean;
  bloqueado?: boolean;
  cliente_id?: string;
  cotacao_id?: string;
  cliente_novo?: boolean;
  cotacao_existente?: boolean;
  mensagem?: string;
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

function jsonSuccess(payload: RpcResponse) {
  return new Response(
    JSON.stringify(payload),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const { data, error } = await supabase.rpc('criar_cotacao_whatsapp_atomic', {
      p_empresa_id: EMPRESA_ID,
      p_cliente_nome: payload.cliente.nome,
      p_cliente_telefone: telefoneLimpo,
      p_cliente_endereco: payload.cliente.endereco ?? null,
      p_cliente_bairro: payload.cliente.bairro ?? null,
      p_cliente_cep: payload.cliente.cep ?? null,
      p_tipo_servico: cotacaoInput.tipo_servico?.map((tipo) => String(tipo)) ?? null,
      p_descricao: cotacaoInput.descricao ?? null,
      p_valor_estimado: cotacaoInput.valor_estimado ?? null,
      p_data_servico_desejada: cotacaoInput.data_servico_desejada ?? null,
      p_horario_inicio: cotacaoInput.horario_inicio ?? null,
      p_horario_fim: cotacaoInput.horario_fim ?? null,
      p_origem_lead: cotacaoInput.origem_lead ?? null,
      p_ocasiao: cotacaoInput.ocasiao ?? null,
      p_observacoes: cotacaoInput.observacoes ?? null,
    });

    if (error) {
      console.error("❌ Erro ao processar cotação via função atômica:", error);
      const message = error.message || '';

      if (message.includes('cliente.nome')) {
        return jsonError("Campo 'cliente.nome' é obrigatório", "VALIDACAO_FALHOU", 400);
      }

      if (message.includes('cliente.telefone')) {
        return jsonError("Campo 'cliente.telefone' é obrigatório", "VALIDACAO_FALHOU", 400);
      }

      return jsonError("Erro ao processar cotação", "ERRO_PROCESSAMENTO_COTACAO", 500);
    }

    const result = data as RpcResponse | null;

    if (!result?.sucesso) {
      return jsonError("Resposta inválida ao processar cotação", "RESPOSTA_INVALIDA", 500);
    }

    if (result.bloqueado) {
      console.log("🚫 Telefone bloqueado:", telefoneLimpo);
    } else if (result.cotacao_existente) {
      console.log("🔄 Cotação recente reaproveitada - ID:", result.cotacao_id);
    } else {
      console.log("✅ Cotação criada - ID:", result.cotacao_id);
    }

    return jsonSuccess(result);

  } catch (error: unknown) {
    console.error("❌ Erro inesperado:", error);
    return jsonError("Erro interno no servidor", "ERRO_INTERNO", 500);
  }
});
