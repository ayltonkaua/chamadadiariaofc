import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // O redirectTo aponta para a rota que criaremos no passo 2
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + "/update-password",
            });

            if (error) throw error;

            toast({
                title: "E-mail enviado!",
                description: "Se houver uma conta com este e-mail, você receberá um link para redefinir sua senha.",
                className: "bg-green-500 text-white",
            });

        } catch (error: any) {
            toast({
                title: "Erro ao enviar",
                description: error.message || "Tente novamente mais tarde.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1 text-center bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-t-lg">
                    <CardTitle className="text-2xl font-bold">Recuperar Senha</CardTitle>
                    <CardDescription className="text-gray-100">
                        Digite seu e-mail para receber o link de redefinição.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4 pt-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail cadastrado</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="exemplo@email.com"
                                    className="pl-10"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isLoading ? "Enviando..." : "Enviar Link de Recuperação"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate("/login")}
                            className="w-full"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar para Login
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default ForgotPasswordPage;
