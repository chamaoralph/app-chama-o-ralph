-- Criar tabela de serviços
CREATE TABLE IF NOT EXISTS servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    cotacao_id UUID REFERENCES cotacoes(id),
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    instalador_id UUID REFERENCES instaladores(id),
    data_servico_agendada TIMESTAMP WITH TIME ZONE NOT NULL,
    tipo_servico TEXT[] NOT NULL,
    descricao TEXT,
    endereco_completo TEXT NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    valor_mao_obra_instalador DECIMAL(10,2),
    status TEXT DEFAULT 'aguardando_distribuicao' CHECK (
        status IN (
            'aguardando_distribuicao',
            'disponivel',
            'atribuido',
            'em_andamento',
            'aguardando_aprovacao',
            'concluido',
            'cancelado'
        )
    ),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar sequência para código de serviço
CREATE SEQUENCE IF NOT EXISTS servico_codigo_seq START 1;

-- Habilitar RLS na tabela de serviços
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para usuários da empresa
CREATE POLICY "Usuários podem ver serviços da sua empresa" 
ON servicos 
FOR SELECT 
USING (empresa_id IN (
    SELECT empresa_id 
    FROM usuarios 
    WHERE id = auth.uid()
));

CREATE POLICY "Usuários podem criar serviços na sua empresa" 
ON servicos 
FOR INSERT 
WITH CHECK (empresa_id IN (
    SELECT empresa_id 
    FROM usuarios 
    WHERE id = auth.uid()
));

CREATE POLICY "Usuários podem atualizar serviços da sua empresa" 
ON servicos 
FOR UPDATE 
USING (empresa_id IN (
    SELECT empresa_id 
    FROM usuarios 
    WHERE id = auth.uid()
));

-- Políticas RLS para instaladores
CREATE POLICY "Instaladores podem ver serviços disponíveis ou atribuídos a eles" 
ON servicos 
FOR SELECT 
USING (
    status = 'disponivel' OR 
    instalador_id = auth.uid()
);

CREATE POLICY "Instaladores podem atualizar serviços atribuídos a eles" 
ON servicos 
FOR UPDATE 
USING (instalador_id = auth.uid());

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_servicos_updated_at
BEFORE UPDATE ON servicos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();