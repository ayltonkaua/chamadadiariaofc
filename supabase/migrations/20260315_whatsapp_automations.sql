-- Add automation toggles to whatsapp_bot_config table

ALTER TABLE whatsapp_bot_config
ADD COLUMN IF NOT EXISTS auto_falta_diaria BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_consecutiva BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_mensal BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS horario_falta_diaria TIME DEFAULT '18:00:00';

-- Set existing records to default values if null
UPDATE whatsapp_bot_config SET auto_falta_diaria = false WHERE auto_falta_diaria IS NULL;
UPDATE whatsapp_bot_config SET auto_consecutiva = false WHERE auto_consecutiva IS NULL;
UPDATE whatsapp_bot_config SET auto_mensal = false WHERE auto_mensal IS NULL;
UPDATE whatsapp_bot_config SET horario_falta_diaria = '18:00:00' WHERE horario_falta_diaria IS NULL;
