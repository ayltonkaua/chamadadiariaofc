import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForcePasswordChangePage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user, setUser } = useAuth();

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const passwordStrength = getPasswordStrength(newPassword);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validate
        if (newPassword.length < 8) {
            setError("A nova senha deve ter no mínimo 8 caracteres.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }

        setLoading(true);

        try {
            // 1. Update password + clear must_change_password flag
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
                data: {
                    must_change_password: false, // Remove the flag
                },
            });

            if (updateError) throw updateError;

            // 2. Update local user state so ProtectedRoute stops redirecting
            if (user) {
                setUser({ ...user, mustChangePassword: false });
            }

            toast({
                title: "Senha atualizada!",
                description: "Sua nova senha foi definida com sucesso.",
            });

            // 3. Navigate to dashboard
            navigate("/dashboard", { replace: true });
        } catch (err: any) {
            console.error("Erro ao trocar senha:", err);
            setError(err.message || "Erro ao atualizar senha.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
            <Card className="w-full max-w-md shadow-xl border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mx-auto mb-3">
                        <ShieldCheck className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">
                        Defina sua Nova Senha
                    </CardTitle>
                    <CardDescription className="text-violet-200 mt-1">
                        Por segurança, troque a senha temporária antes de continuar.
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* New Password */}
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Nova Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="newPassword"
                                    type="password"
                                    placeholder="Mínimo 8 caracteres"
                                    className="pl-10"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                />
                            </div>

                            {/* Password Strength Indicator */}
                            {newPassword.length > 0 && (
                                <div className="space-y-1">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4].map((level) => (
                                            <div
                                                key={level}
                                                className={`h-1.5 flex-1 rounded-full transition-colors ${passwordStrength.level >= level
                                                    ? passwordStrength.level <= 1
                                                        ? 'bg-red-400'
                                                        : passwordStrength.level <= 2
                                                            ? 'bg-orange-400'
                                                            : passwordStrength.level <= 3
                                                                ? 'bg-yellow-400'
                                                                : 'bg-green-400'
                                                    : 'bg-gray-200'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <p className={`text-xs ${passwordStrength.level <= 1 ? 'text-red-500' :
                                        passwordStrength.level <= 2 ? 'text-orange-500' :
                                            passwordStrength.level <= 3 ? 'text-yellow-600' :
                                                'text-green-600'
                                        }`}>
                                        {passwordStrength.label}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Repita a nova senha"
                                    className="pl-10"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    As senhas não coincidem
                                </p>
                            )}
                            {confirmPassword.length > 0 && newPassword === confirmPassword && (
                                <p className="text-xs text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Senhas coincidem
                                </p>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <Button
                            type="submit"
                            disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                            className="w-full h-11 text-base font-medium bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                        >
                            {loading ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Atualizando...</>
                            ) : (
                                "Confirmar Nova Senha"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Password Strength Helper
// ============================================================================

function getPasswordStrength(password: string): { level: number; label: string } {
    if (!password) return { level: 0, label: "" };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: "Fraca" };
    if (score <= 2) return { level: 2, label: "Regular" };
    if (score <= 3) return { level: 3, label: "Boa" };
    return { level: 4, label: "Forte" };
}
