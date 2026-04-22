// functions/index.js
// ========================================================
// CÉREBRO DA IA (Preenchimento Turbo) + CRM ESCALÁVEL (Vigia Noturno)
// ========================================================

const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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

// ==========================================================
// [NOVO] PLANO DE CONTINGÊNCIA - ROBÔ NOTURNO DE BACKUPS
// Responsabilidade: Realizar backup diário e registrar o status para o Painel Admin
// ==========================================================

// Função interna que faz o trabalho pesado do backup para uma empresa específica
const executarBackupEmpresa = async (companyId, db, bucket) => {
    try {
        const colecoes = ["orders", "customers", "catalog", "settings"];
        const backupData = {};

        // Extrai os dados de cada coleção
        for (const col of colecoes) {
            const snapshot = await db.collection(`companies/${companyId}/${col}`).get();
            backupData[col] = {};
            snapshot.forEach(doc => {
                backupData[col][doc.id] = doc.data();
            });
        }

        // Monta o arquivo JSON
        const dataAtual = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const fileName = `backups/${companyId}/backup_${dataAtual}.json`;
        const file = bucket.file(fileName);
        
        await file.save(JSON.stringify(backupData), {
            contentType: "application/json",
        });

        // Registra o SUCESSO para o Super Admin ver
        await db.doc(`admin_data/backups/logs/${companyId}`).set({
            status: "sucesso",
            lastBackup: new Date().toISOString(),
            message: `Backup de ${dataAtual} concluído.`,
            fileName: fileName
        });

        return { sucesso: true, message: "Backup realizado com sucesso." };

    } catch (error) {
        console.error(`[ERRO DE BACKUP] Empresa ${companyId}:`, error);
        
        // Registra a FALHA para o Super Admin ver
        await db.doc(`admin_data/backups/logs/${companyId}`).set({
            status: "falha",
            lastBackup: new Date().toISOString(),
            message: `Erro: ${error.message}`
        });

        return { sucesso: false, message: error.message };
    }
};

// 1. O Agendador Automático (Roda todo dia às 03:00 da manhã)
exports.roboNoturnoBackup = onSchedule({
    schedule: "0 3 * * *",
    timeZone: "America/Sao_Paulo",
    memory: "512MiB"
}, async (event) => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    let sucessos = 0;
    let falhas = 0;

    console.log("[ROBÔ NOTURNO] Iniciando varredura de backups...");

    try {
        // Busca todas as empresas ativas
        const companiesSnapshot = await db.collection("companies").get();
        
        for (const doc of companiesSnapshot.docs) {
            const companyId = doc.id;
            const resultado = await executarBackupEmpresa(companyId, db, bucket);
            if (resultado.sucesso) sucessos++;
            else falhas++;
        }

        // Log geral para o topo do seu painel Admin
        const dataAtual = new Date().toISOString().split('T')[0];
        await db.doc(`admin_data/backups/relatorios_diarios/${dataAtual}`).set({
            data: dataAtual,
            totalEmpresas: companiesSnapshot.size,
            sucessos: sucessos,
            falhas: falhas,
            executadoEm: new Date().toISOString()
        });

        // Notificação Ativa (Alerta se houver falhas)
        if (falhas > 0) {
            console.error(`[ALERTA ADMIN] O Robô Noturno finalizou com ${falhas} falhas! Verifique o painel.`);
        } else {
            console.log(`[ROBÔ NOTURNO] Missão cumprida. ${sucessos} empresas salvas.`);
        }

    } catch (error) {
        console.error("[ERRO FATAL] O Robô Noturno falhou ao iniciar:", error);
    }
});

// 2. O Botão de Pânico (Acionado manualmente pelo seu Super Painel)
exports.forcarBackupManual = onCall({ cors: true }, async (request) => {
    // Segurança: Garantir que quem está chamando está logado
    if (!request.auth) {
        throw new Error("Acesso negado. Usuário não autenticado.");
    }

    const { companyId } = request.data;
    if (!companyId) {
        throw new Error("ID da empresa não fornecido.");
    }

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    console.log(`[ADMIN FORCE] Iniciando backup manual para: ${companyId}`);
    const resultado = await executarBackupEmpresa(companyId, db, bucket);

    return resultado; // Retorna para o frontend (admin.js) se deu certo ou falhou
});

