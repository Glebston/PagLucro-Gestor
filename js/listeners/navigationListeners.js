// js/listeners/navigationListeners.js
// ==========================================================
// MÓDULO NAVIGATION LISTENERS (v6.0.0 - BACKDROP STRATEGY)
// Status: SOLUÇÃO DEFINITIVA (Simples e Robusta)
// ==========================================================

import { resetIdleTimer } from '../security/sessionManager.js';

export function initializeNavigationListeners(UI, deps) {

    // --- 1. Eventos Globais de Sistema ---
    window.addEventListener('load', () => {
        if (localStorage.getItem('cookieConsent') !== 'true') {
            if(UI.DOM.cookieBanner) UI.DOM.cookieBanner.classList.remove('hidden');
        }
    });
    
    // Timer de inatividade
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => window.addEventListener(event, resetIdleTimer));

    // --- 2. MOTOR DE ROTAS (Fase 5 - Lazy Loading) ---
    const loadRoute = async (viewName) => {
        const container = document.getElementById('mainViewContainer');
        if (!container) return;

        // Feedback visual blindado contra cache
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-gray-400">
                <svg class="animate-spin h-10 w-10 mb-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p>Construindo interface...</p>
            </div>`;

        try {
            // Fetch do HTML físico
            const response = await fetch(`views/${viewName}View.html?v=${Date.now()}`);
            if (!response.ok) throw new Error('Falha na Rota');
            
            // Injeção limpa no DOM
            container.innerHTML = await response.text();

            // Atualiza o estado
            deps.setState({ currentDashboardView: viewName });
            if (UI.updateNavButton) UI.updateNavButton(viewName);

            // ⚠️ CRÍTICO: Reconexão de Segurança (Lockdown)
            if (deps.reapplySecurity) deps.reapplySecurity();

            // Dispara evento global para religar lógicas (Fase 5b)
            document.dispatchEvent(new CustomEvent('viewLoaded', { detail: { viewName } }));

            // Injeta dados na DOM fresca
            if (viewName === 'orders') {
                const { currentOrdersView } = deps.getState();
                UI.renderOrders(deps.getOrders(), currentOrdersView);
            } else if (viewName === 'finance') {
                UI.renderFinanceDashboard(deps.getTransactions(), deps.getConfig());
                // [CORREÇÃO BUG 1] rebindFinance removido! 
                // A delegação global no main.js já garante a escuta contínua. 
                // Religar aqui causava o empilhamento (duplicação) de lançamentos.
            } else if (viewName === 'catalog') {
                if (deps.renderCatalog) deps.renderCatalog();
            } else if (viewName === 'inventory') {
                // Inicia o Almoxarifado e aplica as restrições de equipe (RBAC)
                if (deps.renderInventory) deps.renderInventory();
                if (deps.applyRoleRestrictions) deps.applyRoleRestrictions();
            }

        } catch (error) {
            console.error("[Router Error]:", error);
            container.innerHTML = `<div class="text-center py-10 text-red-500 font-bold">Erro de injeção. Verifique a conexão.</div>`;
        }
    };

    // Exporta a função para o main.js poder iniciar a primeira tela
    deps.exportRoute(loadRoute);

    
        // ==========================================
        // ESTRATÉGIA 1: KANBAN DRAG-TO-SCROLL (Modo Tecla ALT)
        // Solução UX Profissional sem conflito de texto
        // ==========================================
        const initKanbanDragScroll = () => {
            // Ouvimos direto do documento, pois o Kanban é destruído e recriado via rotas SPA
            document.addEventListener('mousedown', (e) => {
                if (!e.altKey) return; // Se não estiver segurando ALT, não faz nada (deixa copiar texto)

                // Encontra a lista exata gerada pelo orderRenderer.js
                const slider = document.getElementById('ordersList');
                
                // Só arrasta se o elemento existir e for realmente um quadro de arrasto horizontal
                if (!slider || !slider.classList.contains('overflow-x-auto')) return;

                e.preventDefault(); // Bloqueia texto/D&D nativo
                
                console.log("Alvo do Kanban Capturado! Iniciando rolagem..."); // Feedback visual no console

                slider.classList.add('cursor-grabbing');
                
                // Captura a posição inicial
                const startX = e.pageX - slider.offsetLeft;
                const startScrollLeft = slider.scrollLeft;

                // Cria funções temporárias para seguir o mouse sem sujar a memória global
                const mouseMoveHandler = (moveEvent) => {
                    moveEvent.preventDefault();
                    const x = moveEvent.pageX - slider.offsetLeft;
                    const walk = (x - startX) * 2; // Velocidade do arrasto (2x mais fluida)
                    slider.scrollLeft = startScrollLeft - walk;
                };

                const mouseUpHandler = () => {
                    slider.classList.remove('cursor-grabbing');
                    document.removeEventListener('mousemove', mouseMoveHandler);
                    document.removeEventListener('mouseup', mouseUpHandler);
                };

                // Ativa os ouvintes temporários de movimento e soltura
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
            });
        };

        // Inicia a vigilância
        initKanbanDragScroll();
        // ==========================================
    
    // Navegação via botão Financeiro
    if (UI.DOM.financeDashboardBtn) {
        UI.DOM.financeDashboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const { currentDashboardView } = deps.getState();
            const nextView = currentDashboardView === 'orders' ? 'finance' : 'orders';
            loadRoute(nextView);
            if (UI.DOM.userDropdown) UI.DOM.userDropdown.classList.add('hidden');
        });
    }

    // Navegação via botão Estoque (Almoxarifado) - Agora com Vai-e-Vem (Toggle)
    const navInventoryBtn = document.getElementById('navInventoryBtn');
    if (navInventoryBtn) {
        navInventoryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Verifica onde estamos para decidir para onde ir
            const { currentDashboardView } = deps.getState();
            const nextView = currentDashboardView === 'inventory' ? 'orders' : 'inventory';
            
            loadRoute(nextView);
            if (UI.DOM.userDropdown) UI.DOM.userDropdown.classList.add('hidden');
        });
    }

    // --- 3. CONTROLE MESTRE DE CLIQUES (FAB BACKDROP SYSTEM) ---
    
    // Captura os elementos soltos no DOM (Nova Estrutura)
    const fabMainBtn = document.getElementById('fabMainBtn');
    const fabMenu = document.getElementById('fabMenu');
    const fabBackdrop = document.getElementById('fabBackdrop');
    const iconPlus = document.getElementById('fabIconPlus');
    const iconClose = document.getElementById('fabIconClose');

    // Função ÚNICA que abre ou fecha tudo
    const toggleFabSystem = () => {
        if (!fabMenu || !fabBackdrop) return;

        // Verifica se está fechado (contém 'hidden')
        const isClosed = fabMenu.classList.contains('hidden');

        if (isClosed) {
            // ABRIR: Remove 'hidden' do menu e da cortina
            fabMenu.classList.remove('hidden');
            fabBackdrop.classList.remove('hidden');
            
            // Visual do Botão: Fica Vermelho
            if (fabMainBtn) {
                fabMainBtn.classList.remove('bg-blue-600');
                fabMainBtn.classList.add('bg-red-600');
            }
            
            // Animação de Ícones: Some o (+) e aparece o (X)
            if (iconPlus) iconPlus.classList.add('opacity-0', 'rotate-90');
            if (iconClose) iconClose.classList.remove('opacity-0', 'rotate-90');
            
        } else {
            // FECHAR: Adiciona 'hidden' de volta
            fabMenu.classList.add('hidden');
            fabBackdrop.classList.add('hidden');
            
            // Visual do Botão: Volta pra Azul
            if (fabMainBtn) {
                fabMainBtn.classList.remove('bg-red-600');
                fabMainBtn.classList.add('bg-blue-600');
            }
            
            // Animação de Ícones: Volta o (+) e some o (X)
            if (iconPlus) iconPlus.classList.remove('opacity-0', 'rotate-90');
            if (iconClose) iconClose.classList.add('opacity-0', 'rotate-90');
        }
    };

    // Listener A: Clique no Botão Principal
    if (fabMainBtn) {
        fabMainBtn.onclick = (e) => {
            e.stopPropagation(); // Impede que o clique passe para o document
            toggleFabSystem();
        };
    }

    // Listener B: Clique na Cortina Invisível (Fundo)
    if (fabBackdrop) {
        fabBackdrop.onclick = () => {
            toggleFabSystem(); // Clicou fora? Fecha tudo.
        };
    }

    // Listener C: Clique em qualquer opção do menu
    if (fabMenu) {
        fabMenu.addEventListener('click', () => {
            toggleFabSystem(); // Escolheu uma opção? Fecha o menu.
        });
    }

    // --- 4. DELEGAÇÃO GLOBAL: Dropdown e Botões Periféricos (Vacina SPA) ---
    document.addEventListener('click', async (e) => {
        
        // A. Controle do Dropdown do Usuário
        const userMenuBtn = e.target.closest('#userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');
        
        if (userMenuBtn && userDropdown) {
            userDropdown.classList.toggle('hidden');
        } else if (userDropdown && !userDropdown.contains(e.target)) {
            // Clicou fora do dropdown, fecha ele
            userDropdown.classList.add('hidden');
        }

        // B. Alternar entre Pendentes e Entregues
        const toggleViewBtn = e.target.closest('#toggleViewBtn');
        if (toggleViewBtn) {
            e.preventDefault();
            let { currentOrdersView } = deps.getState();
            currentOrdersView = currentOrdersView === 'pending' ? 'delivered' : 'pending';
            deps.setState({ currentOrdersView });
            toggleViewBtn.textContent = currentOrdersView === 'pending' ? 'Ver Entregues' : 'Ver Pendentes';
            UI.renderOrders(deps.getOrders(), currentOrdersView);
            if(userDropdown) userDropdown.classList.add('hidden'); // Fecha menu após clique
        }

        // C. Backup Manual (Menu ou Lembrete)
        if (e.target.closest('#backupBtn') || e.target.closest('#backupNowBtn')) {
            e.preventDefault();
            deps.handleBackup();
            if(userDropdown) userDropdown.classList.add('hidden');
            const reminder = document.getElementById('backupReminderBanner');
            if(reminder) reminder.classList.add('hidden');
        }

        // D. Solicitar Exclusão de Conta
        if (e.target.closest('#requestDeletionBtn')) {
            e.preventDefault();
            const confirmed = await UI.showConfirmModal("Enviar solicitação?", "Sim", "Cancelar");
            if (confirmed) UI.showInfoModal(`Envie e-mail para paglucrobr@gmail.com`);
            if(userDropdown) userDropdown.classList.add('hidden');
        }

        // E. Aceitar Cookies
        if (e.target.closest('#cookieAcceptBtn')) {
            localStorage.setItem('cookieConsent', 'true'); 
            const banner = document.getElementById('cookieBanner');
            if(banner) banner.classList.add('hidden'); 
        }

        // F. Dispensar Lembrete de Backup
        if (e.target.closest('#dismissBackupReminderBtn')) {
            const reminder = document.getElementById('backupReminderBanner');
            if(reminder) reminder.classList.add('hidden');
        }
    });

    // --- 5. DELEGAÇÃO GLOBAL: Eventos de Change (Inputs de Arquivo) ---
    document.addEventListener('change', (e) => {
        // G. Importar Backup (usando o ID real do input no HTML)
        const restoreFileInput = e.target.closest('#restoreFile'); 
        if (restoreFileInput) {
            deps.handleRestore(e);
            const userDropdown = document.getElementById('userDropdown');
            if(userDropdown) userDropdown.classList.add('hidden');
        }
    });
}
