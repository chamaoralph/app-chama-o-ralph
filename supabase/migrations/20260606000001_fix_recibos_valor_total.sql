-- Corrigir valor_total dos recibos: deve ser igual a valor_mao_obra (50% bruto), sem reembolsos
UPDATE public.recibos_diarios
SET valor_total = valor_mao_obra
WHERE valor_total <> valor_mao_obra;
