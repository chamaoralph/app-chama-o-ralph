import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BlobReader, BlobWriter, ZipWriter } from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const buckets = ['fotos-servicos', 'notas-fiscais', 'comprovantes'];
    
    // Criar ZIP em memória
    const blobWriter = new BlobWriter("application/zip");
    const zipWriter = new ZipWriter(blobWriter);
    
    let totalArquivos = 0;
    const dataAtual = new Date().toISOString().split('T')[0];

    for (const bucketName of buckets) {
      console.log(`Processando bucket: ${bucketName}`);
      
      try {
        // Listar itens na raiz
        const { data: itensRaiz, error: listError } = await supabaseAdmin.storage
          .from(bucketName)
          .list('', { limit: 1000 });

        if (listError) {
          console.error(`Erro ao listar bucket ${bucketName}:`, listError);
          continue;
        }

        for (const item of itensRaiz || []) {
          if (!item.name || item.name.startsWith('.')) continue;

          // Se item.id é null, é uma pasta
          if (item.id === null) {
            const { data: arquivosPasta } = await supabaseAdmin.storage
              .from(bucketName)
              .list(item.name, { limit: 1000 });

            for (const arquivo of arquivosPasta || []) {
              if (!arquivo.name || arquivo.name.startsWith('.') || arquivo.id === null) continue;

              const caminhoCompleto = `${item.name}/${arquivo.name}`;
              
              // Baixar arquivo
              const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                .from(bucketName)
                .download(caminhoCompleto);

              if (downloadError || !fileData) {
                console.error(`Erro ao baixar ${caminhoCompleto}:`, downloadError);
                continue;
              }

              // Adicionar ao ZIP com caminho organizado
              const zipPath = `backup-${dataAtual}/${bucketName}/${caminhoCompleto}`;
              await zipWriter.add(zipPath, new BlobReader(fileData));
              totalArquivos++;
              console.log(`Adicionado: ${zipPath}`);
            }
          } else {
            // É um arquivo na raiz
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
              .from(bucketName)
              .download(item.name);

            if (downloadError || !fileData) {
              console.error(`Erro ao baixar ${item.name}:`, downloadError);
              continue;
            }

            const zipPath = `backup-${dataAtual}/${bucketName}/${item.name}`;
            await zipWriter.add(zipPath, new BlobReader(fileData));
            totalArquivos++;
            console.log(`Adicionado: ${zipPath}`);
          }
        }
      } catch (err) {
        console.error(`Erro processando bucket ${bucketName}:`, err);
      }
    }

    // Fechar ZIP
    const zipBlob = await zipWriter.close();
    
    console.log(`ZIP gerado com ${totalArquivos} arquivos`);

    // Retornar ZIP como resposta binária
    const arrayBuffer = await zipBlob.arrayBuffer();
    
    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="backup-${dataAtual}.zip"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Erro ao gerar backup ZIP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
