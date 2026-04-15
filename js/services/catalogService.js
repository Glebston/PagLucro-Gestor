// js/services/catalogService.js
// ========================================================
// SERVICE DO CATÁLOGO (v2.3 - Refatorado e Centralizado)
// =========================================================

import { db, auth } from "../firebaseConfig.js";
import { 
    collection, addDoc, getDocs, doc, deleteDoc, updateDoc, 
    query, where, getCountFromServer, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// [REFATORAÇÃO] Importando do serviço central de imagens NATIVO (mesma pasta)
import { uploadImageToStorage } from './imageService.js';

// --- [ALTERAÇÃO] Adicionado 'export' para usar no Listeners ---
export async function getRealCompanyId() {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado.");

    try {
        const mappingRef = doc(db, "user_mappings", user.uid);
        const mappingSnap = await getDoc(mappingRef);

        if (mappingSnap.exists() && mappingSnap.data().companyId) {
            return mappingSnap.data().companyId; 
        }
    } catch (error) {
        console.warn("Fallback ID:", error);
    }
    return user.uid;
}

// --- 1. UPLOAD DE IMAGEM (Delegado para imageService NATIVO) ---
export async function uploadCatalogImage(file) {
    try {
        // Envia o arquivo físico (File Object) diretamente para o cofre do Firebase
        const url = await uploadImageToStorage(file);
        
        if (!url) throw new Error("O Storage do Google não retornou uma URL válida.");
        
        return url;
    } catch (error) {
        throw new Error("Erro no upload do catálogo: " + error.message);
    }
}

// --- 2. ADICIONAR PRODUTO (Create) ---
export async function addCatalogItem(itemData) {
    const companyId = await getRealCompanyId(); 
    
    // Regra dos 30: Verificar limite
    const collRef = collection(db, "companies", companyId, "catalog_items");
    const snapshot = await getCountFromServer(collRef);
    const count = snapshot.data().count;

    if (count >= 30) {
        throw new Error("Limite de Armazenamento Atingido (30 itens). Exclua um item antigo.");
    }

    // Salvar
    const docRef = await addDoc(collRef, {
        title: itemData.title,
        description: itemData.description || "",
        price: itemData.price || "",
        category: itemData.category || "Geral",
        imageUrl: itemData.imageUrl,
        isActive: false, // Nasce inativo por segurança
        createdAt: serverTimestamp()
    });
    
    return docRef.id;
}

// --- 3. LISTAR PRODUTOS (Read) ---
export async function getCatalogItems() {
    const companyId = await getRealCompanyId(); 
    const collRef = collection(db, "companies", companyId, "catalog_items");
    
    // Busca todos (Ativos e Inativos) para o painel Admin
    const q = query(collRef); 
    const snapshot = await getDocs(q);
    
    // Preparando retorno compatível com o formato antigo (items + counts)
    const items = [];
    let activeCount = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.isActive) activeCount++;
        items.push({ id: doc.id, ...data });
    });
    
    return {
        items: items,
        totalCount: items.length,
        activeCount: activeCount
    };
}

// --- 4. ALTERAR STATUS (Update) ---
export async function toggleItemStatus(itemId, newStatus) {
    const companyId = await getRealCompanyId(); 
    
    // Regra dos 20: Se for ativar, verificar limite da vitrine
    if (newStatus === true) {
        const collRef = collection(db, "companies", companyId, "catalog_items");
        const q = query(collRef, where("isActive", "==", true));
        const snapshot = await getCountFromServer(q);
        
        if (snapshot.data().count >= 20) {
            throw new Error("Sua vitrine já tem 20 destaques. Desative um para ativar este.");
        }
    }

    const docRef = doc(db, "companies", companyId, "catalog_items", itemId);
    await updateDoc(docRef, { isActive: newStatus });
}

// --- 5. DELETAR PRODUTO (Delete) ---
export async function deleteCatalogItem(itemId) {
    const companyId = await getRealCompanyId(); 
    const docRef = doc(db, "companies", companyId, "catalog_items", itemId);
    await deleteDoc(docRef);
}

// --- 6. ATUALIZAR PRODUTO (Edit) ---
export async function updateCatalogItem(itemId, updateData) {
    const companyId = await getRealCompanyId(); 
    const docRef = doc(db, "companies", companyId, "catalog_items", itemId);
    await updateDoc(docRef, updateData);
}
