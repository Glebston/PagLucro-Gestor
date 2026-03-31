// functions/index.js
// ========================================================
// CÉREBRO DO PREENCHIMENTO TURBO (Backend) - PagLucro Gestor
// ========================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa o App do Administrador para termos acesso ao Banco de Dados (Firestore)
initializeApp();
const db = getFirestore();

/**
 * Função Segura que processa o texto do WhatsApp usando IA.
 * Ela é chamada diretamente pelo seu Front-end via 'httpsCallable'.
 */
exports.parseOrderText = onCall({ region: "us-central1" }, async (request) => {
    
    // 1. Verificação de Segurança: Somente usuários logados podem usar a IA
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Acesso negado. Usuário não autenticado.");
    }

    const rawText = request.data.text;
    if (!rawText) {
        throw new HttpsError("invalid-argument", "Nenhum texto foi fornecido para análise.");
    }

    try {
        // 2. Busca o Prompt Mestre e a Chave da API no seu Firestore
        // (Coleção: admin_settings -> Documento: ai_config)
        const aiConfigDoc = await db.collection("admin_settings").doc("ai_config").get();

        if (!aiConfigDoc.exists) {
            throw new HttpsError("not-found", "Configurações de IA não encontradas no sistema.");
        }

        const { promptMestre, apiKey } = aiConfigDoc.data();

        // 3. Acorda a Inteligência Artificial do Google (Gemini)
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 4. Monta o pacote de instruções final
        const promptFinal = `${promptMestre}\n\nTEXTO PARA ANALISAR:\n"${rawText}"`;

        // 5. Dispara a análise e aguarda a resposta
        const result = await model.generateContent(promptFinal);
        const response = await result.response;
        const responseText = response.text();

        // 6. Limpeza de Segurança (Remove marcações extras que a IA pode enviar)
        const cleanJson = responseText.replace(/```json|```/g, "").trim();

        // Devolve o JSON pronto para o formulário do recepcionista
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("🔥 ERRO NO CÉREBRO DA IA:", error);
        throw new HttpsError("internal", "Ocorreu um erro ao processar o texto. Verifique o log do servidor.");
    }
});