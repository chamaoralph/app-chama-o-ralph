import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { z } from 'zod'

const signupSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255),
  telefone: z.string().regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos'),
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve ter pelo menos um número'),
  confirmPassword: z.string(),
  token: z.string().min(1, 'Token de convite obrigatório'),
})

export function SignupForm() {
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nome: '',
    telefone: '',
    token: searchParams.get('token') || '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validatingToken, setValidatingToken] = useState(false)
  const [invitationValid, setInvitationValid] = useState<boolean | null>(null)
  const [invitedEmail, setInvitedEmail] = useState('')
  
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  // Validate token on mount if present in URL
  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      validateInvitation(token)
    }
  }, [searchParams])

  async function validateInvitation(token: string) {
    setValidatingToken(true)
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('email, role, expires_at')
        .eq('token', token)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (error || !data) {
        setInvitationValid(false)
        setError('Convite inválido ou expirado')
        return
      }

      setInvitationValid(true)
      setInvitedEmail(data.email)
      setFormData(prev => ({ ...prev, email: data.email, token }))
    } catch (err) {
      setInvitationValid(false)
      setError('Erro ao validar convite')
    } finally {
      setValidatingToken(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validate form data
    const result = signupSchema.safeParse(formData)
    if (!result.success) {
      setError(result.error.errors[0].message)
      return
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)

    try {
      // Validate and consume invitation via RPC
      const { data: inviteData, error: inviteError } = await supabase
        .rpc('validate_signup_invitation', {
          p_email: formData.email.toLowerCase().trim(),
          p_token: formData.token,
        })

      if (inviteError) {
        throw new Error(inviteError.message || 'Convite inválido ou expirado')
      }

      if (!inviteData || inviteData.length === 0) {
        throw new Error('Convite inválido ou expirado')
      }

      const invitation = inviteData[0]

      // Create account with invitation data (role from invitation, not user-selected)
      await signUp(formData.email, formData.password, {
        empresa_id: invitation.empresa_id,
        nome: formData.nome,
        telefone: formData.telefone,
        tipo: invitation.role, // Role comes from invitation, not user selection
      })

      toast({
        title: "✅ Conta criada!",
        description: "Verifique seu email para confirmar.",
      })
      navigate('/login')
      
    } catch (error: any) {
      setError(error.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  // Show token validation state
  if (validatingToken) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validando convite...</p>
        </div>
      </div>
    )
  }

  // Show error if no valid token
  if (!formData.token && invitationValid === null) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Cadastro por Convite</h1>
            <p className="text-gray-600">Chama o Ralph - Sistema de Gestão</p>
          </div>
          
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-md mb-4">
            <p className="text-amber-800 text-sm">
              O cadastro requer um convite. Solicite ao administrador da sua empresa um link de convite.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
                Código do Convite
              </label>
              <input
                id="token"
                type="text"
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cole o código do convite aqui"
              />
            </div>
            
            <button
              type="button"
              onClick={() => formData.token && validateInvitation(formData.token)}
              disabled={!formData.token}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Validar Convite
            </button>
          </div>

          <div className="mt-6 text-center">
            <a href="/login" className="text-sm text-blue-600 hover:underline">
              Já tem conta? Faça login
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (invitationValid === false) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Convite Inválido</h2>
          <p className="text-gray-600 mb-4">
            Este convite não existe, já foi usado ou expirou. Solicite um novo convite ao administrador.
          </p>
          <a href="/login" className="text-blue-600 hover:underline">
            Voltar para login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Criar Conta
          </h1>
          <p className="text-gray-600">Chama o Ralph - Sistema de Gestão</p>
        </div>

        {invitedEmail && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
            ✅ Convite válido para: <strong>{invitedEmail}</strong>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-2">
              Nome Completo
            </label>
            <input
              id="nome"
              type="text"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-2">
              Telefone
            </label>
            <input
              id="telefone"
              type="tel"
              required
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="11999999999"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              disabled={loading || !!invitedEmail}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/login" className="text-sm text-blue-600 hover:underline">
            Já tem conta? Faça login
          </a>
        </div>
      </div>
    </div>
  )
}
