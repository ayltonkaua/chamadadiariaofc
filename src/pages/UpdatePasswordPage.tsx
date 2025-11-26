import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UpdatePasswordPage: React.FC = () => {
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                toast({
                    title: "Link inválido ou expirado",
                    description: "Por favor, solicite uma nova recuperação de senha.",
                    variant: "destructive"
                });
                navigate("/forgot-password");
            }
        });
    }, [navigate, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password: password });

            if (error) throw error;

            // --- MUDANÇA AQUI ---
            // Forçamos o logout para que a sessão não persista
            await supabase.auth.signOut();
            // --------------------

            toast({
                title: "Senha atualizada!",
                description: "Sua senha foi alterada. Faça login novamente.",
                className: "bg-green-500 text-white",
            });

            // Redireciona para o login
            navigate("/login");

        } catch (error: any) {
            toast({
                title: "Erro ao atualizar",
                description: error.message,
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
                    <CardTitle className="text-2xl font-bold">Nova Senha</CardTitle>
                    <CardDescription className="text-gray-100">
                        Digite sua nova senha abaixo.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4 pt-6">
                        <div className="space-y-2">
                            <Label htmlFor="password">Nova Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="********"
                                    className="pl-10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isLoading ? "Salvar Nova Senha" : "Atualizar Senha"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default UpdatePasswordPage;
