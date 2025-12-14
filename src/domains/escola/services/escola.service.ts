/**
 * Escola Service
 * 
 * Business logic for school configuration management.
 */

import { escolaConfigAdapter, logger, NotFoundError, ValidationError } from '@/core';
import type { EscolaConfig, EscolaConfigUpdate, EscolaTema } from '../types/escola.types';

const log = logger.child('EscolaService');

/**
 * Service for managing school configuration
 */
export const escolaService = {
    /**
     * Gets school config by ID
     */
    async getById(id: string): Promise<EscolaConfig> {
        log.debug('Getting escola config', { id });

        const config = await escolaConfigAdapter.findOne({
            eq: { id } as Partial<EscolaConfig>
        });

        if (!config) {
            throw new NotFoundError('Escola', id);
        }

        return config;
    },

    /**
     * Gets theme data for a school
     */
    async getTema(id: string): Promise<EscolaTema> {
        const config = await this.getById(id);

        return {
            nome: config.nome,
            corPrimaria: config.cor_primaria || '#6D28D9',
            corSecundaria: config.cor_secundaria || '#2563EB',
            urlLogo: config.url_logo
        };
    },

    /**
     * Updates school configuration
     */
    async update(id: string, data: EscolaConfigUpdate): Promise<EscolaConfig> {
        log.info('Updating escola config', { id });

        const updated = await escolaConfigAdapter.update(
            { eq: { id } as Partial<EscolaConfig> },
            data
        );

        if (updated.length === 0) {
            throw new NotFoundError('Escola', id);
        }

        return updated[0];
    },

    /**
     * Checks if a school exists
     */
    async exists(id: string): Promise<boolean> {
        const config = await escolaConfigAdapter.findOne({
            eq: { id } as Partial<EscolaConfig>
        });
        return config !== null;
    }
};
