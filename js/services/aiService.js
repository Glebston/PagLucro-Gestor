// js/services/aiService.js
// ========================================================
// MÓDULO PREMIUM: SERVIÇO DE COMUNICAÇÃO COM A IA (O Mensageiro)
// ========================================================

import { auth } from '../firebaseConfig.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

/**
 * Envia o texto bruto para a Cloud Function segura no backend.
 * O Firebase cuida de anexar o Token JWT do usuário para garantir a segurança.
 * * @param {string} rawText - O texto copiado do WhatsApp pelo cliente.
 * @returns {Promise<Object>} - O JSON estruturado com os dados lidos pela IA.
 */
export async function processTextWithAI(rawText) {
    // Captura a instância principal do Firebase App através da autenticação
    const functions = getFunctions(auth.app); 

    try {
        // Cria a "ponte de conexão" apontando para o nome exato da função que criaremos na nuvem
        const parseOrderTextCallable = httpsCallable(functions, 'parseOrderText');

        // Dispara a requisição de forma segura
        const result = await parseOrderTextCallable({ text: rawText });

        // O retorno do nosso backend sempre ficará encapsulado dentro do objeto 'data'
        return result.data;

    } catch (error) {
        console.error("🔥 Erro na ponte segura com a Cloud Function:", error);
        // Lança o erro para que o aiListeners.js possa desativar o loading e avisar o usuário
        throw error;
    }
}
