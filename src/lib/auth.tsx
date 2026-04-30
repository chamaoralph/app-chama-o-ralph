import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  userType: 'admin' | 'instalador' | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, userData: any) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userType, setUserType] = useState<'admin' | 'instalador' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        fetchUserType(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        fetchUserType(session.user.id)
      } else {
        setUserType(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserType(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      
      if (!data) {
        console.error('Usuário não encontrado na tabela user_roles')
        await supabase.auth.signOut()
        setUserType(null)
        return
      }
      
      setUserType(data.role as 'admin' | 'instalador')
    } catch (error) {
      console.error('Erro ao buscar tipo de usuário:', error)
      setUserType(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
  }

  async function signUp(
    email: string,
    password: string,
    userData: {
      empresa_id: string
      nome: string
      telefone: string
      tipo: 'admin' | 'instalador'
    }
  ) {
    // Role e dados do usuário vêm via raw_user_meta_data — um trigger no banco
    // (handle_new_user) cria os registros em usuarios/user_roles/instaladores
    // de forma atômica e segura, sem depender de auth.uid() no client.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          nome: userData.nome,
          telefone: userData.telefone,
          empresa_id: userData.empresa_id,
          tipo: userData.tipo,
        },
      },
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Erro ao criar usuário')
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    session,
    userType,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
