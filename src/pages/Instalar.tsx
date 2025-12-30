import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Smartphone, Share, MoreVertical, PlusSquare, CheckCircle2 } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function Instalar() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(userAgent))

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">App Instalado!</CardTitle>
            <CardDescription>
              O Start Nova Journey já está instalado no seu dispositivo. Você pode acessá-lo pela tela inicial.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <a href="/">Ir para o App</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
            <img src="/pwa-192x192.png" alt="Start Nova Journey" className="w-full h-full object-cover" />
          </div>
          <CardTitle className="text-xl">Instalar Start Nova Journey</CardTitle>
          <CardDescription>
            Adicione o app na tela inicial do seu celular para acesso rápido
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Android / Chrome - Direct Install */}
          {deferredPrompt && (
            <div className="space-y-3">
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="w-5 h-5 mr-2" />
                Instalar Agora
              </Button>
            </div>
          )}

          {/* iOS Instructions */}
          {isIOS && (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">Como instalar no iPhone/iPad</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <Share className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">1. Toque no botão Compartilhar</p>
                    <p className="text-sm text-muted-foreground">Na barra inferior do Safari</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <PlusSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">2. "Adicionar à Tela de Início"</p>
                    <p className="text-sm text-muted-foreground">Role para baixo e toque nessa opção</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">3. Confirme a instalação</p>
                    <p className="text-sm text-muted-foreground">Toque em "Adicionar"</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android Instructions (fallback) */}
          {!isIOS && !deferredPrompt && (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">Como instalar no Android</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <MoreVertical className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">1. Abra o menu do navegador</p>
                    <p className="text-sm text-muted-foreground">Toque nos 3 pontos no canto superior</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">2. "Instalar app" ou "Adicionar à tela inicial"</p>
                    <p className="text-sm text-muted-foreground">Selecione essa opção no menu</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">3. Confirme a instalação</p>
                    <p className="text-sm text-muted-foreground">O app aparecerá na sua tela inicial</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              O app funciona offline e oferece acesso rápido às suas funções favoritas
            </p>
          </div>

          <Button variant="outline" asChild className="w-full">
            <a href="/">Continuar no navegador</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
