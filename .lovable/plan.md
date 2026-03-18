

# Gerar PDF: Relatório da Integração WhatsApp → Cotações

Vou gerar um PDF documentando o que foi implementado na integração WhatsApp/n8n para criação automática de cotações.

## Conteúdo do documento

1. **Título**: Documentação — Integração WhatsApp para Registro Automático de Leads
2. **Objetivo**: Descrever a automação que captura mensagens recebidas no WhatsApp (via MegaAPI + n8n) e registra automaticamente o cliente e uma cotação no sistema.
3. **Componentes envolvidos**:
   - Edge Function `criar-cotacao-whatsapp`
   - Fluxo n8n (webhook MegaAPI → preparação → chamada à Edge Function)
   - Tabelas `clientes` e `cotacoes`
4. **Fluxo resumido**: Diagrama textual do pipeline
5. **Regras de negócio**: Deduplicação 24h, defaults (`tipo_servico = "A definir"`, data/hora nulos), autenticação por token
6. **Data de implementação**: Março 2026

## Implementação

- Script Python com `reportlab` gerando o PDF em `/mnt/documents/relatorio_integracao_whatsapp.pdf`
- QA visual com `pdftoppm`

