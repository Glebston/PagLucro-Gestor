// js/services/orderService.js
// ===================================================================================
// MÓDULO ORDER SERVICE (v5.29.0 - Com FUNÇÕES EXCLUSIVAS DE PRODUÇÃO CHÃO DE FÁBRICA
// ==================================================================================

import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, auth } from '../firebaseConfig.js';
// Importação da Nova Calculadora Central
import { calculateOrderTotals } from '../financialCalculator.js';

// --- Estado do Módulo ---
let dbCollection = null;      
let allOrders = [];           
let unsubscribeListener = null; 

// --- Funções Privadas do Firestore ---

const setupFirestoreListener = (granularUpdateCallback, getViewCallback) => {
    if (unsubscribeListener) unsubscribeListener(); 

    const q = query(dbCollection);
    unsubscribeListener = onSnapshot(q, (snapshot) => {
        
        snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            const index = allOrders.findIndex(o => o.id === data.id);

            // 1. Atualiza a Memória
            if (change.type === 'added') {
                if (index === -1) allOrders.push(data);
            } else if (change.type === 'modified') {
                if (index > -1) allOrders[index] = data;
                else allOrders.push(data);
            } else if (change.type === 'removed') {
                if (index > -1) allOrders.splice(index, 1);
            }
            
            // 2. Notifica a UI
            if (granularUpdateCallback) {
                granularUpdateCallback(change.type, data, getViewCallback());
            }
        });

    }, (error) => {
        console.error("Erro ao buscar pedidos em tempo real:", error);
    });
};

// --- API Pública do Módulo ---

export const initializeOrderService = (companyId, granularUpdateCallback, getViewCallback) => {
    dbCollection = collection(db, `companies/${companyId}/orders`);
    setupFirestoreListener(granularUpdateCallback, getViewCallback);
};

export const saveOrder = async (orderData, orderId) => {
    if (orderId) {
        await updateDoc(doc(dbCollection, orderId), orderData);
        return orderId;
    } else {
        const docRef = await addDoc(dbCollection, orderData);
        return docRef.id;
    }
};

export const deleteOrder = async (id) => {
    if (!id) return;
    await deleteDoc(doc(dbCollection, id));
};

export const getOrderById = (id) => {
    return allOrders.find(o => o.id === id);
};

export const getAllOrders = () => {
    return [...allOrders]; 
};

export const calculateTotalPendingRevenue = (startDate = null, endDate = null) => {
    if (allOrders.length === 0) return 0;

    // v5.22.0: Estado Absoluto (Ignora Datas)
    const total = allOrders.reduce((acc, order) => {
        const rawStatus = order.orderStatus ? order.orderStatus.trim() : '';
        const status = rawStatus.toLowerCase();
        
        if (status === 'cancelado' || status === 'entregue') return acc;

        // --- MUDANÇA AQUI ---
        // Agora usamos o calculador central. 
        // Como ele retorna um objeto { total, paid, remaining... }, pegamos apenas o .total
        const finance = calculateOrderTotals(order);
        const totalOrder = finance.total; 
        
        const paid = parseFloat(order.downPayment) || 0; 
        const remaining = totalOrder - paid;

        if (remaining > 0.01) {
            return acc + remaining;
        }
        return acc;
    }, 0);

    return total;
};

