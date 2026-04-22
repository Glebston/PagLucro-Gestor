// js/firebaseConfig.js
// Importa as funções necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

// --- ATENÇÃO: CONFIGURAÇÃO PARA AMBIENTE DE PRODUÇÃO ---
const firebaseConfig = {
  apiKey: "AIzaSyA8MxD_m6lKrrQKijlxQ0lQUQdC3OpTEv4",
  authDomain: "saas-57e0d.firebaseapp.com",
  projectId: "saas-57e0d",
  storageBucket: "saas-57e0d.firebasestorage.app", // Atualizado para o novo padrão
  messagingSenderId: "230026949437",
  appId: "1:230026949437:web:9f19f286aefb96e0330b54"
};

// Inicializa o Firebase Principal (Para você, Administrador)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // Inicialização do cofre nativo
const functions = getFunctions(app); // [NOVO] Ativando o motor do Robô Noturno e Botão de Pânico

// [NOVO] App Secundário: Usado exclusivamente para criar a conta da equipe
// de produção em segundo plano, sem derrubar a sua sessão atual.
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

export { db, auth, secondaryAuth, storage, functions }; // [NOVO] Exportando functions para o admin.js
