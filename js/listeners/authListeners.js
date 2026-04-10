// js/listeners/authListeners.js

// Importações necessárias
// v5.7.22: REMOVIDA importação estática de UI.
// import * as UI from '../ui.js'; 
import { handleLogin, handleLogout, handleForgotPassword } from '../auth.js'; // Importa as funções de lógica de autenticação

/**
 * Inicializa todos os event listeners relacionados à autenticação (login, logout, etc.).
 * Esta função é chamada uma vez no main.js para anexar os listeners.
 * * v5.7.22: A função agora recebe o módulo 'UI' injetado pelo main.js
 * para resolver o "conflito de módulo" (estático vs. dinâmico).
 */
export function initializeAuthListeners(UI) {
    
    // [CORREÇÃO SPA] Delegação Global para Eventos de Autenticação
    // ----------------------------------------------------------------

    // 1. Delegação para Envios de Formulário (Submit)
    document.addEventListener('submit', (e) => {
        // Intercepta o login
        const loginForm = e.target.closest('#loginForm');
        if (loginForm) {
            e.preventDefault();
            const emailInput = document.getElementById('loginEmail');
            const passInput = document.getElementById('loginPassword');
            if (emailInput && passInput) {
                handleLogin(emailInput.value, passInput.value);
            }
        }
    });

    // 2. Delegação para Cliques (Esqueci a Senha e Logout)
    document.addEventListener('click', (e) => {
        // Esqueci minha senha
        if (e.target.closest('#forgotPasswordBtn')) {
            e.preventDefault(); // Evita recarregamento caso seja um <a>
            handleForgotPassword();
        }

        // Sair do Sistema (Logout)
        if (e.target.closest('#logoutBtn') || e.target.closest('#blockedLogoutBtn')) {
            e.preventDefault(); // Evita recarregamento caso seja um <a>
            handleLogout();
        }
    });
}
