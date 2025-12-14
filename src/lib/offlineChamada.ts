/**
 * Offline Chamada Storage
 * 
 * Handles offline data storage with AES-256 encryption for LGPD compliance.
 * Protects sensitive student data (names, matriculas) stored in IndexedDB.
 */

import { set, get, del } from 'idb-keyval';
import { supabase } from "@/integrations/supabase/client";
import { encryptData, decryptData, isEncrypted } from './encryption';

const CHAMADA_KEY = 'chamadas_pendentes';
const CHAMADA_SESSION_KEY = 'chamada_session';
const CACHE_ESCOLA_KEY = 'cache_dados_escola';
const CACHE_USER_KEY = 'cache_user_id';
const CACHE_VERSION = '2.1.0-encrypted'; // Updated version for encrypted cache

export interface ChamadaOffline {
  aluno_id: string;
  turma_id: string;
  escola_id: string;
  presente: boolean;
  falta_justificada: boolean;
  data_chamada: string;
  timestamp: number;
}

export interface ChamadaSession {
  turmaId: string;
  date: string;
  presencas: Record<string, 'presente' | 'falta' | 'atestado' | null>;
  timestamp: number;
}

interface DadosEscolaOffline {
  timestamp: number;
  turmas: any[];
  alunos: any[];
  escola_id: string;
  cache_version?: string;
  user_id?: string;
}

// ==============================================================================
// FUNÇÕES: CACHE DE DADOS (DOWNLOAD PARA OFFLINE) - AGORA CRIPTOGRAFADO
// ==============================================================================

export async function baixarDadosEscola(escolaId: string) {
  try {
    console.log("Iniciando download de dados para offline (criptografado)...");

    // 1. Buscar todas as turmas
    const { data: turmas, error: turmasError } = await supabase
      .from('turmas')
      .select('*')
      .eq('escola_id', escolaId);

    if (turmasError) throw turmasError;

    if (!turmas || turmas.length === 0) {
      return { success: true, turmasCount: 0, alunosCount: 0 };
    }

    // 2. Buscar todos os alunos dessas turmas
    const turmasIds = turmas.map(t => t.id);
    const { data: alunos, error: alunosError } = await supabase
      .from('alunos')
      .select('*')
      .in('turma_id', turmasIds);

    if (alunosError) throw alunosError;

    // 3. Criar pacote de dados
    const pacoteOffline: DadosEscolaOffline = {
      timestamp: Date.now(),
      escola_id: escolaId,
      turmas: turmas || [],
      alunos: alunos || [],
      cache_version: CACHE_VERSION
    };

    // 4. CRIPTOGRAFAR e salvar no IndexedDB
    const encrypted = encryptData(pacoteOffline);
    await set(CACHE_ESCOLA_KEY, encrypted);

    console.log(`Dados baixados e criptografados: ${turmas?.length} turmas e ${alunos?.length} alunos.`);
    return { success: true, turmasCount: turmas?.length, alunosCount: alunos?.length };

  } catch (error) {
    console.error("Erro ao baixar dados para offline:", error);
    return { success: false, error };
  }
}

export async function getDadosEscolaOffline(userId?: string): Promise<DadosEscolaOffline | null> {
  try {
    const raw = await get<string | DadosEscolaOffline>(CACHE_ESCOLA_KEY);

    if (!raw) return null;

    // Decrypt if encrypted
    let dados: DadosEscolaOffline | null;

    if (isEncrypted(raw)) {
      dados = decryptData<DadosEscolaOffline>(raw as string);
      if (!dados) {
        console.warn("Falha ao descriptografar cache. Limpando...");
        await del(CACHE_ESCOLA_KEY);
        return null;
      }
    } else {
      // Legacy plain text data - migrate to encrypted
      dados = raw as DadosEscolaOffline;
      console.log("Migrando cache antigo para formato criptografado...");
      const encrypted = encryptData(dados);
      await set(CACHE_ESCOLA_KEY, encrypted);
    }

    // Validação de versão: se o cache não tem versão ou versão antiga, invalida
    if (!dados.cache_version || !dados.cache_version.includes('encrypted')) {
      console.warn("Cache com versão antiga detectado. Limpando cache...");
      await del(CACHE_ESCOLA_KEY);
      return null;
    }

    // Validação de segurança: se userId fornecido, verifica se o cache pertence ao usuário
    if (userId) {
      const cachedUserId = await get<string>(CACHE_USER_KEY);
      if (cachedUserId && cachedUserId !== userId) {
        console.warn("Cache pertence a outro usuário. Limpando cache...");
        await del(CACHE_ESCOLA_KEY);
        await del(CACHE_USER_KEY);
        return null;
      }
    }

    return dados;
  } catch (error) {
    console.error("Erro ao ler cache offline:", error);
    return null;
  }
}

