// functions/index.js
// ========================================================
// CÉREBRO DO PREENCHIMENTO TURBO (Backend) - PagLucro Gestor
// ========================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
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

// ==========================================================
// [NOVO] MOTOR DE CRM ESCALÁVEL (O Vigia Noturno)
// Responsabilidade: Manter a "Ficha de Ouro" atualizada automaticamente
// ==========================================================

// Função interna de matemática (Idêntica à do Front-end)
const calculateOrderTotal = (orderData) => {
    let totalValue = 0;
    if (!orderData || !orderData.parts) return totalValue;

    orderData.parts.forEach(p => {
        let standardQty = 0;
        if (p.sizes) {
            Object.values(p.sizes).forEach(cat => {
                if (cat) Object.values(cat).forEach(qty => { standardQty += (parseInt(qty) || 0); });
            });
        }
        const specificQty = (p.specifics || []).length;
        const detailedQty = (p.details || []).length;
        
        const priceStd = p.unitPriceStandard !== undefined ? p.unitPriceStandard : (p.unitPrice || 0);
        const priceSpec = p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : (p.unitPrice || 0);
        const priceDet = p.unitPrice || 0;

        totalValue += (standardQty * priceStd) + (specificQty * priceSpec) + (detailedQty * priceDet);
    });
    
    return Math.max(0, totalValue - (parseFloat(orderData.discount) || 0));
};

exports.atualizarFichaDeOuro = onDocumentWritten("companies/{companyId}/orders/{orderId}", async (event) => {
    const { companyId } = event.params;
    
    const orderData = event.data.after.exists ? event.data.after.data() : event.data.before.data();
    if (!orderData) return null;

    const clientKey = orderData.clientPhone ? String(orderData.clientPhone).trim() : String(orderData.clientName).trim();
    if (!clientKey) return null;

    try {
        // Usa o 'db' que já está inicializado no topo deste arquivo de produção
        const ordersRef = db.collection(`companies/${companyId}/orders`);
        
        const snapshotPhone = await ordersRef.where("clientPhone", "==", clientKey).get();
        const snapshotName = await ordersRef.where("clientName", "==", clientKey).get();

        const uniqueOrdersMap = new Map();
        snapshotPhone.forEach(doc => uniqueOrdersMap.set(doc.id, doc.data()));
        snapshotName.forEach(doc => {
            const data = doc.data();
            if (!data.clientPhone || String(data.clientPhone).trim() === clientKey) {
                uniqueOrdersMap.set(doc.id, data);
            }
        });

        const customerHistory = Array.from(uniqueOrdersMap.values());

        let ltv = 0;
        let lastOrderDate = null;

        customerHistory.forEach(order => {
            ltv += calculateOrderTotal(order);
            if (order.deliveryDate) {
                if (!lastOrderDate || new Date(order.deliveryDate) > new Date(lastOrderDate)) {
                    lastOrderDate = order.deliveryDate;
                }
            }
        });

        const totalOrders = customerHistory.length;
        const ticketMedio = totalOrders > 0 ? (ltv / totalOrders) : 0;

        const safeKey = clientKey.replace(/\//g, '-');
        const customerRef = db.doc(`companies/${companyId}/customers/${safeKey}`);
        
        await customerRef.set({
            clientKey: clientKey,
            ltv: ltv,
            totalOrders: totalOrders,
            ticketMedio: ticketMedio,
            lastOrderDate: lastOrderDate,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`[VIGIA NOTURNO] Ficha de Ouro atualizada para: ${clientKey} | LTV: R$ ${ltv.toFixed(2)}`);
        return true;

    } catch (error) {
        console.error(`[ERRO VIGIA NOTURNO] Falha ao atualizar CRM para ${clientKey}:`, error);
        return null;
    }
});
