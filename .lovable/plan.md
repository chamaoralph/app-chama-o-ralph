

## Correção Pontual: Ajustar Datas dos Lançamentos Existentes

### O que você quer

- **Manter a regra atual**: quando um serviço é finalizado, ele entra no caixa na data em que foi finalizado (comportamento atual)
- **Corrigir dados atuais**: os lançamentos que já existem devem ter a data ajustada para a data agendada do serviço

### Ação Única (sem alterar regras)

Executar apenas o UPDATE para corrigir os lançamentos existentes:

```sql
UPDATE lancamentos_caixa l
SET data_lancamento = s.data_servico_agendada::date
FROM servicos s
WHERE l.servico_id = s.id
  AND l.categoria = 'Receita de Servico'
  AND l.data_lancamento != s.data_servico_agendada::date;
```

### Resultado

- Os lançamentos existentes (como SRV-2026-067) serão movidos para a data correta do serviço
- A partir de agora, novos serviços continuam entrando na data em que são finalizados
- Nenhuma mudança na lógica do sistema

