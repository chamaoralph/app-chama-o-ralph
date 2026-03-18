import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Ban, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TelefoneBloqueado {
  id: string
  telefone: string
  motivo: string | null
  created_at: string | null
}

export function TelefonesBloqueadosCard() {
  const { toast } = useToast()
  const [bloqueados, setBloqueados] = useState<TelefoneBloqueado[]>([])
  const [loading, setLoading] = useState(true)
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoMotivo, setNovoMotivo] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchBloqueados()
  }, [])

  async function fetchBloqueados() {
    try {
      const { data, error } = await supabase
        .from('telefones_bloqueados')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setBloqueados(data || [])
    } catch (err) {
      console.error('Erro ao buscar bloqueados:', err)
    } finally {
      setLoading(false)
    }
  }

  async function adicionarBloqueio() {
    const telefoneClean = novoTelefone.replace(/\D/g, '')
    if (telefoneClean.length < 10) {
      toast({ title: '⚠️ Telefone inválido', description: 'Digite um número com pelo menos 10 dígitos.', variant: 'destructive' })
      return
    }

    setAdding(true)
    try {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single()

      if (!userData) throw new Error('Empresa não encontrada')

      const { error } = await supabase
        .from('telefones_bloqueados')
        .insert({
          empresa_id: userData.empresa_id,
          telefone: telefoneClean,
          motivo: novoMotivo || null,
        })

      if (error) {
        if (error.code === '23505') {
          toast({ title: '⚠️ Já bloqueado', description: 'Este número já está na lista.' })
        } else {
          throw error
        }
      } else {
        toast({ title: '🚫 Bloqueado', description: 'Número adicionado à lista de bloqueio.' })
        setNovoTelefone('')
        setNovoMotivo('')
        fetchBloqueados()
      }
    } catch (err) {
      console.error('Erro ao bloquear:', err)
      toast({ title: '❌ Erro', description: 'Não foi possível bloquear.', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  async function desbloquear(id: string) {
    if (!confirm('Desbloquear este número?')) return
    try {
      const { error } = await supabase
        .from('telefones_bloqueados')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast({ title: '✅ Desbloqueado', description: 'O número foi removido da lista.' })
      fetchBloqueados()
    } catch (err) {
      console.error('Erro ao desbloquear:', err)
      toast({ title: '❌ Erro', description: 'Não foi possível desbloquear.', variant: 'destructive' })
    }
  }

  function formatarTelefone(tel: string) {
    if (tel.length === 11) return `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}`
    if (tel.length === 10) return `(${tel.slice(0, 2)}) ${tel.slice(2, 6)}-${tel.slice(6)}`
    return tel
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Telefones Bloqueados</CardTitle>
            <CardDescription>
              Números bloqueados não criam cotações automáticas pelo WhatsApp
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Formulário de adição */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Telefone (ex: 11999998888)"
            value={novoTelefone}
            onChange={(e) => setNovoTelefone(e.target.value)}
            className="max-w-[200px]"
          />
          <Input
            placeholder="Motivo (opcional)"
            value={novoMotivo}
            onChange={(e) => setNovoMotivo(e.target.value)}
            className="max-w-[250px]"
          />
          <Button onClick={adicionarBloqueio} disabled={adding} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Bloquear
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : bloqueados.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum telefone bloqueado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telefone</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-20 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bloqueados.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{formatarTelefone(item.telefone)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.motivo || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => desbloquear(item.id)}
                      title="Desbloquear"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          💡 Você também pode bloquear números diretamente da lista de cotações usando o ícone 🚫.
        </p>
      </CardContent>
    </Card>
  )
}
