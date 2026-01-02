import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Clock, Repeat, DollarSign, RotateCcw, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface RFMConfig {
  recency_5: number
  recency_4: number
  recency_3: number
  recency_2: number
  frequency_5: number
  frequency_4: number
  frequency_3: number
  frequency_2: number
  monetary_5: number
  monetary_4: number
  monetary_3: number
  monetary_2: number
}

const defaultConfig: RFMConfig = {
  recency_5: 30,
  recency_4: 60,
  recency_3: 90,
  recency_2: 180,
  frequency_5: 6,
  frequency_4: 4,
  frequency_3: 2,
  frequency_2: 1,
  monetary_5: 1800,
  monetary_4: 1200,
  monetary_3: 600,
  monetary_2: 300,
}

export function RFMConfigCard() {
  const { toast } = useToast()
  const [config, setConfig] = useState<RFMConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [hasExistingConfig, setHasExistingConfig] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!userData) return
      setEmpresaId(userData.empresa_id)

      const { data, error } = await supabase
        .from('configuracoes_rfm')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setHasExistingConfig(true)
        setConfig({
          recency_5: data.recency_5,
          recency_4: data.recency_4,
          recency_3: data.recency_3,
          recency_2: data.recency_2,
          frequency_5: data.frequency_5,
          frequency_4: data.frequency_4,
          frequency_3: data.frequency_3,
          frequency_2: data.frequency_2,
          monetary_5: Number(data.monetary_5),
          monetary_4: Number(data.monetary_4),
          monetary_3: Number(data.monetary_3),
          monetary_2: Number(data.monetary_2),
        })
      }
    } catch (error: any) {
      console.error('Erro ao buscar configurações RFM:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field: keyof RFMConfig, value: string) {
    const numValue = parseInt(value) || 0
    setConfig(prev => ({ ...prev, [field]: numValue }))
  }

  function validateConfig(): string | null {
    // Recency deve ser crescente (30 < 60 < 90 < 180)
    if (config.recency_5 >= config.recency_4) {
      return 'Recency: Score 5 deve ser menor que Score 4'
    }
    if (config.recency_4 >= config.recency_3) {
      return 'Recency: Score 4 deve ser menor que Score 3'
    }
    if (config.recency_3 >= config.recency_2) {
      return 'Recency: Score 3 deve ser menor que Score 2'
    }

    // Frequency deve ser decrescente (6 > 4 > 2 > 1)
    if (config.frequency_5 <= config.frequency_4) {
      return 'Frequência: Score 5 deve ser maior que Score 4'
    }
    if (config.frequency_4 <= config.frequency_3) {
      return 'Frequência: Score 4 deve ser maior que Score 3'
    }
    if (config.frequency_3 <= config.frequency_2) {
      return 'Frequência: Score 3 deve ser maior que Score 2'
    }

    // Monetary deve ser decrescente (1800 > 1200 > 600 > 300)
    if (config.monetary_5 <= config.monetary_4) {
      return 'Monetário: Score 5 deve ser maior que Score 4'
    }
    if (config.monetary_4 <= config.monetary_3) {
      return 'Monetário: Score 4 deve ser maior que Score 3'
    }
    if (config.monetary_3 <= config.monetary_2) {
      return 'Monetário: Score 3 deve ser maior que Score 2'
    }

    // Todos os valores devem ser positivos
    const values = Object.values(config)
    if (values.some(v => v <= 0)) {
      return 'Todos os valores devem ser maiores que zero'
    }

    return null
  }

  async function handleSave() {
    const validationError = validateConfig()
    if (validationError) {
      toast({
        title: '⚠️ Validação',
        description: validationError,
        variant: 'destructive'
      })
      return
    }

    if (!empresaId) {
      toast({
        title: '❌ Erro',
        description: 'Empresa não encontrada',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      if (hasExistingConfig) {
        const { error } = await supabase
          .from('configuracoes_rfm')
          .update(config)
          .eq('empresa_id', empresaId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('configuracoes_rfm')
          .insert({ ...config, empresa_id: empresaId })

        if (error) throw error
        setHasExistingConfig(true)
      }

      toast({
        title: '✅ Salvo!',
        description: 'Critérios RFM atualizados com sucesso. Recalcule a análise para aplicar.'
      })
    } catch (error: any) {
      console.error('Erro ao salvar:', error)
      toast({
        title: '❌ Erro',
        description: 'Não foi possível salvar as configurações',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setConfig(defaultConfig)
    toast({
      title: '🔄 Restaurado',
      description: 'Valores padrão restaurados. Clique em Salvar para confirmar.'
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📊 Critérios de Análise RFM</CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 Critérios de Análise RFM</CardTitle>
        <CardDescription>
          Configure os thresholds para segmentação de clientes (Recência, Frequência, Monetário)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recency */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-blue-500" />
            <span>Recência (dias desde último serviço)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="recency_5" className="text-xs text-muted-foreground">Score 5 (até)</Label>
              <Input
                id="recency_5"
                type="number"
                min="1"
                value={config.recency_5}
                onChange={(e) => handleChange('recency_5', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="recency_4" className="text-xs text-muted-foreground">Score 4 (até)</Label>
              <Input
                id="recency_4"
                type="number"
                min="1"
                value={config.recency_4}
                onChange={(e) => handleChange('recency_4', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="recency_3" className="text-xs text-muted-foreground">Score 3 (até)</Label>
              <Input
                id="recency_3"
                type="number"
                min="1"
                value={config.recency_3}
                onChange={(e) => handleChange('recency_3', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="recency_2" className="text-xs text-muted-foreground">Score 2 (até)</Label>
              <Input
                id="recency_2"
                type="number"
                min="1"
                value={config.recency_2}
                onChange={(e) => handleChange('recency_2', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Score 1: mais de {config.recency_2} dias</p>
        </div>

        {/* Frequency */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Repeat className="h-4 w-4 text-green-500" />
            <span>Frequência (nº de serviços concluídos)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="frequency_5" className="text-xs text-muted-foreground">Score 5 (≥)</Label>
              <Input
                id="frequency_5"
                type="number"
                min="1"
                value={config.frequency_5}
                onChange={(e) => handleChange('frequency_5', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="frequency_4" className="text-xs text-muted-foreground">Score 4 (≥)</Label>
              <Input
                id="frequency_4"
                type="number"
                min="1"
                value={config.frequency_4}
                onChange={(e) => handleChange('frequency_4', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="frequency_3" className="text-xs text-muted-foreground">Score 3 (≥)</Label>
              <Input
                id="frequency_3"
                type="number"
                min="1"
                value={config.frequency_3}
                onChange={(e) => handleChange('frequency_3', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="frequency_2" className="text-xs text-muted-foreground">Score 2 (≥)</Label>
              <Input
                id="frequency_2"
                type="number"
                min="1"
                value={config.frequency_2}
                onChange={(e) => handleChange('frequency_2', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Score 1: 0 serviços</p>
        </div>

        {/* Monetary */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4 text-yellow-500" />
            <span>Valor Monetário (R$ total gasto)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="monetary_5" className="text-xs text-muted-foreground">Score 5 (≥ R$)</Label>
              <Input
                id="monetary_5"
                type="number"
                min="1"
                value={config.monetary_5}
                onChange={(e) => handleChange('monetary_5', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="monetary_4" className="text-xs text-muted-foreground">Score 4 (≥ R$)</Label>
              <Input
                id="monetary_4"
                type="number"
                min="1"
                value={config.monetary_4}
                onChange={(e) => handleChange('monetary_4', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="monetary_3" className="text-xs text-muted-foreground">Score 3 (≥ R$)</Label>
              <Input
                id="monetary_3"
                type="number"
                min="1"
                value={config.monetary_3}
                onChange={(e) => handleChange('monetary_3', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="monetary_2" className="text-xs text-muted-foreground">Score 2 (≥ R$)</Label>
              <Input
                id="monetary_2"
                type="number"
                min="1"
                value={config.monetary_2}
                onChange={(e) => handleChange('monetary_2', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Score 1: menos de R$ {config.monetary_2}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Padrões
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
