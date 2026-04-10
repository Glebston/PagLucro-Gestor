// js/listeners/aiListeners.js
// ========================================================
// MÓDULO PREMIUM: PREENCHIMENTO TURBO IA (Frontend)
// ========================================================

import { processTextWithAI } from '../services/aiService.js';

export function initAiListeners() {
    console.log("✨ [IA Turbo] Inicializando listeners visuais...");

    // Elementos do Split Button no Cabeçalho
    const dropdownBtn = document.getElementById('aiTurboDropdownBtn');
    const aiMenu = document.getElementById('aiTurboMenu');
    const openModalBtn = document.getElementById('openAiTurboModalBtn');

    // Elementos do Modal Roxo
    const modal = document.getElementById('aiTurboModal');
    const closeBtn = document.getElementById('closeAiTurboModalBtn');
    const cancelBtn = document.getElementById('cancelAiTurboBtn');
    const processBtn = document.getElementById('processAiTurboBtn');
    const textarea = document.getElementById('aiTurboInputText');
    const loadingBox = document.getElementById('aiTurboLoading');

    // Trava de segurança: se os elementos não existirem na tela, aborta silenciosamente
    if (!dropdownBtn || !modal) {
        console.warn("⚠️ [IA Turbo] Elementos da interface não encontrados no DOM.");
        return;
    }

    // --- 1. Controle do Dropdown (Setinha do Botão) ---
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que o clique vaze para outros elementos
        aiMenu.classList.toggle('hidden');
    });

    // Fechar o menu flutuante se o usuário clicar em qualquer outro lugar da tela
    document.addEventListener('click', (e) => {
        if (!dropdownBtn.contains(e.target) && !aiMenu.contains(e.target)) {
            aiMenu.classList.add('hidden');
        }
    });

    // --- 2. Controle de Acesso e Abertura do Modal ---
    const userPlan = localStorage.getItem('userPlan') || 'essencial';
    const isPremium = userPlan === 'pro';

    if (!isPremium) {
        // 🔴 MODO BLOQUEADO (Gatilho de Vendas)
        openModalBtn.innerHTML = '<span>🔒</span> Preenchimento Turbo IA';
        openModalBtn.classList.remove('text-purple-700', 'hover:bg-purple-50');
        openModalBtn.classList.add('text-gray-400', 'hover:bg-gray-50', 'opacity-80');

        openModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            aiMenu.classList.add('hidden');
            alert("✨ Exclusivo do Plano Premium ✨\n\nAutomatize sua recepção e economize horas de trabalho. Fale com o suporte para fazer o Upgrade e liberar a Inteligência Artificial!");
        });
    } else {
        // 🟢 MODO LIBERADO (Acesso Premium)
        openModalBtn.addEventListener('click', () => {
            aiMenu.classList.add('hidden'); // Esconde o menuzinho
            
            // Reset visual da interface para um novo pedido
            textarea.value = ''; 
            textarea.disabled = false;
            loadingBox.classList.add('hidden'); 
            processBtn.disabled = false;
            processBtn.innerHTML = 'Processar ✨';

            // Exibe o modal
            modal.classList.remove('hidden');
            textarea.focus(); // Já coloca o cursor piscando para o usuário colar o texto
        });
    }

    // --- 3. Fechar o Modal ---
    const closeModal = () => {
        modal.classList.add('hidden');
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // --- 4. O Coração da Funcionalidade (Botão Processar) ---
    processBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();

        if (!text) {
            alert("Por favor, cole a mensagem do cliente antes de acionar a IA.");
            return;
        }

        // Bloqueia a interface para evitar cliques duplicados (UX)
        processBtn.disabled = true;
        processBtn.innerHTML = 'Analisando Pedido...';
        loadingBox.classList.remove('hidden');
        textarea.disabled = true;

        try {
            console.log("🚀 [IA Turbo] Despachando malote criptografado para a Nuvem...");
            
            // O serviço envia o texto e aguarda o JSON estruturado do Firebase Functions
            const dadosIA = await processTextWithAI(text);
            
            console.log("✨ [IA Turbo] Resposta Mágica do Cérebro:", dadosIA);
            
            closeModal(); // Fecha a caixa roxa da IA

            // 1. Simula o clique no botão nativo para abrir a tela de "Novo Pedido"
            const btnNovoPedido = document.getElementById('addOrderBtn');
            if (btnNovoPedido) btnNovoPedido.click();

            // 2. Toca a campainha global: Despacha os dados para quem souber montar a tela
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('injetarPecasIA', { detail: dadosIA }));
            }, 500); // 500ms dá folga para o navegador iniciar a abertura do modal

        } catch (error) {
            console.error("Erro no processamento da IA:", error);
            alert("Houve um erro de comunicação. Verifique sua conexão e tente novamente.");
        } finally {
            // Se algo der errado, destrava a tela para o usuário tentar de novo
            processBtn.disabled = false;
            processBtn.innerHTML = 'Processar ✨';
            loadingBox.classList.add('hidden');
            textarea.disabled = false;
        }
    });
}
