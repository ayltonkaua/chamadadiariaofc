import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const NotificacoesPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");

  const handleEnviarNotificacao = async () => {
    if (!titulo || !mensagem) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Usando a URL base correta do OneSignal
      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Basic ${import.meta.env.VITE_ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify({
          app_id: import.meta.env.VITE_ONESIGNAL_APP_ID,
          included_segments: ["Subscribed Users"],
          contents: {
            en: mensagem,
            pt: mensagem
          },
          headings: {
            en: titulo,
            pt: titulo
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0] || "Erro ao enviar notificação");
      }

      const data = await response.json();
      console.log("Resposta do OneSignal:", data);

      toast({
        title: "Sucesso",
        description: "Notificação enviada com sucesso!",
      });

      setTitulo("");
      setMensagem("");
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a notificação. Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">Enviar Notificações</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nova Notificação Push</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="titulo">Título da Notificação</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Digite o título da notificação"
                />
              </div>
              <div>
                <Label htmlFor="mensagem">Mensagem</Label>
                <Textarea
                  id="mensagem"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Digite a mensagem da notificação"
                  rows={4}
                />
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleEnviarNotificacao} 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {loading ? "Enviando..." : "Enviar Notificação"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificacoesPage;