// functions/index.js
// ========================================================
// CÉREBRO DA IA (Preenchimento Turbo) + CRM ESCALÁVEL (Vigia Noturno)
// ========================================================

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const admin = require("firebase-admin");

// Inicializa o App do Administrador para acesso ao Banco de Dados
admin.initializeApp();
const db = admin.firestore(); // Variável global do banco de dados usada pelo CRM

// Define o segredo para a chave API (Usado pela IA)
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// ==========================================================
// 1. PREENCHIMENTO TURBO (Inteligência Artificial - Gemini 2.0 Flash)
// ==========================================================
exports.preenchimentoTurbo = onRequest({ secrets: [geminiApiKey], cors: true }, async (req, res) => {
    try {
        const { prompt, configDocumentPath } = req.body;
        const apiKey = geminiApiKey.value();
        const genAI = new GoogleGenerativeAI(apiKey);

        // Busca o documento completo no Firestore
        const configDoc = await admin.firestore().doc(configDocumentPath).get();
        if (!configDoc.exists) throw new Error("Configuração não encontrada no Firestore.");
        
        // CORREÇÃO 1: Salva os dados do banco em uma variável aiConfig
        const aiConfig = configDoc.data();
        // Puxa as instruções (suporta tanto se você salvou como systemInstruction ou masterPrompt)
        const instrucaoMestre = aiConfig.systemInstruction || aiConfig.masterPrompt;

        // A "Algema" de Segurança: Define a estrutura exata para a IA
        const schemaDasPecas = {
            type: SchemaType.ARRAY,
            description: "Lista de peças. Agrupe tamanhos do mesmo modelo e tecido no mesmo objeto.",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    type: { type: SchemaType.STRING, description: "Modelo (Ex: Camisa)." },
                    material: { type: SchemaType.STRING, description: "Tecido (Ex: Malha Fria)." },
                    partInputType: { type: SchemaType.STRING, description: "'comum' ou 'detalhado'." },
                    sizes: {
                        type: SchemaType.OBJECT,
                        description: "Quantidades por categoria (Modo comum).",
                        properties: {
                            "Normal": { 
                                type: SchemaType.OBJECT,
                                properties: {
                                    "PP": { type: SchemaType.NUMBER }, "P": { type: SchemaType.NUMBER },
                                    "M": { type: SchemaType.NUMBER }, "G": { type: SchemaType.NUMBER },
                                    "GG": { type: SchemaType.NUMBER }, "XG": { type: SchemaType.NUMBER }
                                }
                            },
                            "Baby Look": { 
                                type: SchemaType.OBJECT,
                                properties: {
                                    "PP": { type: SchemaType.NUMBER }, "P": { type: SchemaType.NUMBER },
                                    "M": { type: SchemaType.NUMBER }, "G": { type: SchemaType.NUMBER },
                                    "GG": { type: SchemaType.NUMBER }, "XG": { type: SchemaType.NUMBER }
                                }
                            },
                            "Infantil": { 
                                type: SchemaType.OBJECT,
                                properties: {
                                    "2 anos": { type: SchemaType.NUMBER }, "4 anos": { type: SchemaType.NUMBER },
                                    "6 anos": { type: SchemaType.NUMBER }, "8 anos": { type: SchemaType.NUMBER },
                                    "10 anos": { type: SchemaType.NUMBER }, "12 anos": { type: SchemaType.NUMBER }
                                }
                            }
                        },
                        required: ["Normal", "Baby Look", "Infantil"]
                    },
                    details: {
                        type: SchemaType.ARRAY,
                        description: "Nomes e números (Modo detalhado).",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                name: { type: SchemaType.STRING },
                                number: { type: SchemaType.STRING },
                                size: { type: SchemaType.STRING, description: "Ex: 'M (Normal)'" }
                            },
                            required: ["name", "number", "size"]
                        }
                    }
                },
                required: ["type", "material", "partInputType", "sizes", "details"]
            }
        };

        // Busca o nome do modelo direto do Firestore (dinâmico)
        const modelName = aiConfig.aiModel || "gemini-2.0-flash"; 

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: instrucaoMestre, // CORREÇÃO 3: Agora a IA recebe as regras!
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schemaDasPecas, // CORREÇÃO 2: Nome corrigido para schemaDasPecas
            },
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        res.status(200).json(JSON.parse(responseText));

    } catch (error) {
        console.error("Erro na Function:", error);
        res.status(500).send(error.message);
    }
});

// ==========================================================
// 2. MOTOR DE CRM ESCALÁVEL (O Vigia Noturno)
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
        // Usa o 'db' global inicializado no topo do arquivo (compatível com admin.firestore())
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
