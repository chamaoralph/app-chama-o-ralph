import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, userType, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (userType === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else if (userType === 'instalador') {
      navigate('/instalador/dashboard', { replace: true });
    } else {
      console.error('Tipo de usuário não identificado');
      navigate('/login', { replace: true });
    }
  }, [user, userType, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
};

export default Index;
