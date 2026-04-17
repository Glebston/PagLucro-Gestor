// js/services/customerService.js
// ==========================================================
// MÓDULO CUSTOMER SERVICE (CRM - Ficha de Ouro)
// Responsabilidade: Processar métricas financeiras e consultar
// o banco de dados para o Motor CRM Escalável.
// ==========================================================

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebaseConfig.js';

/**
 * Calcula o valor total de um pedido replicando a lógica financeira oficial da fábrica.
 * @param {Object} order - O objeto do pedido bruto
 * @returns {number} - O valor total com descontos aplicados
 */
const calculateOrderTotal = (order) => {
    let totalValue = 0;
    if (!order || !order.parts) return totalValue;

    order.parts.forEach(p => {
        const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
        const specificQty = (p.specifics || []).length;
        const detailedQty = (p.details || []).length;
        
        totalValue += (standardQty * (p.unitPriceStandard ?? p.unitPrice ?? 0)) + 
                      (specificQty * (p.unitPriceSpecific ?? p.unitPrice ?? 0)) + 
                      (detailedQty * (p.unitPrice ?? 0));
    });
    
    return Math.max(0, totalValue - (order.discount || 0));
};

/**
 * Extrai as métricas de ouro de um cliente filtrando o array em memória.
 * @param {string} clientKey - O telefone (prioridade) ou nome do cliente
 * @param {Array} allOrders - O array completo de pedidos carregados no navegador
 * @returns {Object} - Pacote mastigado com LTV, Ticket Médio, Última Compra e Histórico
 */
export const getCustomerMetrics = (clientKey, allOrders) => {
    // Escudo de segurança: Se vier vazio, retorna zerado
    if (!clientKey || !allOrders || allOrders.length === 0) {
        return { ltv: 0, totalOrders: 0, ticketMedio: 0, lastOrderDate: null, history: [] };
    }

    // 1. O Motor de Busca: Filtrar usando a Chave Mestra
    const customerHistory = allOrders.filter(order => {
        const orderPhone = order.clientPhone ? String(order.clientPhone).trim() : null;
        const orderName = order.clientName ? String(order.clientName).trim() : null;
        const searchKey = String(clientKey).trim();
        
        // Verifica se bate com o telefone OU com o nome exato (Fallback)
        return (orderPhone && orderPhone === searchKey) || (!orderPhone && orderName === searchKey);
    });

    // 2. Ordenação Cronológica: Do mais recente para o mais antigo (baseado na data de entrega)
    customerHistory.sort((a, b) => {
        const dateA = a.deliveryDate || '0000-01-01';
        const dateB = b.deliveryDate || '0000-01-01';
        return dateB.localeCompare(dateA);
    });

    // 3. Processamento Financeiro (LTV e Ticket Médio)
    let ltv = 0;
    
    customerHistory.forEach(order => {
        const total = calculateOrderTotal(order);
        ltv += total;
        // Injetamos o total calculado dentro do objeto do pedido temporariamente
        // Isso vai economizar processamento na hora de desenhar as linhas no modal
        order._calculatedTotal = total; 
    });

    const totalOrders = customerHistory.length;
    const ticketMedio = totalOrders > 0 ? (ltv / totalOrders) : 0;
    
    // Pega a data de entrega do pedido mais recente (índice 0, pois já ordenamos)
    const lastOrderDate = totalOrders > 0 ? (customerHistory[0].deliveryDate || null) : null;

    return {
        ltv,
        totalOrders,
        ticketMedio,
        lastOrderDate,
        history: customerHistory
    };
};

// ==========================================================
// [NOVO] CONEXÕES COM O FIREBASE (Migração Formiguinha)
// ==========================================================

/**
 * Busca a gaveta do cliente no banco de dados.
 */
export const getCustomerProfile = async (companyId, clientKey) => {
    if (!companyId || !clientKey) return null;
    
    // Limpa a chave para ser um ID válido no Firebase (remove espaços extras)
    const safeKey = String(clientKey).trim().replace(/\//g, '-');
    
    try {
        const customerRef = doc(db, `companies/${companyId}/customers/${safeKey}`);
        const snap = await getDoc(customerRef);
        
        if (snap.exists()) {
            return snap.data();
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar cliente no banco:", error);
        return null;
    }
};

/**
 * Cria a gaveta do cliente no banco de dados com as métricas calculadas.
 * Salva apenas os números de Ouro (LTV, Ticket) e não o array pesado de histórico.
 */
export const saveCustomerProfile = async (companyId, clientKey, metricsData) => {
    if (!companyId || !clientKey || !metricsData) return;

    const safeKey = String(clientKey).trim().replace(/\//g, '-');
    
    try {
        const customerRef = doc(db, `companies/${companyId}/customers/${safeKey}`);
        
        const payload = {
            clientKey: clientKey,
            ltv: metricsData.ltv || 0,
            totalOrders: metricsData.totalOrders || 0,
            ticketMedio: metricsData.ticketMedio || 0,
            lastOrderDate: metricsData.lastOrderDate || null,
            updatedAt: new Date().toISOString()
        };

        // O merge: true garante que se já existir algo lá, não será apagado
        await setDoc(customerRef, payload, { merge: true });
        console.log(`[CRM] Gaveta criada/atualizada silenciosamente para: ${clientKey}`);
    } catch (error) {
        console.error("Erro ao salvar cliente no banco:", error);
    }
};
