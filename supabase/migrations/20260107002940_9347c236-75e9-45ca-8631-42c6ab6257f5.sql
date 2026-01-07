-- Remover registros duplicados mantendo apenas o mais recente
DELETE FROM recibos_diarios 
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY instalador_id, data_referencia 
             ORDER BY created_at DESC
           ) as rn
    FROM recibos_diarios
  ) t WHERE rn > 1
);

-- Adicionar constraint única para prevenir duplicatas futuras
ALTER TABLE recibos_diarios 
ADD CONSTRAINT unique_recibo_instalador_dia 
UNIQUE (instalador_id, data_referencia);