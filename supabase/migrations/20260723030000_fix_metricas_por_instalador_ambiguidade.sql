-- =============================================================================
-- Migration: 20260723030000_fix_metricas_por_instalador_ambiguidade.sql
-- Hotfix: metricas_acessorios_por_instalador falhava em runtime com
--   "column reference \"instalador_id\" is ambiguous"
--
-- Causa: a CTE itens_calc selecionava `instalador_id` sem qualificador de
-- tabela (`select servico_id, instalador_id, quantidade, ...`). Como a função
-- usa RETURNS TABLE com uma coluna de saída também chamada instalador_id
-- (que o PL/pgSQL trata como variável no escopo da função), o Postgres não
-- conseguiu decidir entre a variável de saída e a coluna vinda de
-- itens_finalizacao. CREATE OR REPLACE não valida o SQL interno — só falha
-- na primeira execução, que foi quando o bug apareceu (passo de teste pós-push).
--
-- Corpo INTEIRO revisado contra as 7 colunas do RETURNS TABLE (instalador_id,
-- instalador_nome, servicos_concluidos, servicos_com_acessorio, taxa_anexo_pct,
-- lucro_gerado_empresa, itens_vendidos):
--   - instalador_id fora da CTE itens_calc já vem qualificado (s.instalador_id,
--     sp.instalador_id) — sem risco.
--   - instalador_nome, servicos_concluidos, servicos_com_acessorio,
--     lucro_gerado_empresa, itens_vendidos só aparecem como alias de saída
--     ("AS nome") — alias não é resolvido como ColumnRef, não há ambiguidade.
--   - "ORDER BY taxa_anexo_pct" usa o atalho do SQL:1999 (ORDER BY por nome de
--     saída da própria SELECT list), resolvido por posição de saída ANTES de
--     qualquer resolução de ColumnRef — não passa pelo hook do PL/pgSQL.
-- Única correção necessária: qualificar as colunas de itens_finalizacao dentro
-- da CTE itens_calc com o alias da tabela.
--
-- Não toca em: coluna acessorios_vendidos, dado já migrado, nem na function
-- metricas_acessorios (não tem esse bug — já qualifica tudo via agregados./total.).
-- =============================================================================

begin;

create or replace function public.metricas_acessorios_por_instalador(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns table (
  instalador_id       uuid,
  instalador_nome     text,
  servicos_concluidos int,
  servicos_com_acessorio int,
  taxa_anexo_pct      numeric(5,2),
  lucro_gerado_empresa numeric(10,2),
  itens_vendidos      int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with servicos_periodo as (
    select s.id, s.instalador_id, s.acessorios_vendidos
    from servicos s
    where s.empresa_id = p_empresa_id
      and s.status = 'concluido'
      and s.instalador_id is not null
      and (s.data_conclusao at time zone 'America/Sao_Paulo')::date between p_data_inicio and p_data_fim
  ),
  itens_finalizacao as (
    select
      sp.id as servico_id,
      sp.instalador_id,
      coalesce((item->>'quantidade')::numeric, 1) as quantidade,
      item->>'fornecedor' as fornecedor,
      coalesce((item->>'valor_compra')::numeric, 0) as custo_total,
      coalesce((item->>'repasse_empresa')::numeric, 0) as repasse_empresa
    from servicos_periodo sp
    cross join lateral jsonb_array_elements(coalesce(sp.acessorios_vendidos, '[]'::jsonb)) as item
  ),
  itens_calc as (
    select
      f.servico_id,
      f.instalador_id,
      f.quantidade,
      case when f.fornecedor = 'empresa' then f.repasse_empresa - f.custo_total else f.repasse_empresa end as lucro_empresa
    from itens_finalizacao f
  )
  select
    sp.instalador_id,
    coalesce(u.nome, '(sem nome)') as instalador_nome,
    count(distinct sp.id)::int as servicos_concluidos,
    count(distinct ic.servico_id)::int as servicos_com_acessorio,
    round(case when count(distinct sp.id) > 0
      then count(distinct ic.servico_id)::numeric / count(distinct sp.id) * 100
      else 0 end, 2)::numeric(5,2) as taxa_anexo_pct,
    coalesce(sum(ic.lucro_empresa), 0)::numeric(10,2) as lucro_gerado_empresa,
    coalesce(sum(ic.quantidade), 0)::int as itens_vendidos
  from servicos_periodo sp
  left join usuarios u on u.id = sp.instalador_id
  left join itens_calc ic on ic.servico_id = sp.id
  group by sp.instalador_id, u.nome
  order by taxa_anexo_pct desc;
end;
$$;

grant execute on function public.metricas_acessorios_por_instalador(uuid, date, date) to authenticated;

commit;
