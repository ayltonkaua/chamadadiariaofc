"""
Whisper Transcription Service
Serviço leve de transcrição de áudio usando faster-whisper.
Roda na porta 8787, acessível apenas localhost (atrás do bot Node.js).

Modelo: base (int8) — ~1GB RAM, boa acurácia para PT-BR.
"""

import os
import tempfile
import time
from fastapi import FastAPI, UploadFile, File, HTTPException
from faster_whisper import WhisperModel

app = FastAPI(title="Whisper Transcription Service", version="1.0.0")

# Configuração via variáveis de ambiente
MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
MAX_DURATION_SECONDS = int(os.getenv("WHISPER_MAX_DURATION", "120"))  # 2 min

# Carregar modelo na inicialização (download automático ~150MB na primeira vez)
print(f"🔊 Carregando modelo faster-whisper '{MODEL_SIZE}' ({COMPUTE_TYPE})...")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
print(f"✅ Modelo '{MODEL_SIZE}' carregado com sucesso!")


@app.get("/health")
def health():
    return {
        "status": "online",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "max_duration_seconds": MAX_DURATION_SECONDS,
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Recebe um arquivo de áudio (OGG, MP3, WAV, etc.) e retorna o texto transcrito.
    O ffmpeg é usado internamente pelo faster-whisper para decodificar.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado")

    # Salvar em arquivo temporário (faster-whisper precisa de path ou file-like)
    suffix = os.path.splitext(file.filename)[1] or ".ogg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        content = await file.read()
        tmp.write(content)
        tmp.flush()
        tmp.close()

        start_time = time.time()

        # Transcrever com beam_size=1 para velocidade máxima em CPU
        segments, info = model.transcribe(
            tmp.name,
            beam_size=1,
            language="pt",
            vad_filter=True,  # Filtra silêncio para melhor performance
            vad_parameters=dict(min_silence_duration_ms=500),
        )

        # Verificar duração
        if info.duration and info.duration > MAX_DURATION_SECONDS:
            raise HTTPException(
                status_code=413,
                detail=f"Áudio muito longo ({info.duration:.0f}s). Máximo: {MAX_DURATION_SECONDS}s",
            )

        # Concatenar todos os segmentos
        text = " ".join(segment.text.strip() for segment in segments)
        elapsed = time.time() - start_time

        print(
            f"🎤 Transcrito: {info.duration:.1f}s áudio → {len(text)} chars em {elapsed:.1f}s"
        )

        return {
            "text": text,
            "language": info.language,
            "duration": round(info.duration, 1) if info.duration else 0,
            "processing_time": round(elapsed, 1),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro na transcrição: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na transcrição: {str(e)}")
    finally:
        # Limpar arquivo temporário
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
