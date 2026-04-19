-- Migration: Adicionar campos para controle de "Hoje tem aula?" no bot
ALTER TABLE whatsapp_bot_config 
  ADD COLUMN IF NOT EXISTS tem_aula_hoje BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS motivo_sem_aula TEXT DEFAULT '';
