/**
 * Perfil Aluno Service
 * 
 * Service dedicado para operações do perfil completo do aluno.
 * Segue a arquitetura de domínios existente, sem queries diretas nas páginas.
 * 
 * NOTA: Algumas tabelas (notas, observacoes_alunos, transferencias_alunos, 
 * registros_contato_busca_ativa) existem no banco mas não estão no arquivo types.ts.
 * Usamos casting para contornar isso.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type {
    PerfilAluno,
    IndicadoresAluno,
    HistoricoPresenca,
    NotaAluno,
    NotasPorDisciplina,
    TransferenciaAluno,
    ObservacaoAluno,
    ContatoBuscaAtiva,
    PerfilCompletoAluno
} from '../types/perfilAluno.types';

const log = logger.child('PerfilAlunoService');

// Helper para queries em tabelas não tipadas
const db = supabase as any;

export const perfilAlunoService = {
    /**
     * Busca dados pessoais do aluno com turma e escola
     */
    async getDadosPessoais(alunoId: string): Promise<PerfilAluno> {
        log.debug('Fetching dados pessoais', { alunoId });

        const { data, error } = await db
            .from('alunos')
            .select(`
        id, nome, matricula, turma_id, escola_id,
        nome_responsavel, telefone_responsavel, endereco, dados_atualizados_em,
        turmas(id, nome),
        escola_configuracao(id, nome)
      `)
            .eq('id', alunoId)
            .single();

        if (error) {
            log.error('Failed to fetch dados pessoais', { error: error.message });
            throw new Error('Erro ao carregar dados do aluno');
        }

        return {
            id: data.id,
            nome: data.nome,
            matricula: data.matricula,
            turmaId: data.turma_id,
            turmaNome: data.turmas?.nome || 'Sem Turma',
            escolaId: data.escola_id || '',
            escolaNome: data.escola_configuracao?.nome || 'Sem Escola',
            nomeResponsavel: data.nome_responsavel || undefined,
            telefoneResponsavel: data.telefone_responsavel || undefined,
            endereco: data.endereco || undefined,
            dadosAtualizadosEm: data.dados_atualizados_em || undefined
        };
    },

    /**
     * Calcula indicadores de frequência do aluno
     * Usa a fórmula correta: (total - faltas_nao_justificadas) / total * 100
     */
    async getIndicadores(alunoId: string): Promise<IndicadoresAluno> {
        log.debug('Calculating indicadores', { alunoId });

        // Buscar todas as presenças do aluno
        const { data: presencas, error } = await db
            .from('presencas')
            .select('data_chamada, presente, falta_justificada')
            .eq('aluno_id', alunoId)
            .order('data_chamada', { ascending: false });

        if (error) {
            log.error('Failed to fetch presencas', { error: error.message });
            throw new Error('Erro ao calcular indicadores');
        }

        const lista = presencas || [];
        const totalChamadas = lista.length;
        const faltasNaoJustificadas = lista.filter((p: any) => !p.presente && !p.falta_justificada).length;
        const faltasJustificadas = lista.filter((p: any) => !p.presente && p.falta_justificada).length;

        // Frequência = (Total - Faltas não justificadas) / Total * 100
        const percentualPresenca = totalChamadas > 0
            ? Math.round(((totalChamadas - faltasNaoJustificadas) / totalChamadas) * 100)
            : 100;

        // Calcular faltas consecutivas (últimas faltas seguidas, mais recentes primeiro)
        let faltasConsecutivas = 0;
        for (const p of lista) {
            if (!p.presente) {
                faltasConsecutivas++;
            } else {
                break; // Parar na primeira presença
            }
        }

        // Determinar situação baseado em regras escolares
        let situacao: 'Regular' | 'Risco' | 'Evasao' = 'Regular';
        if (faltasConsecutivas >= 15 || percentualPresenca < 50) {
            situacao = 'Evasao';
        } else if (faltasConsecutivas >= 5 || percentualPresenca < 75) {
            situacao = 'Risco';
        }

        log.info('Indicadores calculated', { totalChamadas, faltasNaoJustificadas, percentualPresenca, situacao });

        return {
            totalChamadas,
            totalFaltas: faltasNaoJustificadas,
            faltasJustificadas,
            percentualPresenca,
            faltasConsecutivas,
            situacao
        };
    },

    /**
     * Busca perfil completo (dados pessoais + indicadores) em uma chamada
     */
    async getPerfilCompleto(alunoId: string): Promise<PerfilCompletoAluno> {
        const [dadosPessoais, indicadores] = await Promise.all([
            this.getDadosPessoais(alunoId),
            this.getIndicadores(alunoId)
        ]);

        return { dadosPessoais, indicadores };
    },

    /**
     * Busca histórico de presenças com filtro por mês opcional
     */
    async getHistoricoPresenca(alunoId: string, mes?: string): Promise<HistoricoPresenca[]> {
        log.debug('Fetching historico presenca', { alunoId, mes });

        let query = db
            .from('presencas')
            .select('data_chamada, presente, falta_justificada')
            .eq('aluno_id', alunoId)
            .order('data_chamada', { ascending: false });

        if (mes) {
            // Filtrar por mês (formato esperado: 2024-03)
            const [ano, mesNum] = mes.split('-');
            const inicioMes = `${ano}-${mesNum}-01`;
            // Calcular último dia do mês
            const ultimoDia = new Date(parseInt(ano), parseInt(mesNum), 0).getDate();
            const fimMes = `${ano}-${mesNum}-${ultimoDia}`;
            query = query.gte('data_chamada', inicioMes).lte('data_chamada', fimMes);
        }

        const { data, error } = await query;

        if (error) {
            log.error('Failed to fetch historico', { error: error.message });
            throw new Error('Erro ao carregar histórico');
        }

        return (data || []).map((p: any) => ({
            data: p.data_chamada,
            presente: p.presente,
            faltaJustificada: p.falta_justificada
        }));
    },

    /**
     * Busca meses disponíveis com registros de presença
     */
    async getMesesDisponiveis(alunoId: string): Promise<{ value: string; label: string }[]> {
        const { data } = await db
            .from('presencas')
            .select('data_chamada')
            .eq('aluno_id', alunoId)
            .order('data_chamada', { ascending: false });

        const mesesSet = new Set<string>();
        (data || []).forEach((p: any) => {
            const [ano, mes] = p.data_chamada.split('-');
            mesesSet.add(`${ano}-${mes}`);
        });

        const meses = Array.from(mesesSet).map(mesAno => {
            const [ano, mes] = mesAno.split('-');
            const dataObj = new Date(parseInt(ano), parseInt(mes) - 1, 1);
            const label = dataObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            return { value: mesAno, label: label.charAt(0).toUpperCase() + label.slice(1) };
        });

        return meses;
    },

    /**
     * Busca notas do aluno
     */
    async getNotas(alunoId: string): Promise<NotaAluno[]> {
        log.debug('Fetching notas', { alunoId });

        const { data, error } = await db
            .from('notas')
            .select(`
        disciplina_id, semestre, valor, tipo_avaliacao,
        disciplinas(id, nome, cor)
      `)
            .eq('aluno_id', alunoId)
            .order('semestre', { ascending: true });

        if (error) {
            log.error('Failed to fetch notas', { error: error.message });
            throw new Error('Erro ao carregar notas');
        }

        return (data || []).map((n: any) => ({
            disciplinaId: n.disciplina_id,
            disciplinaNome: n.disciplinas?.nome || '',
            disciplinaCor: n.disciplinas?.cor || '#E2E8F0',
            semestre: n.semestre,
            valor: Number(n.valor),
            tipoAvaliacao: n.tipo_avaliacao || 'media'
        }));
    },

    /**
     * Agrupa notas por disciplina para exibição no boletim
     */
    async getBoletim(alunoId: string): Promise<NotasPorDisciplina[]> {
        const notas = await this.getNotas(alunoId);

        // Agrupar por disciplina
        const grouped = new Map<string, NotasPorDisciplina>();

        notas.forEach(nota => {
            if (!grouped.has(nota.disciplinaId)) {
                grouped.set(nota.disciplinaId, {
                    disciplinaId: nota.disciplinaId,
                    disciplinaNome: nota.disciplinaNome,
                    disciplinaCor: nota.disciplinaCor,
                    notas: [],
                    media: 0,
                    situacao: 'Cursando'
                });
            }

            grouped.get(nota.disciplinaId)!.notas.push({
                semestre: nota.semestre,
                valor: nota.valor,
                tipoAvaliacao: nota.tipoAvaliacao
            });
        });

        // Calcular média e situação
        const result = Array.from(grouped.values()).map(disciplina => {
            const valores = disciplina.notas.map(n => n.valor);
            const media = valores.length > 0
                ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10
                : 0;

            // Situação baseada na média (assumindo média mínima de 6)
            let situacao: 'Aprovado' | 'Reprovado' | 'Cursando' = 'Cursando';
            if (disciplina.notas.length >= 3) { // Se tem notas suficientes para avaliar
                situacao = media >= 6 ? 'Aprovado' : 'Reprovado';
            }

            return { ...disciplina, media, situacao };
        });

        return result.sort((a, b) => a.disciplinaNome.localeCompare(b.disciplinaNome));
    },

    /**
     * Busca histórico de transferências
     */
    async getTransferencias(alunoId: string): Promise<TransferenciaAluno[]> {
        log.debug('Fetching transferencias', { alunoId });

        try {
            const { data, error } = await db
                .from('transferencias_alunos')
                .select(`
          id, data_transferencia, motivo,
          turma_origem:turmas!transferencias_alunos_turma_origem_id_fkey(nome),
          turma_destino:turmas!transferencias_alunos_turma_destino_id_fkey(nome)
        `)
                .eq('aluno_id', alunoId)
                .order('data_transferencia', { ascending: false });

            if (error) {
                // Tabela pode não existir ainda - retornar vazio
                log.warn('Transferencias table may not exist', { error: error.message });
                return [];
            }

            return (data || []).map((t: any) => ({
                id: t.id,
                dataTransferencia: t.data_transferencia,
                turmaOrigemNome: t.turma_origem?.nome || '',
                turmaDestinoNome: t.turma_destino?.nome || '',
                motivo: t.motivo || undefined
            }));
        } catch {
            return [];
        }
    },

    /**
     * Transfere aluno para outra turma (mesma escola)
     */
    async transferirAluno(
        alunoId: string,
        novaTurmaId: string,
        motivo?: string
    ): Promise<void> {
        log.info('Transferring student', { alunoId, novaTurmaId });

        // Buscar dados atuais do aluno
        const { data: aluno, error: alunoError } = await db
            .from('alunos')
            .select('turma_id, escola_id')
            .eq('id', alunoId)
            .single();

        if (alunoError || !aluno) {
            throw new Error('Aluno não encontrado');
        }

        const turmaOrigemId = aluno.turma_id;
        const escolaId = aluno.escola_id;

        // Tentar registrar transferência (tabela pode não existir)
        try {
            await db
                .from('transferencias_alunos')
                .insert({
                    aluno_id: alunoId,
                    turma_origem_id: turmaOrigemId,
                    turma_destino_id: novaTurmaId,
                    motivo,
                    escola_id: escolaId
                });
        } catch {
            log.warn('Could not log transfer - table may not exist');
        }

        // Atualizar turma do aluno
        const { error: updateError } = await db
            .from('alunos')
            .update({ turma_id: novaTurmaId })
            .eq('id', alunoId);

        if (updateError) {
            throw new Error('Erro ao transferir aluno');
        }

        log.info('Student transferred successfully', { alunoId, from: turmaOrigemId, to: novaTurmaId });
    },

    /**
     * Busca turmas disponíveis para transferência (mesma escola)
     */
    async getTurmasParaTransferencia(escolaId: string, turmaAtualId: string): Promise<{ id: string; nome: string }[]> {
        const { data, error } = await db
            .from('turmas')
            .select('id, nome')
            .eq('escola_id', escolaId)
            .neq('id', turmaAtualId)
            .order('nome');

        if (error) {
            throw new Error('Erro ao buscar turmas');
        }

        return data || [];
    },

    /**
     * Busca observações pedagógicas
     */
    async getObservacoes(alunoId: string): Promise<ObservacaoAluno[]> {
        log.debug('Fetching observacoes', { alunoId });

        const { data, error } = await db
            .from('observacoes_alunos')
            .select(`
        id, data_observacao, titulo, descricao,
        turmas(nome)
      `)
            .eq('aluno_id', alunoId)
            .order('data_observacao', { ascending: false });

        if (error) {
            log.error('Failed to fetch observacoes', { error: error.message });
            throw new Error('Erro ao carregar observações');
        }

        return (data || []).map((o: any) => ({
            id: o.id,
            dataObservacao: o.data_observacao,
            titulo: o.titulo,
            descricao: o.descricao,
            turmaNome: o.turmas?.nome
        }));
    },

    /**
     * Adiciona nova observação pedagógica
     */
    async addObservacao(
        alunoId: string,
        titulo: string,
        descricao: string,
        escolaId: string,
        turmaId?: string
    ): Promise<void> {
        log.info('Adding observacao', { alunoId, titulo });

        const { error } = await db
            .from('observacoes_alunos')
            .insert({
                aluno_id: alunoId,
                titulo,
                descricao,
                data_observacao: new Date().toISOString().split('T')[0],
                escola_id: escolaId,
                turma_id: turmaId
            });

        if (error) {
            log.error('Failed to add observacao', { error: error.message });
            throw new Error('Erro ao salvar observação');
        }
    },

    /**
     * Busca contatos de busca ativa
     */
    async getContatosBuscaAtiva(alunoId: string): Promise<ContatoBuscaAtiva[]> {
        log.debug('Fetching contatos busca ativa', { alunoId });

        const { data, error } = await db
            .from('registros_contato_busca_ativa')
            .select('*')
            .eq('aluno_id', alunoId)
            .order('data_contato', { ascending: false });

        if (error) {
            log.error('Failed to fetch contatos', { error: error.message });
            throw new Error('Erro ao carregar contatos');
        }

        return (data || []).map((c: any) => ({
            id: c.id,
            dataContato: c.data_contato,
            formaContato: c.forma_contato,
            justificativaFaltas: c.justificativa_faltas,
            monitorResponsavel: c.monitor_responsavel,
            linkArquivo: c.link_arquivo || undefined
        }));
    }
};