export async function getAlunosDaTurmaOffline(turmaId: string, userId?: string) {
  const dados = await getDadosEscolaOffline(userId);
  if (!dados) return [];
  return dados.alunos.filter(a => a.turma_id === turmaId);
}

// ==============================================================================
// FUNÇÃO HÍBRIDA (NETWORK FIRST)
// ==============================================================================
export async function buscarTurmasHibrido(escolaId: string, userId?: string) {
  // 1. NETWORK FIRST: Se estiver online, FORÇA busca no Supabase
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('turmas')
        .select('*, escola_id')
        .eq('escola_id', escolaId);

      if (!error && data) {
        // Salva o user_id no cache para validação futura
        if (userId) {
          await set(CACHE_USER_KEY, userId);
        }
        // Atualiza cache em background (agora criptografado)
        baixarDadosEscola(escolaId).then(() => console.log("Cache atualizado em background"));
        return { data, fonte: 'online' };
      }

      if (error) throw error;
    } catch (err) {
      console.warn("Falha ao buscar online, tentando cache...", err);
    }
  }

  // 2. FALLBACK: Cache offline
  console.log("Buscando turmas do cache offline...");
  const dadosOffline = await getDadosEscolaOffline(userId);

  if (dadosOffline && dadosOffline.turmas) {
    return { data: dadosOffline.turmas, fonte: 'offline' };
  }

  return { data: [], fonte: 'vazio' };
}

// ==============================================================================
// FUNÇÕES: REGISTRO DE CHAMADA E SESSÃO - AGORA CRIPTOGRAFADO
// ==============================================================================

export async function salvarChamadaOffline(chamadas: Omit<ChamadaOffline, 'timestamp'>[]) {
  try {
    const raw = await get<string | ChamadaOffline[]>(CHAMADA_KEY);

    let pendentes: ChamadaOffline[];
    if (typeof raw === 'string' && isEncrypted(raw)) {
      pendentes = decryptData<ChamadaOffline[]>(raw) || [];
    } else {
      pendentes = (raw as ChamadaOffline[]) || [];
    }

    const novasChamadas = chamadas.map(chamada => ({
      ...chamada,
      timestamp: Date.now()
    }));

    pendentes.push(...novasChamadas);

    // Salvar criptografado
    const encrypted = encryptData(pendentes);
    await set(CHAMADA_KEY, encrypted);
    return true;
  } catch (error) {
    console.error('Erro ao salvar chamada offline:', error);
    return false;
  }
}

export async function getChamadasPendentes(): Promise<ChamadaOffline[]> {
  try {
    const raw = await get<string | ChamadaOffline[]>(CHAMADA_KEY);

    if (!raw) return [];

    if (typeof raw === 'string' && isEncrypted(raw)) {
      return decryptData<ChamadaOffline[]>(raw) || [];
    }

    // Legacy format
    return raw as ChamadaOffline[];
  } catch (error) {
    console.error('Erro ao buscar chamadas pendentes:', error);
    return [];
  }
}

export async function limparChamadasPendentes() {
  try {
    await set(CHAMADA_KEY, encryptData([]));
    return true;
  } catch (error) {
    console.error('Erro ao limpar chamadas pendentes:', error);
    return false;
  }
}