// ==========================================================
// [NOVO] FLUXO DE CADASTRO UNIFICADO (Super Admin)
// Responsabilidade: Criar o usuário no Auth e o perfil no Firestore em uma única transação
// ==========================================================
exports.criarNovaEmpresaAdmin = onCall({ cors: true }, async (request) => {
    // 1. Trava de Segurança Mestra: Apenas os e-mails oficiais da administração podem acionar isso
    const adminEmails = ["admin@paglucro.com", "saianolucrobr@gmail.com"];
    
    if (!request.auth || !adminEmails.includes(request.auth.token.email)) {
        throw new Error("Acesso negado. Apenas administradores supremos podem criar novas empresas.");
    }

    const { email, companyName, planId, priceValue, uidManuallyProvided } = request.data;

    if (!email || !companyName) {
        throw new Error("Dados incompletos. E-mail e Nome da Empresa são obrigatórios.");
    }

    try {
        const db = admin.firestore();
        
        // 2. Criação do Usuário no Firebase Auth
        // Geramos uma senha temporária padrão que o cliente usará no primeiro acesso
        const passwordTemporaria = "Mudar123!";
        
        const userParams = {
            email: email,
            password: passwordTemporaria,
            displayName: companyName,
        };

        // Se você preencher o UID no painel, ele usa o seu.
        // Se deixar em branco (Recomendado), o Firebase gera um automático, 100% à prova de colisões.
        if (uidManuallyProvided && String(uidManuallyProvided).trim() !== "") {
            userParams.uid = String(uidManuallyProvided).trim();
        }

        // Executa a criação no Auth
        const userRecord = await admin.auth().createUser(userParams);
        const finalUid = userRecord.uid;

        // 3. Transação no Banco de Dados (Firestore)
        const batch = db.batch();

        // Cria a gaveta da empresa
        const companyRef = db.doc(`companies/${finalUid}`);
        batch.set(companyRef, {
            companyName: companyName,
            email: email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isBlocked: false,
            isDeleted: false,
            subscription: {
                planId: (planId || 'essencial').toLowerCase(),
                status: 'active',
                price: parseFloat(priceValue) || 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            bankBalanceConfig: { initialBalance: 0 }
        });

        // Cria o mapeamento para garantir que o dono tenha acesso
        const mappingRef = db.doc(`user_mappings/${finalUid}`);
        batch.set(mappingRef, { 
            companyId: finalUid, 
            email: email,
            role: 'owner' // Define como Gestor Supremo da própria fábrica
        });

        // Comita tudo de uma vez
        await batch.commit();

        console.log(`[ADMIN CREATE] Empresa ${companyName} criada com sucesso. UID: ${finalUid}`);

        return { 
            sucesso: true, 
            uid: finalUid, 
            senhaTemporaria: passwordTemporaria,
            message: "Empresa criada e vinculada com sucesso!" 
        };

    } catch (error) {
        console.error("[ERRO ADMIN CREATE] Falha ao criar empresa:", error);
        
        // Formata a mensagem de erro do Firebase Auth para ficar amigável na sua tela
        if (error.code === 'auth/email-already-exists') {
            throw new Error("Este e-mail já está cadastrado no sistema.");
        }
        if (error.code === 'auth/invalid-email') {
            throw new Error("O formato do e-mail é inválido.");
        }
        
        throw new Error(error.message);
    }
});

// ==========================================================
// [NOVO] MOTOR DE RESTAURAÇÃO (A Ponte de Volta)
// Responsabilidade: Injetar o último backup do Storage de volta no Firestore
// ==========================================================
exports.restaurarBackupEmpresa = onCall({ cors: true, memory: "1GiB" }, async (request) => {
    // Segurança Mestra
    const adminEmails = ["admin@paglucro.com", "saianolucrobr@gmail.com"];
    if (!request.auth || !adminEmails.includes(request.auth.token.email)) {
        throw new Error("Acesso negado. Ação restrita a administradores supremos.");
    }

    const { companyId } = request.data;
    if (!companyId) throw new Error("ID da empresa não fornecido.");

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    console.log(`[ADMIN RESTORE] Iniciando restauração para: ${companyId}`);

    try {
        // 1. Busca os arquivos de backup desta empresa no Storage
        const [files] = await bucket.getFiles({ prefix: `backups/${companyId}/` });
        if (!files || files.length === 0) {
            throw new Error("Nenhum backup encontrado no cofre para esta empresa.");
        }

        // 2. Descobre qual é o arquivo mais recente (ordena pelo nome/data decrescente)
        files.sort((a, b) => b.name.localeCompare(a.name));
        const latestBackupFile = files[0];

        console.log(`[ADMIN RESTORE] Restaurando do arquivo: ${latestBackupFile.name}`);

        // 3. Faz o download e abre o "pacote" JSON
        const [fileContent] = await latestBackupFile.download();
        const backupData = JSON.parse(fileContent.toString('utf-8'));

        // 4. Inicia a injeção dos dados de volta no banco de dados
        let batch = db.batch();
        let operationsCount = 0;
        const colecoes = ["orders", "customers", "catalog", "settings"];

        for (const col of colecoes) {
            if (backupData[col]) {
                for (const [docId, docData] of Object.entries(backupData[col])) {
                    const docRef = db.doc(`companies/${companyId}/${col}/${docId}`);
                    batch.set(docRef, docData); // Sobrescreve o que está corrompido com o dado bom
                    operationsCount++;

                    // O Firebase exige que enviemos de 450 em 450 pacotes
                    if (operationsCount === 450) {
                        await batch.commit();
                        batch = db.batch(); // Inicia um novo lote
                        operationsCount = 0;
                    }
                }
            }
        }

        // Comita os dados que sobraram no último lote
        if (operationsCount > 0) {
            await batch.commit();
        }

        return { 
            sucesso: true, 
            message: `Restauração concluída! Base de dados recuada para a versão do arquivo: ${latestBackupFile.name.split('/').pop()}` 
        };

    } catch (error) {
        console.error(`[ERRO RESTAURAÇÃO FATAL] Empresa ${companyId}:`, error);
        throw new Error(`Falha ao restaurar: ${error.message}`);
    }
});
