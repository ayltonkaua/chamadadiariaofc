import { dataProvider } from "@refinedev/supabase";
import { supabase } from "@/integrations/supabase/client";

// Por enquanto, usamos o provider oficial do Supabase.
// Na próxima etapa, substituiremos isso pela lógica do RxDB (Offline).
export const databaseProvider = dataProvider(supabase);
