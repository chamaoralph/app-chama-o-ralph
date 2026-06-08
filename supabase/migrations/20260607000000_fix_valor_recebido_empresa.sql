-- Corrige valor_recebido_cliente para serviços onde recebimento_cliente = 'empresa'
-- e o valor estava zerado (bug: FinalizarServico.tsx sempre salvava 0 para empresa).
-- O valor correto é: 2 × mao_obra_instalador + custo_suporte + reembolso_despesas,
-- o que garante a invariante Total Empresa + Total Instalador = Total Recebido.
UPDATE servicos
SET valor_recebido_cliente = (
  COALESCE(valor_mao_obra_instalador, 0) * 2
  + COALESCE(custo_suporte, 0)
  + COALESCE(valor_reembolso_despesas, 0)
)
WHERE recebimento_cliente = 'empresa'
  AND (valor_recebido_cliente IS NULL OR valor_recebido_cliente = 0);
