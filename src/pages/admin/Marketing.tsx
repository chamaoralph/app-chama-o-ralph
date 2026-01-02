import { AdminLayout } from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FunilConversaoContent } from "@/components/admin/FunilConversaoContent";
import { RFMAnaliseContent } from "@/components/admin/RFMAnaliseContent";
import { TrendingUp, Target } from "lucide-react";

export default function Marketing() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing</h1>
          <p className="text-gray-600">Funil de conversão, métricas e segmentação de clientes</p>
        </div>

        <Tabs defaultValue="funil" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="funil" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Funil de Conversão
            </TabsTrigger>
            <TabsTrigger value="rfm" className="gap-2">
              <Target className="h-4 w-4" />
              Análise RFM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="funil">
            <FunilConversaoContent />
          </TabsContent>

          <TabsContent value="rfm">
            <RFMAnaliseContent />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
