// js/services/settingsService.js
// ==========================================================
// MÓDULO DE CONFIGURAÇÕES (v1.2.0 - RBAC & SaaS Routing)
// Responsabilidade: Salvar/Buscar configs (Pix, Zap), Equipe e Etapas (SaaS)
// ==========================================================

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebaseConfig.js';

/**
 * Busca as configurações salvas, dados da equipe e etapas do Kanban.
 * @param {string} companyId - ID da empresa logada.
 * @returns {Object|null} - Objeto unificado para a Interface usar.
 */
export const getCompanySettings = async (companyId) => {
    if (!companyId) return null;
    
    try {
        const configRef = doc(db, `companies/${companyId}/config/payment`); 
        const rootRef = doc(db, `companies/${companyId}`); 

        const [configSnap, rootSnap] = await Promise.all([
            getDoc(configRef),
            getDoc(rootRef)
        ]);
        
        let data = {};
        
        // 1. Puxa Pix, Logo, Zap da subcoleção...
        if (configSnap.exists()) {
            data = { ...configSnap.data() };
        }
        
        // 2. Puxa dados da Raiz (Equipe e Etapas de Produção SaaS)
        if (rootSnap.exists()) {
            const rootData = rootSnap.data();
            if (rootData.team) data.team = rootData.team; 
            if (rootData.etapas_producao) data.etapas_producao = rootData.etapas_producao; 
        }
        
        return Object.keys(data).length > 0 ? data : null;
    } catch (error) {
        console.error("Erro ao buscar configurações:", error);
        throw error;
    }
};

/**
 * Salva as configurações atuando como um roteador de dados seguro.
 * @param {string} companyId - ID da empresa logada.
 * @param {Object} settingsData - Dados do formulário unificado.
 */
export const saveCompanySettings = async (companyId, settingsData) => {
    if (!companyId) throw new Error("ID da empresa inválido");

    try {
        // [A MÁGICA EVOLUÍDA]: Extrai o 'team' E 'etapas_producao' do resto dos dados
        const { team, etapas_producao, ...paymentConfig } = settingsData;

        const configRef = doc(db, `companies/${companyId}/config/payment`);
        const rootRef = doc(db, `companies/${companyId}`);

        const promises = [
            setDoc(configRef, paymentConfig, { merge: true }) 
        ];

        // Monta um pacote apenas com os dados que devem ir para a RAIZ
        let rootUpdates = {};
        if (team !== undefined) rootUpdates.team = team;
        if (etapas_producao !== undefined) rootUpdates.etapas_producao = etapas_producao;

        // Se houver algo para a raiz, faz o despacho seguindo as firestore.rules
        if (Object.keys(rootUpdates).length > 0) {
            promises.push(setDoc(rootRef, rootUpdates, { merge: true }));
        }

        await Promise.all(promises);
        return true;
    } catch (error) {
        console.error("Erro ao salvar configurações:", error);
        throw error;
    }
};