export const updateOrderDiscountFromFinance = async (orderId, diffValue) => {
    if (!orderId || !dbCollection) return;
    const orderRef = doc(dbCollection, orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return;

    const orderData = orderSnap.data();
    const currentDiscount = parseFloat(orderData.discount) || 0;
    const currentPaid = parseFloat(orderData.downPayment) || 0;

    let updates = {
        downPayment: currentPaid + diffValue
    };

    if (diffValue < 0) {
        const adjustment = Math.abs(diffValue);
        updates.discount = currentDiscount + adjustment;
    } else if (diffValue > 0) {
        let newDiscount = currentDiscount - diffValue;
        if (newDiscount < 0) newDiscount = 0;
        updates.discount = newDiscount;
    }

    await updateDoc(orderRef, updates);
};

export const cleanupOrderService = () => {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    allOrders = [];
    dbCollection = null;
};

// ==========================================================
// FUNÇÕES EXCLUSIVAS DE PRODUÇÃO (CHÃO DE FÁBRICA)
// ==========================================================

export const updateOrderStatusOnly = async (orderId, newStatus) => {
    if (!orderId || !dbCollection) return;
    
    const orderRef = doc(dbCollection, orderId);
    const updatePayload = { orderStatus: newStatus };

    try {
        console.log(`[TENTATIVA] Atualizando pedido ${orderId} para: ${newStatus}`);
        await updateDoc(orderRef, updatePayload);
        console.log(`[SUCESSO] Pedido atualizado no Firestore!`);
    } catch (error) {
        console.error(`[FALHA FIREBASE] O Firestore bloqueou a ação!`);
        console.error(`Código do Erro:`, error.code);
        console.error(`Mensagem:`, error.message);
    }
};

// [FASE 2: EVOLUÇÃO SAAS] Atualização Fracionada com Gatilho Inteligente
export const updateProductionItemStatus = async (orderId, partIndex, newStatus) => {
    console.log(`[MOTOR INICIADO] Pedido: ${orderId} | Index: ${partIndex} | Nova Etapa: ${newStatus}`);

    if (!orderId || partIndex === null) {
        console.error(`[ERRO] Faltam ID do pedido ou Index da peça!`);
        return;
    }

    try {
        // [A CURA DA AMNÉSIA] O Cirurgião descobre a rota sozinho lendo o crachá!
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Usuário deslogado.");

        let companyId = currentUser.uid; 
        
        if (window.USER_ROLE === 'production') {
            const mappingRef = doc(db, "user_mappings", currentUser.uid);
            const mappingSnap = await getDoc(mappingRef);
            if (mappingSnap.exists()) {
                companyId = mappingSnap.data().companyId;
            } else {
                throw new Error("Crachá de produção não encontrado no banco.");
            }
        }

        // [NOVO: A BÚSSOLA SAAS] Busca a configuração da empresa para descobrir qual é a última etapa
        const companyRef = doc(db, `companies/${companyId}`);
        const companySnap = await getDoc(companyRef);
        let lastStage = "Finalizado"; // Fallback de emergência
        if (companySnap.exists() && companySnap.data().etapas_producao) {
            const stages = companySnap.data().etapas_producao;
            if (stages.length > 0) {
                lastStage = stages[stages.length - 1]; // Pega exatamente a última coluna configurada
            }
        }

        // Constrói a rota exata e absoluta do pedido
        const orderRef = doc(db, `companies/${companyId}/orders/${orderId}`);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) throw new Error("Pedido não encontrado no banco.");

        const orderData = orderSnap.data();
        let parts = orderData.parts || [];

        // Atualiza estritamente a peça mexida
        if (parts[partIndex]) {
            parts[partIndex].status_producao = newStatus;
        }

        let updatePayload = { parts: parts };
        
        const currentStatus = orderData.orderStatus || "";
        const preProductionStatuses = ["Pendente", "Em Aberto", "Aguardando Aprovação", "Confirmado", "Alteração Solicitada", "Aprovado pelo Cliente"];
        
        // [GATILHO 1: O MARCO ZERO DA LARGADA]
        if (newStatus !== "Não Iniciado" && preProductionStatuses.includes(currentStatus)) {
            updatePayload.orderStatus = "Em Produção";
            console.log(`[GATILHO INICIAL] A peça saiu do Marco Zero! O pedido passará a ser 'Em Produção'`);
        } else {
            updatePayload.orderStatus = currentStatus;
        }

        // [GATILHO 2: A LINHA DE CHEGADA E REVERSÃO DE EMERGÊNCIA]
        // O algoritmo .every() garante que isso só será "true" se TODAS as peças estiverem na linha de chegada
        const allPartsFinished = parts.every(p => p.status_producao === lastStage);

        if (allPartsFinished && updatePayload.orderStatus !== "Finalizado" && updatePayload.orderStatus !== "Entregue") {
            updatePayload.orderStatus = "Finalizado";
            console.log(`[GATILHO FINAL ATIVADO] Todas as peças cruzaram a linha de chegada ('${lastStage}'). Status mudou para 'Finalizado'!`);
        } else if (!allPartsFinished && currentStatus === "Finalizado") {
            // Se alguém puxar uma peça de volta da última coluna, reverte o status geral
            updatePayload.orderStatus = "Em Produção";
            console.log(`[GATILHO REVERSO ATIVADO] Peça removida da linha de chegada. Status rebaixado para 'Em Produção'.`);
        }

        console.log(`[FIREBASE] Enviando pacote de atualização...`, updatePayload);
        await updateDoc(orderRef, updatePayload);
        console.log(`[SUCESSO] Operação cirúrgica no Firebase concluída com perfeição!`);
        
    } catch (error) {
        console.error(`[FALHA FIREBASE] Erro ao tentar salvar!`);
        console.error(`Código:`, error.code);
        console.error(`Mensagem:`, error.message);
    }
};



