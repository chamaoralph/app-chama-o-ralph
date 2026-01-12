import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArquivoBucket {
  nome: string;
  tamanho: number;
  url: string;
  criado_em: string;
}

interface BucketInfo {
  total_arquivos: number;
  tamanho_bytes: number;
  arquivos: ArquivoBucket[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Criar cliente com token do usuário para verificar permissões
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se é admin
    const { data: userRole } = await supabaseUser
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .single();

    if (!userRole) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem acessar backups' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obter empresa_id do usuário
    const { data: usuario } = await supabaseUser
      .from('usuarios')
      .select('empresa_id')
      .eq('id', userData.user.id)
      .single();

    if (!usuario?.empresa_id) {
      return new Response(JSON.stringify({ error: 'Empresa não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Usar service role para acessar storage
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const buckets = ['fotos-servicos', 'notas-fiscais', 'comprovantes'];
    const resultado: Record<string, BucketInfo> = {};

    for (const bucketName of buckets) {
      const { data: arquivos, error: listError } = await supabaseAdmin.storage
        .from(bucketName)
        .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

      if (listError) {
        console.error(`Erro ao listar bucket ${bucketName}:`, listError);
        resultado[bucketName] = { total_arquivos: 0, tamanho_bytes: 0, arquivos: [] };
        continue;
      }

      const arquivosComUrl: ArquivoBucket[] = [];
      let tamanhoTotal = 0;

      for (const arquivo of arquivos || []) {
        if (!arquivo.name || arquivo.name.startsWith('.')) continue;

        // Gerar URL assinada válida por 24 horas
        const { data: urlData } = await supabaseAdmin.storage
          .from(bucketName)
          .createSignedUrl(arquivo.name, 86400); // 24 horas

        if (urlData?.signedUrl) {
          const tamanho = arquivo.metadata?.size || 0;
          tamanhoTotal += tamanho;

          arquivosComUrl.push({
            nome: arquivo.name,
            tamanho,
            url: urlData.signedUrl,
            criado_em: arquivo.created_at || new Date().toISOString(),
          });
        }
      }

      resultado[bucketName] = {
        total_arquivos: arquivosComUrl.length,
        tamanho_bytes: tamanhoTotal,
        arquivos: arquivosComUrl,
      };
    }

    // Calcular totais
    const totalArquivos = Object.values(resultado).reduce((acc, b) => acc + b.total_arquivos, 0);
    const tamanhoTotalBytes = Object.values(resultado).reduce((acc, b) => acc + b.tamanho_bytes, 0);

    return new Response(JSON.stringify({
      sucesso: true,
      empresa_id: usuario.empresa_id,
      buckets: resultado,
      resumo: {
        total_arquivos: totalArquivos,
        tamanho_total_mb: Math.round(tamanhoTotalBytes / 1024 / 1024 * 100) / 100,
      },
      gerado_em: new Date().toISOString(),
      validade_urls: '24 horas',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no backup-storage:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
