import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

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
        .from('usuarios')
        .select('tipo')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserType(data.tipo as 'admin' | 'instalador')
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

  async function signUp(email: string, password: string, userData: any) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Erro ao criar usuário')

    const { error: userError } = await supabase.from('usuarios').insert({
      id: authData.user.id,
      empresa_id: userData.empresa_id,
      nome: userData.nome,
      telefone: userData.telefone,
      tipo: userData.tipo,
      ativo: true,
    })

    if (userError) throw userError

    if (userData.tipo === 'instalador') {
      const { error: instaladorError } = await supabase
        .from('instaladores')
        .insert({
          id: authData.user.id,
          empresa_id: userData.empresa_id,
          ativo: true,
        })

      if (instaladorError) throw instaladorError
    }
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
