/**
 * LogoUploader Component
 * 
 * Drag-and-drop file uploader for school logos.
 * Uploads to Supabase Storage and returns the public URL.
 * Optionally extracts dominant colors from the uploaded image.
 */

import React, { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Loader2, Image as ImageIcon, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractDominantColors } from "@/lib/colorExtractor";

interface LogoUploaderProps {
    currentUrl: string | null;
    escolaId: string;
    onUploadComplete: (url: string) => void;
    onRemove: () => void;
    onColorsExtracted?: (primary: string, secondary: string) => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function LogoUploader({
    currentUrl,
    escolaId,
    onUploadComplete,
    onRemove,
    onColorsExtracted,
}: LogoUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [extractingColors, setExtractingColors] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Update preview when currentUrl changes externally
    React.useEffect(() => {
        setPreviewUrl(currentUrl);
    }, [currentUrl]);

    const validateFile = (file: File): string | null => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            return "Formato não suportado. Use JPG, PNG, WebP ou GIF.";
        }
        if (file.size > MAX_FILE_SIZE) {
            return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 2MB.`;
        }
        return null;
    };

    const uploadFile = async (file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        setUploading(true);

        try {
            // Create a local preview immediately
            const localPreview = URL.createObjectURL(file);
            setPreviewUrl(localPreview);

            // Generate unique filename
            const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
            const fileName = `logos/${escolaId}/logo_${Date.now()}.${ext}`;

            // Delete old file if exists
            if (currentUrl) {
                const oldPath = extractStoragePath(currentUrl);
                if (oldPath) {
                    await supabase.storage.from('escola-assets').remove([oldPath]);
                }
            }

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('escola-assets')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('escola-assets')
                .getPublicUrl(fileName);

            const publicUrl = urlData.publicUrl;
            setPreviewUrl(publicUrl);
            onUploadComplete(publicUrl);

            // Extract colors (non-blocking)
            if (onColorsExtracted) {
                setExtractingColors(true);
                try {
                    const colors = await extractDominantColors(file);
                    onColorsExtracted(colors.primary, colors.secondary);
                } catch (colorErr) {
                    console.warn("Erro ao extrair cores:", colorErr);
                } finally {
                    setExtractingColors(false);
                }
            }

            // Cleanup local preview
            URL.revokeObjectURL(localPreview);

        } catch (err: any) {
            console.error("Upload error:", err);
            setError(err.message || "Erro ao fazer upload da logo");
            setPreviewUrl(currentUrl); // Revert preview
        } finally {
            setUploading(false);
        }
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer.files;
        if (files?.[0]) {
            uploadFile(files[0]);
        }
    }, [escolaId, currentUrl]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files?.[0]) {
            uploadFile(files[0]);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const handleRemove = async () => {
        if (currentUrl) {
            const path = extractStoragePath(currentUrl);
            if (path) {
                await supabase.storage.from('escola-assets').remove([path]);
            }
        }
        setPreviewUrl(null);
        setError(null);
        onRemove();
    };

    return (
        <div className="space-y-3">
            {/* Upload Zone */}
            {!previewUrl ? (
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
            relative flex flex-col items-center justify-center gap-3 
            w-full h-44 rounded-xl border-2 border-dashed cursor-pointer
            transition-all duration-200 
            ${dragActive
                            ? 'border-violet-500 bg-violet-50 scale-[1.02]'
                            : 'border-gray-300 bg-gray-50 hover:border-violet-400 hover:bg-violet-50/50'
                        }
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
                            <span className="text-sm text-violet-600 font-medium">Enviando logo...</span>
                        </>
                    ) : (
                        <>
                            <div className="p-3 rounded-full bg-violet-100">
                                <Upload className="h-6 w-6 text-violet-600" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-700">
                                    {dragActive ? "Solte a imagem aqui" : "Arraste a logo ou clique para selecionar"}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    JPG, PNG, WebP ou GIF • Máximo 2MB
                                </p>
                            </div>
                        </>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            ) : (
                /* Preview */
                <div className="relative group">
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="w-24 h-24 flex-shrink-0 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
                            <img
                                src={previewUrl}
                                alt="Logo da escola"
                                className="max-w-full max-h-full object-contain"
                                onError={() => setPreviewUrl(null)}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <ImageIcon className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-700">Logo carregada</span>
                            </div>
                            {extractingColors && (
                                <div className="flex items-center gap-2 text-xs text-violet-600">
                                    <Palette className="h-3 w-3 animate-pulse" />
                                    Extraindo cores da logo...
                                </div>
                            )}
                            <div className="flex gap-2 mt-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs"
                                >
                                    Trocar
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemove}
                                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                                >
                                    <X className="h-3 w-3 mr-1" /> Remover
                                </Button>
                            </div>
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                    <X className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}
        </div>
    );
}

// Helper to extract the storage path from a public URL
function extractStoragePath(url: string): string | null {
    try {
        const match = url.match(/escola-assets\/(.+)/);
        return match?.[1] || null;
    } catch {
        return null;
    }
}

export default LogoUploader;
