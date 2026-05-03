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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse query params
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'summary'; // 'summary' or 'files'
    const bucketParam = url.searchParams.get('bucket');
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(url.searchParams.get('per_page') || '50'), 50);

    // MODE: summary — fast, no signed URLs
    if (mode === 'summary') {
      const buckets = ['fotos-servicos', 'notas-fiscais', 'comprovantes'];
      const resumo: Record<string, { total_arquivos: number; tamanho_bytes: number }> = {};

      for (const bucketName of buckets) {
        let totalArquivos = 0;
        let tamanhoTotal = 0;

        try {
          const { data: itensRaiz } = await supabaseAdmin.storage
            .from(bucketName)
            .list('', { limit: 1000 });

          for (const item of itensRaiz || []) {
            if (!item.name || item.name.startsWith('.')) continue;

            if (item.id === null) {
              // Folder
              const { data: arquivosPasta } = await supabaseAdmin.storage
                .from(bucketName)
                .list(item.name, { limit: 1000 });

              for (const arquivo of arquivosPasta || []) {
                if (!arquivo.name || arquivo.name.startsWith('.') || arquivo.id === null) continue;
                totalArquivos++;
                tamanhoTotal += arquivo.metadata?.size || 0;
              }
            } else {
              totalArquivos++;
              tamanhoTotal += item.metadata?.size || 0;
            }
          }
        } catch (err) {
          console.error(`Erro processando bucket ${bucketName}:`, err);
        }

        resumo[bucketName] = { total_arquivos: totalArquivos, tamanho_bytes: tamanhoTotal };
      }

      const totalArquivos = Object.values(resumo).reduce((acc, b) => acc + b.total_arquivos, 0);
      const tamanhoTotalBytes = Object.values(resumo).reduce((acc, b) => acc + b.tamanho_bytes, 0);

      return new Response(JSON.stringify({
        sucesso: true,
        mode: 'summary',
        buckets: resumo,
        resumo: {
          total_arquivos: totalArquivos,
          tamanho_total_mb: Math.round(tamanhoTotalBytes / 1024 / 1024 * 100) / 100,
        },
        gerado_em: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MODE: files — paginated with signed URLs for a specific bucket
    if (mode === 'files' && bucketParam) {
      // Collect all file paths first (no URLs yet)
      const allFiles: { nome: string; tamanho: number; criado_em: string }[] = [];

      try {
        const { data: itensRaiz } = await supabaseAdmin.storage
          .from(bucketParam)
          .list('', { limit: 1000 });

        for (const item of itensRaiz || []) {
          if (!item.name || item.name.startsWith('.')) continue;

          if (item.id === null) {
            const { data: arquivosPasta } = await supabaseAdmin.storage
              .from(bucketParam)
              .list(item.name, { limit: 1000 });

            for (const arquivo of arquivosPasta || []) {
              if (!arquivo.name || arquivo.name.startsWith('.') || arquivo.id === null) continue;
              allFiles.push({
                nome: `${item.name}/${arquivo.name}`,
                tamanho: arquivo.metadata?.size || 0,
                criado_em: arquivo.created_at || new Date().toISOString(),
              });
            }
          } else {
            allFiles.push({
              nome: item.name,
              tamanho: item.metadata?.size || 0,
              criado_em: item.created_at || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error(`Erro listando bucket ${bucketParam}:`, err);
      }

      // Paginate
      const startIndex = (page - 1) * perPage;
      const pageFiles = allFiles.slice(startIndex, startIndex + perPage);
      const hasMore = startIndex + perPage < allFiles.length;

      // Generate signed URLs only for this page
      const arquivosComUrl: ArquivoBucket[] = [];
      for (const file of pageFiles) {
        const { data: urlData } = await supabaseAdmin.storage
          .from(bucketParam)
          .createSignedUrl(file.nome, 86400);

        arquivosComUrl.push({
          nome: file.nome,
          tamanho: file.tamanho,
          url: urlData?.signedUrl || '',
          criado_em: file.criado_em,
        });
      }

      // Get mapa_servicos
      const { data: servicos } = await supabaseAdmin
        .from('servicos')
        .select('id, codigo')
        .eq('empresa_id', usuario.empresa_id);

      const mapaServicos: Record<string, string> = {};
      for (const servico of servicos || []) {
        mapaServicos[servico.id] = servico.codigo;
      }

      return new Response(JSON.stringify({
        sucesso: true,
        mode: 'files',
        bucket: bucketParam,
        page,
        per_page: perPage,
        total: allFiles.length,
        has_more: hasMore,
        arquivos: arquivosComUrl,
        mapa_servicos: mapaServicos,
        validade_urls: '24 horas',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Parâmetros inválidos. Use mode=summary ou mode=files&bucket=nome' }), {
      status: 400,
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
