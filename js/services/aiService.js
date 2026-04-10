// js/services/aiService.js
// ========================================================
// MÓDULO PREMIUM: SERVIÇO DE COMUNICAÇÃO COM A IA (O Mensageiro)
// ========================================================

/**
 * Envia o texto bruto para a Cloud Function segura no backend.
 * Atualizado para se conectar com a nova infraestrutura 'preenchimentoTurbo'.
 * @param {string} rawText - O texto copiado do WhatsApp pelo cliente.
 * @returns {Promise<Object>} - O JSON estruturado com os dados lidos pela IA.
 */
export async function processTextWithAI(rawText) {
    try {
        // 1. A URL exata da sua nova função de produção (usando o ID do seu projeto do log)
        const functionUrl = 'https://us-central1-saas-57e0d.cloudfunctions.net/preenchimentoTurbo';

        // 2. Monta a carga (payload) exatamente como testamos no terminal e a IA exige
        const payload = {
            prompt: rawText,
            configDocumentPath: "admin_settings/ai_config"
        };

        // 3. Faz a requisição padrão com o CORS já liberado pelo backend
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // 4. Verifica se o servidor retornou algum erro
        if (!response.ok) {
            throw new Error(`Erro na nuvem: Status ${response.status}`);
        }

        // 5. Converte a resposta e entrega o JSON para a sua interface
        const data = await response.json();
        return data;

    } catch (error) {
        console.error("🔥 Erro na ponte segura com a Cloud Function:", error);
        // Lança o erro para que o aiListeners.js possa desativar o loading e avisar o usuário
        throw error;
    }
}
