import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { UserPlus, CheckCircle, Eye, User, Wrench, Calendar, RefreshCw } from 'lucide-react'
import { formatarDataBR } from '@/lib/utils'

interface Servico {
  id: string
  codigo: string
  tipo_servico: string[]
  status: string
  data_servico_agendada: string
  valor_total: number
  observacoes_instalador: string | null
  instalador_id: string | null
  clientes: {
    nome: string
  }
  usuarios?: {
    nome: string
  }
}

interface MobileServicoCardAdminProps {
  servico: Servico
  isSelected: boolean
  onToggleSelect: () => void
  onAtribuir: () => void
  onFinalizar: () => void
  onAlterarStatus: () => void
  onVerDetalhes: () => void
}

export function MobileServicoCardAdmin({
  servico,
  isSelected,
  onToggleSelect,
  onAtribuir,
  onFinalizar,
  onAlterarStatus,
  onVerDetalhes
}: MobileServicoCardAdminProps) {
  // Abreviar código: SRV-2025-048 -> #048
  const codigoAbreviado = `#${servico.codigo.split('-').pop()}`
  
  const getStatusBadge = (status: string, observacoes?: string | null) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      aguardando_distribuicao: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Aguardando' },
      disponivel: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Disponível' },
      solicitado: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Solicitado' },
      atribuido: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Atribuído' },
      em_andamento: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Em Andamento' },
      aguardando_aprovacao: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Aguardando Aprov.' },
      concluido: { bg: 'bg-green-100', text: 'text-green-800', label: 'Concluído' },
      cancelado: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
    }
    const badge = badges[status] || badges.aguardando_distribuicao
    const isFinalizadoPeloAdmin = status === 'concluido' && observacoes === 'Finalizado pelo administrador'
    
    return (
      <div className="flex items-center gap-1">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
        {isFinalizadoPeloAdmin && (
          <span className="text-[10px] text-muted-foreground">(admin)</span>
        )}
      </div>
    )
  }

  const dataFormatada = formatarDataBR(servico.data_servico_agendada)
  const valorFormatado = Number(servico.valor_total).toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  })

  const podeAtribuir = !servico.instalador_id
  const podeFinalizar = servico.status === 'em_andamento' || servico.status === 'atribuido'

  return (
    <div className={`bg-card border rounded-lg p-3 ${isSelected ? 'ring-2 ring-primary border-primary' : 'border-border'}`}>
      {/* Header: Checkbox + Código + Data */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
          />
          <span className="font-bold text-foreground">{codigoAbreviado}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {dataFormatada}
        </div>
      </div>

      {/* Cliente */}
      <div className="flex items-center gap-1.5 text-sm mb-1">
        <User className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-foreground truncate">{servico.clientes.nome}</span>
      </div>

      {/* Tipo de serviço */}
      <div className="flex items-center gap-1.5 text-sm mb-2">
        <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground truncate">{servico.tipo_servico?.join(', ') || '-'}</span>
      </div>

      {/* Instalador (se tiver) */}
      {servico.usuarios?.nome && (
        <div className="flex items-center gap-1.5 text-sm mb-2">
          <UserPlus className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-purple-700 dark:text-purple-400 truncate">{servico.usuarios.nome}</span>
        </div>
      )}

      {/* Status + Valor */}
      <div className="flex items-center justify-between py-2 border-t border-border">
        {getStatusBadge(servico.status, servico.observacoes_instalador)}
        <span className="font-semibold text-primary">{valorFormatado}</span>
      </div>

      {/* Ações */}
      <div className="flex gap-2 mt-2 flex-wrap">
        {podeAtribuir && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs min-w-[80px]"
            onClick={onAtribuir}
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            Atribuir
          </Button>
        )}
        {podeFinalizar && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs text-green-600 border-green-200 hover:bg-green-50 min-w-[80px]"
            onClick={onFinalizar}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            Finalizar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 min-w-[80px]"
          onClick={onAlterarStatus}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Status
        </Button>
        <Button
          size="sm"
          variant="default"
          className="flex-1 text-xs min-w-[80px]"
          onClick={onVerDetalhes}
        >
          <Eye className="w-3.5 h-3.5 mr-1" />
          Detalhes
        </Button>
      </div>
    </div>
  )
}
