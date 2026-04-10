// js/services/inventoryService.js
// ===================================================================================
// MÓDULO INVENTORY SERVICE (ALMOXARIFADO)
// Status: COMPATÍVEL COM FASE 5 (SPA) E FASE 2 (RBAC CHÃO DE FÁBRICA)
// ===================================================================================

import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, auth } from '../firebaseConfig.js';

// --- Estado do Módulo ---
let dbCollection = null;      
let allItems = [];           
let unsubscribeListener = null; 
let currentCompanyId = null;

// --- Funções Privadas do Firestore ---
const setupFirestoreListener = (granularUpdateCallback, getViewCallback) => {
    if (unsubscribeListener) unsubscribeListener(); 

    const q = query(dbCollection);
    unsubscribeListener = onSnapshot(q, (snapshot) => {
        
        snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            const index = allItems.findIndex(i => i.id === data.id);

            // 1. Atualiza a Memória
            if (change.type === 'added') {
                if (index === -1) allItems.push(data);
            } else if (change.type === 'modified') {
                if (index > -1) allItems[index] = data;
                else allItems.push(data);
            } else if (change.type === 'removed') {
                if (index > -1) allItems.splice(index, 1);
            }
            
            // 2. Notifica a UI (O main.js decide se desenha a Tabela ou o Widget)
            if (granularUpdateCallback) {
                granularUpdateCallback(change.type, data);
            }
        });

    }, (error) => {
        console.error("Erro ao buscar estoque em tempo real:", error);
    });
};

// --- API Pública do Módulo ---

export const initializeInventoryService = (companyId, granularUpdateCallback, getViewCallback) => {
    currentCompanyId = companyId;
    dbCollection = collection(db, `companies/${companyId}/inventory`);
    setupFirestoreListener(granularUpdateCallback, getViewCallback);
};

export const getInventoryItems = () => {
    return [...allItems]; 
};

// Apenas Dono/Admin
export const saveInventoryItem = async (itemData, itemId = null) => {
    if (!currentCompanyId || !dbCollection) throw new Error("Serviço de estoque não inicializado.");
    
    // Força o registro de quem criou/atualizou
    const email = auth.currentUser ? auth.currentUser.email : 'desconhecido';
    const payload = {
        ...itemData,
        updatedAt: new Date().toISOString(),
        updatedBy: email
    };

    if (itemId) {
        await updateDoc(doc(dbCollection, itemId), payload);
        return itemId;
    } else {
        const docRef = await addDoc(dbCollection, payload);
        return docRef.id;
    }
};

// Apenas Dono/Admin
export const deleteInventoryItem = async (id) => {
    if (!id || !dbCollection) return;
    await deleteDoc(doc(dbCollection, id));
};

// ==========================================================
// FUNÇÃO EXCLUSIVA DE PRODUÇÃO (MOVIMENTAÇÃO RÁPIDA)
// ==========================================================
// Esta função respeita a regra blindada:
// affectedKeys().hasOnly(['quantity', 'updatedAt', 'updatedBy'])
export const updateItemQuantity = async (itemId, changeAmount) => {
    if (!itemId || !dbCollection) return;

    try {
        const itemRef = doc(dbCollection, itemId);
        const itemSnap = await getDoc(itemRef);
        
        if (!itemSnap.exists()) throw new Error("Insumo não encontrado.");
        
        const currentData = itemSnap.data();
        let newQuantity = (Number(currentData.quantity) || 0) + changeAmount;
        
        // Impede estoque negativo
        if (newQuantity < 0) newQuantity = 0;

        const email = auth.currentUser ? auth.currentUser.email : 'desconhecido';

        const updatePayload = {
            quantity: newQuantity,
            updatedAt: new Date().toISOString(),
            updatedBy: email
        };

        console.log(`[ESTOQUE] Atualizando ${currentData.name}: ${currentData.quantity} -> ${newQuantity} (por ${email})`);
        await updateDoc(itemRef, updatePayload);
        
    } catch (error) {
        console.error(`[FALHA FIREBASE] Erro ao movimentar estoque:`, error);
        alert("Erro ao atualizar o estoque. Você tem permissão?");
    }
};

export const cleanupInventoryService = () => {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    allItems = [];
    dbCollection = null;
    currentCompanyId = null;
};