export async function removerChamadaPendente(timestamp: number) {
  try {
    const pendentes = await getChamadasPendentes();
    const filtradas = pendentes.filter(chamada => chamada.timestamp !== timestamp);
    await set(CHAMADA_KEY, encryptData(filtradas));
    return true;
  } catch (error) {
    console.error('Erro ao remover chamada pendente:', error);
    return false;
  }
}

export async function salvarSessaoChamada(session: Omit<ChamadaSession, 'timestamp'>) {
  try {
    const sessionData: ChamadaSession = {
      ...session,
      timestamp: Date.now()
    };
    // Sessão também criptografada
    await set(CHAMADA_SESSION_KEY, encryptData(sessionData));
    return true;
  } catch (error) {
    console.error('Erro ao salvar sessão de chamada:', error);
    return false;
  }
}

export async function getSessaoChamada(): Promise<ChamadaSession | null> {
  try {
    const raw = await get<string | ChamadaSession>(CHAMADA_SESSION_KEY);

    if (!raw) return null;

    let session: ChamadaSession | null;

    if (typeof raw === 'string' && isEncrypted(raw)) {
      session = decryptData<ChamadaSession>(raw);
    } else {
      session = raw as ChamadaSession;
    }

    if (!session) return null;

    const agora = Date.now();
    const vinteQuatroHoras = 24 * 60 * 60 * 1000;

    if (agora - session.timestamp > vinteQuatroHoras) {
      await del(CHAMADA_SESSION_KEY);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Erro ao buscar sessão de chamada:', error);
    return null;
  }
}

export async function limparSessaoChamada() {
  try {
    await del(CHAMADA_SESSION_KEY);
    return true;
  } catch (error) {
    console.error('Erro ao limpar sessão de chamada:', error);
    return false;
  }
}

// ==============================================================================
// FUNÇÃO: LIMPAR TODOS OS DADOS (PARA LOGOUT)
// ==============================================================================
export async function limparTodosCachesOffline() {
  try {
    await del(CACHE_ESCOLA_KEY);
    await del(CACHE_USER_KEY);
    await del(CHAMADA_KEY);
    await del(CHAMADA_SESSION_KEY);
    console.log('Todos os caches offline foram limpos.');
    return true;
  } catch (error) {
    console.error('Erro ao limpar caches offline:', error);
    return false;
  }
}

// ==============================================================================
// FUNÇÃO DE SINCRONIZAÇÃO
// ==============================================================================

export async function sincronizarChamadasOffline(onProgress?: (current: number, total: number) => void) {
  try {
    const pendentes = await getChamadasPendentes();
    if (pendentes.length === 0) return { success: true, count: 0 };

    console.log(`Iniciando sincronização de ${pendentes.length} registros...`);

    let successCount = 0;
    const total = pendentes.length;

    for (let i = 0; i < total; i++) {
      const p = pendentes[i];

      if (onProgress) onProgress(i + 1, total);

      const payload = {
        aluno_id: p.aluno_id,
        turma_id: p.turma_id,
        escola_id: p.escola_id,
        data_chamada: p.data_chamada,
        presente: p.presente,
        falta_justificada: p.falta_justificada ?? false
      };

      const { error } = await supabase
        .from('presencas')
        .upsert(payload, {
          onConflict: 'escola_id, aluno_id, data_chamada',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`Erro ao sincronizar item ${i + 1}:`, error);
      } else {
        successCount++;
      }
    }

    if (successCount === total) {
      await limparChamadasPendentes();
      console.log('Sincronização concluída com sucesso!');
      return { success: true, count: total };
    } else {
      console.warn(`Sincronização parcial: ${successCount} de ${total}`);
      return { success: false, count: successCount, error: 'Alguns itens falharam.' };
    }

  } catch (error: any) {
    console.error('Erro ao sincronizar chamadas offline:', error);
    return { success: false, error };
  }
}