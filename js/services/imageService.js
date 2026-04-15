// js/services/imageService.js
// ==========================================================
// SERVIÇO DE IMAGENS E ARQUIVOS (v1.0 - Refatorado)
// Centraliza upload (ImgBB), conversão Base64 e Branding
// ==========================================================

import { 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

import { db, auth, storage } from '../firebaseConfig.js'; // Adicionado o storage

/**
 * Converte um arquivo (File Object) para Base64 (sem prefixo de data url).
 * Usado para uploads via API.
 */
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

/**
 * Converte uma URL de imagem (ex: ImgBB) para Base64 completo (DataURL).
 * Vital para gerar PDFs com imagens que estão na nuvem (evita CORS em alguns casos e garante embed).
 */
export const urlToBase64 = async (url) => {
    try {
        // Adiciona timestamp para evitar cache agressivo que corrompe imagens
        const cleanUrl = url.includes('?') ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`;
        
        const response = await fetch(cleanUrl);
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn("Falha ao converter imagem remota para Base64:", error);
        return null;
    }
};

/**
 * Faz upload de um arquivo físico direto para o Firebase Storage.
 * Retorna a URL pública de download nativa.
 */
export const uploadImageToStorage = async (file) => {
    if (!file) return null;
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Usuário não autenticado");

        // Busca a empresa do usuário para criar uma pasta isolada no Storage
        const mappingRef = doc(db, "user_mappings", user.uid);
        const mappingSnap = await getDoc(mappingRef);
        if (!mappingSnap.exists()) throw new Error("Empresa não encontrada");
        const companyId = mappingSnap.data().companyId;

        // Cria um nome único seguro para o arquivo
        const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.]/g, '_') : 'mockup.jpg';
        const uniqueName = `${Date.now()}_${safeName}`;
        
        // Define a rota exata no cofre: companies/{companyId}/mockups/{nome_do_arquivo}
        const storageRef = ref(storage, `companies/${companyId}/mockups/${uniqueName}`);
        
        // Faz o upload nativo (aceita o File Object gerado pelo Dropzone diretamente)
        const snapshot = await uploadBytes(storageRef, file);
        
        // Retorna o link de download direto do Google
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error('Erro no upload para o Firebase Storage:', error);
        return null;
    }
};

/**
 * Busca Logo e Telefone da empresa no Firestore para usar no PDF.
 * (Movido de utils.js para cá pois trata-se de "recurso de imagem/branding")
 */
export const fetchCompanyBrandingData = async () => {
    try {
        const user = auth.currentUser;
        if (!user) return null;

        // 1. Descobre o CompanyID através do mapeamento
        const mappingRef = doc(db, "user_mappings", user.uid);
        const mappingSnap = await getDoc(mappingRef);
        
        if (!mappingSnap.exists()) return null;
        const companyId = mappingSnap.data().companyId;

        // 2. Busca configuração de pagamento/branding
        const configRef = doc(db, `companies/${companyId}/config/payment`);
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            return {
                logoUrl: data.logoUrl || null,
                phone: data.whatsappNumber || null
            };
        }
        return null;
    } catch (error) {
        console.error("Erro buscando branding:", error);
        return null;
    }
};
