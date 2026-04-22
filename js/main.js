// js/main.js
// ==========================================================
// ORQUESTRADOR CENTRAL (v6.3.1 - Branding Update)
// ========================================================

async function main() {
    
    // Força uma versão nova manual para limpar o cache de todos
const cacheBuster = `?v=6.4.0_FORCE_REFRESH`;

    try {
        // ========================================================
        // 1. IMPORTAÇÕES DINÂMICAS (Lazy Loading)
        // ========================================================

        const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
        const { 
            doc, 
            getDoc, 
            setDoc,
            updateDoc, 
            serverTimestamp, 
            writeBatch, 
            collection 
        } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
        
        const { db, auth } = await import(`./firebaseConfig.js${cacheBuster}`);
        const { handleLogout } = await import(`./auth.js${cacheBuster}`);

        // Serviços (Regras de Negócio)
        const { 
            initializeOrderService, 
            saveOrder, 
            deleteOrder, 
            getOrderById, 
            getAllOrders, 
            cleanupOrderService,
            calculateTotalPendingRevenue,   
            updateOrderDiscountFromFinance  
        } = await import(`./services/orderService.js${cacheBuster}`);
        
        const { 
            initializeFinanceService, 
            saveTransaction, 
            deleteTransaction, 
            markTransactionAsPaid, 
            saveInitialBalance, 
            getAllTransactions, 
            cleanupFinanceService, 
            getTransactionByOrderId,        
            getTransactionsByOrderId,       
            deleteAllTransactionsByOrderId,
            getTransactionById              
        } = await import(`./services/financeService.js${cacheBuster}`);
        
        const { 
            initializePricingService, 
            savePriceTableChanges, 
            deletePriceItem, 
            getAllPricingItems, 
            cleanupPricingService 
        } = await import(`./services/pricingService.js${cacheBuster}`);
        
        const { initializeIdleTimer } = await import(`./security/sessionManager.js${cacheBuster}`);
        const UI = await import(`./ui.js${cacheBuster}`);

        // Listeners (Interações do Usuário)
        const { initializeAuthListeners } = await import(`./listeners/authListeners.js${cacheBuster}`);
        const { initializeNavigationListeners } = await import(`./listeners/navigationListeners.js${cacheBuster}`);
        
        // [NOVO] Importação da IA (Preenchimento Turbo)
        const { initAiListeners } = await import(`./listeners/aiListeners.js${cacheBuster}`);
        const { initializeOrderListeners } = await import(`./listeners/orderListeners.js${cacheBuster}`);
        const { initializeFinanceListeners } = await import(`./listeners/financeListeners.js${cacheBuster}`);
        const { initializeModalAndPricingListeners } = await import(`./listeners/modalAndPricingListeners.js${cacheBuster}`);
        const { initConfigListeners } = await import(`./listeners/configListeners.js${cacheBuster}`);
        
        
        // [NOVO] Importação do Catálogo
        const { initCatalogListeners } = await import(`./listeners/catalogListeners.js${cacheBuster}`);
        
        // [NOVO] Importações do Almoxarifado (Estoque)
        const { initializeInventoryService, cleanupInventoryService, getInventoryItems, saveInventoryItem, deleteInventoryItem, updateItemQuantity } = await import(`./services/inventoryService.js${cacheBuster}`);
        const { renderInventoryTable, renderInventoryModal, closeInventoryModal, renderLowStockWidget } = await import(`./ui/inventoryRenderer.js${cacheBuster}`);
        const { initializeInventoryListeners } = await import(`./listeners/inventoryListeners.js${cacheBuster}`);

        // ========================================================
        // 2. ESTADO GLOBAL
        // ========================================================

        let userCompanyId = null;
        let userCompanyName = null;
        let userBankBalanceConfig = { initialBalance: 0 };
        let isAdminUser = false; 

        let currentDashboardView = 'orders';
        let currentOrdersView = 'pending';
        let partCounter = 0;
        let currentOptionType = ''; 
        
        let orderUpdateDebounce = null;
        let financeUpdateDebounce = null;
        let lastFilterValue = 'thisMonth';

        const defaultOptions = {
            partTypes: ['Gola redonda manga curta', 'Gola redonda manga longa', 'Gola redonda manga longa com capuz', 'Gola redonda manga curta (sublimada na frente)', 'Gola polo manga curta', 'Gola polo manga longa', 'Gola V manga curta', 'Gola V manga longa', 'Short', 'Calça'],
            materialTypes: ['Malha fria', 'Drifity', 'Cacharrel', 'PP', 'Algodão Fio 30', 'TNT drive', 'Piquê', 'Brim']
        };

        // ========================================================
        // 3. RENDERIZAÇÃO SEGURA (Com Proteção SPA)
        // ========================================================
        
        const safeRenderFinance = (source, transactions, config, pendingValue) => {
            // Se a tela financeira não estiver aberta, aborta a injeção no DOM (evita quebras e economiza memória)
            if (currentDashboardView !== 'finance') return;

            let finalValue = pendingValue ?? 0;
            UI.renderFinanceDashboard(transactions, config, finalValue);
        };

        // ========================================================
        // [NOVO] FUNÇÃO DE LOCKDOWN (MODO PRODUÇÃO)
        // ========================================================
        const applyRoleRestrictions = () => {
            const elementsToHide = [
                'financeDashboardBtn',
                'catalogDashboardBtn',
                'priceTableBtn',
                'companySettingsBtn',
                'addOrderBtn'
            ];

            elementsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.add('hidden');
                    // Segurança extra: remove do DOM para impedir reativação via console
                    el.remove(); 
                }
            });

            // Ocultar o Menu FAB (Ajuste o seletor caso seu HTML use outro ID/Classe)
            const fabContainers = document.querySelectorAll('.fab-container, #fabMenu');
            fabContainers.forEach(fab => fab.remove());

            // Ocultar elementos exclusivos de administração (ex: botões no Estoque)
            const adminElements = document.querySelectorAll('.admin-only-element');
            adminElements.forEach(el => el.remove());
        };
        
        // ========================================================
        // 4. LÓGICA CORE (Inicialização & SaaS Check)
        // ========================================================
        
        const initializeAppLogic = async (user) => {
            console.log("🚀 [MAIN] Inicializando Sistema...");
            
            // A. Definição de Admin
            const ADMIN_EMAILS = ['admin@paglucro.com', 'saianolucrobr@gmail.com']; 
            if (ADMIN_EMAILS.includes(user.email)) {
                isAdminUser = true;
                console.log("👑 Modo Administrador Ativado");
            }

            // B. Mapeamento de Usuário & Interceptação "Modo Deus" (SaaS Admin)
            let impersonatedId = localStorage.getItem('impersonateCompanyId');
            let isUserValid = false; // Trava de segurança estrutural
            
            // Se o Admin clicou no olho 👁️ no painel, força a troca do ID de empresa
            if (isAdminUser && impersonatedId) {
                console.warn(`👁️ [MODO DEUS ATIVADO] Acessando fábrica ID: ${impersonatedId}`);
                userCompanyId = impersonatedId;
                
                const companyRef = doc(db, "companies", userCompanyId);
                const companySnap = await getDoc(companyRef);
                
                if (!companySnap.exists()) {
                    alert("A fábrica solicitada não existe ou foi deletada do banco de dados.");
                    localStorage.removeItem('impersonateCompanyId');
                    window.location.reload();
                    return;
                }
                
                const companyData = companySnap.data();
                userCompanyName = companyData.companyName || "Empresa (Modo Suporte)";
                userBankBalanceConfig = companyData.bankBalanceConfig || { initialBalance: 0 };
                isUserValid = true; // Libera o carregamento do sistema
                
                const warningBar = document.createElement('div');
                warningBar.className = "bg-red-600 text-white text-xs font-bold text-center py-1 px-4 fixed top-0 w-full z-[9999] shadow-md flex justify-between items-center";
                warningBar.innerHTML = `
                    <span>👁️ MODO SUPORTE ATIVADO: ${userCompanyName}</span>
                    <button id="exitGodModeBtn" class="bg-white text-red-600 px-2 py-0.5 rounded text-[10px] hover:bg-gray-100 transition">Sair</button>
                `;
                document.body.appendChild(warningBar);
                document.getElementById('exitGodModeBtn').addEventListener('click', () => {
                    localStorage.removeItem('impersonateCompanyId');
                    window.location.reload();
                });

            } else {
                // Fluxo Normal (O usuário é o dono ou o chão de fábrica real)
                const userMappingRef = doc(db, "user_mappings", user.uid);
                let userMappingSnap = await getDoc(userMappingRef);

                if (!userMappingSnap.exists() && user.displayName) {
                    try {
                        await setDoc(userMappingRef, { companyId: user.displayName, role: 'production' });
                        userMappingSnap = await getDoc(userMappingRef);
                    } catch (error) {
                        console.error("🚫 Falha no auto-mapeamento:", error);
                    }
                }

                if (userMappingSnap.exists()) {
                    userCompanyId = userMappingSnap.data().companyId;
                    const companyRef = doc(db, "companies", userCompanyId);
                    const companySnap = await getDoc(companyRef);

                    if (companySnap.exists()) {
                        const companyData = companySnap.data();
                        
                        // --- SEGURANÇA SAAS ---
                        if (companyData.isDeleted === true || companyData.isBlocked === true) {
                            if (!isAdminUser) {
                                document.getElementById('blockedModal').classList.remove('hidden');
                                document.getElementById('blockedLogoutBtn').onclick = handleLogout;
                                return; 
                            }
                        }

                        if (!isAdminUser && !companyData.isLifetime && companyData.dueDate) {
                            const today = new Date(); today.setHours(0,0,0,0);
                            const [y, m, d] = companyData.dueDate.split('-').map(Number);
                            const dueDate = new Date(y, m - 1, d);
                            const diffDays = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));

                            if (diffDays > 5) {
                                document.getElementById('blockedModal').classList.remove('hidden');
                                document.getElementById('blockedLogoutBtn').onclick = handleLogout;
                                return; 
                            } else if (diffDays > 0) {
                                document.getElementById('paymentWarningModal').classList.remove('hidden');
                            }
                        }

                        updateDoc(companyRef, { lastAccess: serverTimestamp(), email: user.email }).catch(e => {});

                        if (companyData.adminMessage && companyData.adminMessage.trim() !== "") {
                            UI.showInfoModal(`🔔 MENSAGEM DO SUPORTE:\n\n${companyData.adminMessage}`);
                            updateDoc(companyRef, { adminMessage: "" }).catch(e => {});
                        }

                        // --- MEGAFONE GLOBAL ---
                        try {
                            const broadcastRef = doc(db, "admin_settings", "broadcast");
                            const broadcastSnap = await getDoc(broadcastRef);
                            if (broadcastSnap.exists() && broadcastSnap.data().active === true) {
                                const broadcastMsg = broadcastSnap.data().message;
                                const modalElement = document.getElementById('broadcastModal');
                                const msgBodyElement = document.getElementById('broadcastMessageBody');
                                const ackBtnElement = document.getElementById('broadcastAcknowledgeBtn');

                                if (modalElement && msgBodyElement && ackBtnElement) {
                                    msgBodyElement.textContent = broadcastMsg;
                                    modalElement.classList.remove('hidden');
                                    ackBtnElement.onclick = () => modalElement.classList.add('hidden');
                                }
                            }
                        } catch (broadcastError) {}
                        
                        localStorage.setItem('userPlan', companyData.subscription?.planId || 'essencial');
                        userCompanyName = companyData.companyName || user.email;
                        userBankBalanceConfig = companyData.bankBalanceConfig || { initialBalance: 0 };
                        
                        // RBAC (CHÃO DE FÁBRICA)
                        window.USER_ROLE = 'owner';
                        if (companyData.team && companyData.team[user.email] && companyData.team[user.email].role === 'production' && companyData.team[user.email].active === true) {
                            window.USER_ROLE = 'production';
                            applyRoleRestrictions();
                        }
                        
                    } else {
                        userCompanyName = user.email; 
                        userBankBalanceConfig = { initialBalance: 0 };
                        localStorage.setItem('userPlan', 'essencial');
                    }
                    isUserValid = true; // Libera o carregamento do sistema
                }
            } 

            // Se o usuário não existe no Modo Deus nem no Normal, encerra aqui.
            if (!isUserValid) {
                UI.showInfoModal("Erro: Usuário não associado a nenhuma empresa. Fale com o suporte.");
                handleLogout();
                return;
            }

            // ------------------------------------------------------------
            // [MODIFICAÇÃO BRANDING] Atualização do Menu com Logo da Empresa
            // ------------------------------------------------------------
                UI.DOM.userEmail.textContent = userCompanyName;

                try {
                    // Busca configuração extra (Logo/Pagamento)
                    const configRef = doc(db, 'companies', userCompanyId, 'config', 'payment');
                    const configSnap = await getDoc(configRef);
                    
                    if (configSnap.exists()) {
                        const configData = configSnap.data();
                        
                        // Se houver URL do Logo, substitui o ícone padrão
                        if (configData.logoUrl) {
                            const emailElement = UI.DOM.userEmail;
                            // Tenta encontrar o container do botão (pai do texto)
                            const btnContainer = emailElement.parentElement;
                            
                            if (btnContainer) {
                                // Procura o SVG genérico (bonequinho) dentro do botão
                                const genericIcon = btnContainer.querySelector('svg');
                                
                                if (genericIcon) {
                                    const logoImg = document.createElement('img');
                                    logoImg.src = configData.logoUrl;
                                    // Classes para garantir visual circular e contido
                                    logoImg.className = "w-8 h-8 rounded-full object-contain bg-white border border-gray-200"; 
                                    logoImg.alt = "Logo Empresa";
                                    
                                    genericIcon.replaceWith(logoImg);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.warn("⚠️ Erro ao carregar branding no menu:", err);
                }
                // ------------------------------------------------------------

                if (UI.DOM.periodFilter) UI.DOM.periodFilter.value = 'thisMonth';

                console.log("🔌 [MAIN] Conectando serviços...");
                initializeOrderService(userCompanyId, handleOrderChange, () => currentOrdersView);
                initializeFinanceService(userCompanyId, handleFinanceChange, () => userBankBalanceConfig);
                initializePricingService(userCompanyId, handlePricingChange); 
                initializeInventoryService(userCompanyId, handleInventoryChange, () => currentDashboardView);
                
                const now = new Date();
                const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                const pendingRevenue = calculateTotalPendingRevenue ? calculateTotalPendingRevenue(startOfThisMonth, endOfThisMonth) : 0;
                
                // Renderização Inicial via Motor de Rotas (Injeta a tela de pedidos)
                if (systemRouter) {
                    systemRouter('orders');
                } else {
                    console.error("Motor de Rotas não inicializado corretamente.");
                }
                
                initializeIdleTimer(UI.DOM, handleLogout);
                initializeAndPopulateDatalists(); 
                UI.updateNavButton(currentDashboardView);
                
                // [CORREÇÃO SPA] Delegação Global: Botão de Configurações
                // ------------------------------------------------------------
                document.addEventListener('click', async (e) => {
                    const settingsBtn = e.target.closest('#companySettingsBtn');
                    if (settingsBtn) {
                        e.preventDefault();
                        try {
                            // Fecha o dropdown do usuário ao clicar (melhor UX)
                            const dropdown = document.getElementById('userDropdown');
                            if (dropdown && !dropdown.classList.contains('hidden')) {
                                dropdown.classList.add('hidden');
                            }

                            // 1. Busca e injeta o HTML da tela de configurações primeiro
                            const { ensureSettingsModalLoaded } = await import(`./ui/modalHandler.js${cacheBuster}`);
                            await ensureSettingsModalLoaded();

                            // 2. Importa a lógica APÓS o HTML existir no DOM
                            const { openSettingsModal } = await import(`./listeners/settingsLogic.js${cacheBuster}`);
                            
                            // 3. Abre o modal e puxa os dados do banco
                            const modal = document.getElementById('settingsModal');
                            if (modal) {
                                modal.classList.remove('hidden');
                                modal.dataset.companyId = userCompanyId;
                                openSettingsModal(); 
                            }
                        } catch (err) {
                            console.error("Erro ao carregar configurações:", err);
                        }
                    }
                });
                // ------------------------------------------------------------

                // Exibição do App e Carregamento do Admin
                setTimeout(async () => {
                    UI.DOM.authContainer.classList.add('hidden'); 
                    UI.DOM.app.classList.remove('hidden');
                    
                    if (isAdminUser) {
                        console.log("👑 Modo Admin Supremo detectado. Liberando acesso...");
                        const adminBtn = document.getElementById('adminPanelBtn');
                        if (adminBtn) adminBtn.classList.remove('hidden');
                    }
                    
                    // Refresh de segurança nos dados financeiros
                    setTimeout(async () => {
                        if (UI.DOM.periodFilter && !UI.DOM.periodFilter.value) UI.DOM.periodFilter.value = 'thisMonth';
                        if (calculateTotalPendingRevenue) {
                            const dates = getCurrentDashboardDates(); 
                            const freshPending = calculateTotalPendingRevenue(dates.startDate, dates.endDate);
                            safeRenderFinance('SafetyRefresh', getAllTransactions(), userBankBalanceConfig, freshPending);
                        }
                    }, 2000); 

                   requestAnimationFrame(() => requestAnimationFrame(() => checkBackupReminder()));
                }, 0);
        };

        const cleanupApplication = () => {
            UI.DOM.app.classList.add('hidden');
            UI.DOM.authContainer.classList.remove('hidden');
            
            document.getElementById('blockedModal').classList.add('hidden');
            document.getElementById('paymentWarningModal').classList.add('hidden');
            
            localStorage.removeItem('userPlan');
            sessionStorage.removeItem('hideLowStockWarning'); // [NOVO] Limpa a memória do aviso de estoque
            
            cleanupOrderService();
            cleanupFinanceService();
            cleanupPricingService();
            cleanupInventoryService();
            
            userCompanyId = null;
            userCompanyName = null;
            userBankBalanceConfig = { initialBalance: 0 };
            isAdminUser = false;
        };

        onAuthStateChanged(auth, (user) => {
            if (user) {
                initializeAppLogic(user);
            } else {
                cleanupApplication();
            }
        });


        // ========================================================
        // 5. HANDLERS E HELPERS
        // ========================================================

        const getCurrentDashboardDates = () => {
            const now = new Date();
            const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            // [PROTEÇÃO SPA] Busca os filtros diretamente do documento real, se existirem no momento
            const periodFilterEl = document.getElementById('periodFilter');
            const startDateInputEl = document.getElementById('startDateInput');
            const endDateInputEl = document.getElementById('endDateInput');

            if (!periodFilterEl) return { startDate: defaultStart, endDate: defaultEnd };
            
            let filter = periodFilterEl.value || 'thisMonth';
            if (filter !== lastFilterValue) lastFilterValue = filter;

            let startDate = null, endDate = null;

            if (filter === 'custom') {
                if (startDateInputEl && startDateInputEl.value) startDate = new Date(startDateInputEl.value + 'T00:00:00');
                if (endDateInputEl && endDateInputEl.value) endDate = new Date(endDateInputEl.value + 'T23:59:59');
                if (!startDate || !endDate) { startDate = defaultStart; endDate = defaultEnd; }
            } else {
                switch(filter) {
                    case 'thisMonth': startDate = defaultStart; endDate = defaultEnd; break;
                    case 'lastMonth': 
                        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                        break;
                    case 'thisYear': 
                        startDate = new Date(now.getFullYear(), 0, 1);
                        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                        break;
                    default: startDate = defaultStart; endDate = defaultEnd;
                }
            }
            return { startDate, endDate };
        };

       const handleOrderChange = (type, order, viewType) => {
            const isDelivered = order.orderStatus === 'Entregue';
            const shouldShow = (viewType === 'pending' && !isDelivered) || (viewType === 'delivered' && isDelivered);

            // [PROTEÇÃO SPA] Só desenha o card se o usuário estiver na tela de pedidos
            if (currentDashboardView === 'orders') {
                if (type === 'removed') UI.removeOrderCard(order.id);
                else if (shouldShow) {
                    if (type === 'added') UI.addOrderCard(order, viewType);
                    else UI.updateOrderCard(order, viewType);
                } else {
                    UI.removeOrderCard(order.id);
                }
            }

            // O cálculo de dinheiro continua rodando no fundo para manter o sistema vivo
            if (calculateTotalPendingRevenue) {
                if (orderUpdateDebounce) clearTimeout(orderUpdateDebounce);
                orderUpdateDebounce = setTimeout(() => {
                    const { startDate, endDate } = getCurrentDashboardDates();
                    const pendingRevenue = calculateTotalPendingRevenue(startDate, endDate);
                    safeRenderFinance('OrderChange', getAllTransactions(), userBankBalanceConfig, pendingRevenue);
                }, 200);
            }
        };

        const handleFinanceChange = (type, transaction, config) => {
            // [PROTEÇÃO SPA] Só filtra e desenha linhas se a tela financeira estiver aberta
            if (currentDashboardView === 'finance') {
                const { startDate, endDate } = getCurrentDashboardDates();
                const tDate = new Date(transaction.date + 'T00:00:00');
                
                // Busca o input com segurança no DOM real (evita erro de .value de null)
                const searchInput = document.getElementById('transactionSearchInput');
                const term = searchInput ? searchInput.value.toLowerCase() : '';
                
                const passesDate = (!startDate || tDate >= startDate) && (!endDate || tDate <= endDate);
                const passesSearch = transaction.description.toLowerCase().includes(term);

                if (!passesDate || !passesSearch) {
                    if (type !== 'added') UI.removeTransactionRow(transaction.id);
                } else {
                    if (type === 'removed') UI.removeTransactionRow(transaction.id);
                    else if (type === 'added') UI.addTransactionRow(transaction);
                    else UI.updateTransactionRow(transaction);
                }
            }

            if (calculateTotalPendingRevenue) {
                if (financeUpdateDebounce) clearTimeout(financeUpdateDebounce);
                financeUpdateDebounce = setTimeout(() => {
                    const currentDates = getCurrentDashboardDates();
                    const pendingRevenue = calculateTotalPendingRevenue(currentDates.startDate, currentDates.endDate);
                    safeRenderFinance('FinanceChange', getAllTransactions(), config, pendingRevenue);
                }, 250);
            }
        };

        const handlePricingChange = (type, item) => {
            const isEditMode = !UI.DOM.editPriceTableBtn.classList.contains('hidden');
            const mode = isEditMode ? 'view' : 'edit';
            if (type === 'removed') UI.removePriceTableRow(item.id);
            else if (type === 'added') UI.addPriceTableRow(item, mode);
            else UI.updatePriceTableRow(item, mode);
        };

        const handleInventoryChange = (type, item) => {
            const items = getInventoryItems();
            if (currentDashboardView === 'inventory') {
                renderInventoryTable(items);
            } else if (currentDashboardView === 'orders') {
                renderLowStockWidget(items);
            }
        };

        const getOptionsFromStorage = (type) => {
            const stored = localStorage.getItem(`${userCompanyId}_${type}`);
            return stored ? JSON.parse(stored) : defaultOptions[type];
        };

        const saveOptionsToStorage = (type, options) => {
            localStorage.setItem(`${userCompanyId}_${type}`, JSON.stringify(options));
        };

        const initializeAndPopulateDatalists = () => {
            if (!localStorage.getItem(`${userCompanyId}_partTypes`)) saveOptionsToStorage('partTypes', defaultOptions.partTypes);
            if (!localStorage.getItem(`${userCompanyId}_materialTypes`)) saveOptionsToStorage('materialTypes', defaultOptions.materialTypes);
            UI.populateDatalists(getOptionsFromStorage('partTypes'), getOptionsFromStorage('materialTypes'));
        };

        // Backup & Restore
        const handleBackup = () => {
            const orders = getAllOrders();
            const transactions = getAllTransactions();
            if (!orders.length && !transactions.length) return UI.showInfoModal("Não há dados para backup.");
            
            const dataStr = JSON.stringify({ orders, transactions }, null, 2);
            const url = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
            const link = document.createElement('a');
            link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            localStorage.setItem(`lastAutoBackupTimestamp_${userCompanyId}`, Date.now().toString());
            UI.showInfoModal("Backup realizado com sucesso!");
        };

        const handleRestore = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // [MODIFICADO] Removemos a trava estrita de "transactions" pois o novo backup pode ter outras gavetas
                    if (!data || typeof data !== 'object') throw new Error("Formato inválido");
                    
                    const choice = await UI.showConfirmModal("Importar Backup:", "Adicionar aos existentes", "Substituir tudo");
                    if (choice === null) return;
                    
                    UI.showInfoModal("Processando restauração...");
                    const batch = writeBatch(db);

                    if (!choice) { // Substituir tudo (Limpa ordens e transações da memória atual)
                        getAllOrders().forEach(o => batch.delete(doc(db, `companies/${userCompanyId}/orders`, o.id)));
                        getAllTransactions().forEach(t => batch.delete(doc(db, `companies/${userCompanyId}/transactions`, t.id)));
                    }

                    // [NOVO] Lógica Inteligente Híbrida: Lê tanto o formato Antigo (Array) quanto o Premium (Dicionário)
                    const colecoesParaRestaurar = ["orders", "transactions", "customers", "catalog", "settings"];

                    colecoesParaRestaurar.forEach(colName => {
                        const colData = data[colName];
                        if (colData) {
                            // Se for o Formato Premium do Robô Noturno (Objeto/Dicionário com chaves exatas)
                            if (typeof colData === 'object' && !Array.isArray(colData)) {
                                Object.entries(colData).forEach(([docId, docData]) => {
                                    batch.set(doc(db, `companies/${userCompanyId}/${colName}`, docId), docData);
                                });
                            }
                            // Se for o Formato Antigo do Front-end (Array/Lista)
                            else if (Array.isArray(colData)) {
                                colData.forEach(item => {
                                    const ref = item.id ? doc(db, `companies/${userCompanyId}/${colName}`, item.id) : doc(collection(db, `companies/${userCompanyId}/${colName}`));
                                    batch.set(ref, item);
                                });
                            }
                        }
                    });
                    
                    await batch.commit();
                    UI.showInfoModal("Dados restaurados com sucesso! Atualizando interface...");
                    setTimeout(() => window.location.reload(), 2000); // Força refresh para puxar os novos dados reais
                } catch (error) {
                    console.error("Erro na restauração híbrida:", error);
                    UI.showInfoModal("Erro ao processar arquivo de backup.");
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        };

        const checkBackupReminder = () => {
            const last = localStorage.getItem(`lastAutoBackupTimestamp_${userCompanyId}`);
            if (!last || (Date.now() - parseInt(last)) > (7 * 24 * 60 * 60 * 1000)) {
                UI.DOM.backupReminderBanner.classList.remove('hidden', 'toast-enter');
                void UI.DOM.backupReminderBanner.offsetWidth;
                UI.DOM.backupReminderBanner.classList.add('toast-enter');
            }
        };

        // Inicialização dos Listeners
        initializeAuthListeners(UI);
        initConfigListeners(); 
        initCatalogListeners();
        initAiListeners();
        initializeInventoryListeners({
            services: { saveInventoryItem, deleteInventoryItem, updateItemQuantity, getInventoryItems },
            ui: { renderInventoryModal, closeInventoryModal }
        });
        
        // [NOVO] Escuta Global de Rotas para Injeção de Widgets
        document.addEventListener('viewLoaded', (e) => {
            if (e.detail.viewName === 'orders') {
                renderLowStockWidget(getInventoryItems());
            }
        });
        
        // Variável global temporária para capturar o Router
        let systemRouter = null;

        initializeNavigationListeners(UI, {
            handleBackup,
            handleRestore,
            getOrders: getAllOrders,
            getTransactions: getAllTransactions,
            getConfig: () => userBankBalanceConfig,
            getState: () => ({ currentDashboardView, currentOrdersView }),
            setState: (newState) => {
                if (newState.currentDashboardView) currentDashboardView = newState.currentDashboardView;
                if (newState.currentOrdersView) currentOrdersView = newState.currentOrdersView;
            },
            // Função para capturar o loadRoute do navigationListeners
            exportRoute: (routeFn) => { systemRouter = routeFn; },
            
            // ⚠️ O LOCKDOWN: Reaplicado sempre que o HTML mudar
            reapplySecurity: () => {
                if (window.USER_ROLE === 'production') applyRoleRestrictions();
            },
            
            // Renderização do Estoque e Aplicação do RBAC no Motor de Rotas
            renderInventory: () => renderInventoryTable(getInventoryItems()),
            applyRoleRestrictions: () => {
                if (window.USER_ROLE === 'production') applyRoleRestrictions();
            },
            
            // Religa os ouvintes do financeiro ao injetar a tela
            rebindFinance: () => {
                initializeFinanceListeners(FinanceUIProxy, { 
                    services: {
                        saveTransaction, deleteTransaction, markTransactionAsPaid,
                        getAllTransactions, saveInitialBalance, getTransactionById,              
                        calculateTotalPendingRevenue, updateOrderDiscountFromFinance,
                        getAllOrders // <--- Permissão concedida para ler os pedidos!
                    },
                    getConfig: () => userBankBalanceConfig,
                    setConfig: (s) => { if (s.initialBalance !== undefined) userBankBalanceConfig.initialBalance = s.initialBalance; },
                    userCompanyName: () => userCompanyName // <--- Permissão concedida para ler o nome da fábrica!
                });
            }
        });

        initializeOrderListeners(UI, {
            getState: () => ({ partCounter }),
            setState: (newState) => {
                if (newState.partCounter !== undefined) partCounter = newState.partCounter;
                if (newState.currentOptionType) currentOptionType = newState.currentOptionType;
            },
            getOptionsFromStorage,
            services: {
                saveOrder, getOrderById, getAllOrders, deleteOrder,
                saveTransaction, deleteTransaction, getTransactionByOrderId,        
                getTransactionsByOrderId, deleteAllTransactionsByOrderId
            },
            userCompanyName: () => userCompanyName 
        });

       // O CÓDIGO CORRIGIDO (Copie e Cole isto no lugar)
// [FIX] Usamos Object.assign para criar uma cópia editável, pois módulos são Read-Only
const FinanceUIProxy = Object.assign({}, UI); 

FinanceUIProxy.renderFinanceDashboard = (transactions, config) => {
    const { startDate, endDate } = getCurrentDashboardDates();
    safeRenderFinance('ListenerProxy', transactions, config, calculateTotalPendingRevenue(startDate, endDate));
};

        initializeFinanceListeners(FinanceUIProxy, { 
            services: {
                saveTransaction, deleteTransaction, markTransactionAsPaid,
                getAllTransactions, saveInitialBalance, getTransactionById,              
                calculateTotalPendingRevenue, updateOrderDiscountFromFinance,
                getAllOrders // <--- Permissão concedida para ler os pedidos!
            },
            getConfig: () => userBankBalanceConfig,
            setConfig: (s) => { if (s.initialBalance !== undefined) userBankBalanceConfig.initialBalance = s.initialBalance; },
            userCompanyName: () => userCompanyName // <--- Permissão concedida para ler o nome da fábrica!
        });

        initializeModalAndPricingListeners(UI, {
            services: { getAllPricingItems, savePriceTableChanges, deletePriceItem },
            helpers: { getOptionsFromStorage, saveOptionsToStorage },
            getState: () => ({ currentOptionType })
        });

    } catch (error) {
        console.error("Critical Init Error:", error);
        document.body.innerHTML = `<div style="text-align:center;padding:50px;color:red"><h1>Erro de Inicialização</h1><p>Por favor, limpe o cache do navegador.</p><small>${error.message}</small></div>`;
    }
}
main();

// ==========================================================
// SCRIPTS DE UI GLOBAIS (Migrados do index.html)
// ==========================================================

// 1. Controle do Botão Flutuante (FAB)
// Colocamos no "window" para que o index.html consiga enxergar
window.toggleFab = function(show) {
    const fab = document.getElementById('fabContainer');
    const restore = document.getElementById('fabRestoreBtn');
    if (!fab || !restore) return;
    
    if (show) {
        fab.classList.remove('hidden');
        restore.classList.add('translate-x-full'); 
    } else {
        fab.classList.add('hidden');
        restore.classList.remove('translate-x-full');
    }
};

// 2. Consentimento de Cookies (Megafone Global agora substitui os Avisos de Atualização fixos)
document.addEventListener("DOMContentLoaded", () => {

    // --- GERENCIADOR DE CONSENTIMENTO (LGPD - Cookies) ---
    const cookieBanner = document.getElementById('cookieBanner');
    const cookieAcceptBtn = document.getElementById('cookieAcceptBtn');
    const CONSENT_KEY = 'paglucro_cookie_consent_v1';

    if (!localStorage.getItem(CONSENT_KEY)) {
        if (cookieBanner) {
            cookieBanner.classList.remove('hidden');
            cookieBanner.classList.add('animate-bounce-in-up'); 
        }
    }

    if (cookieAcceptBtn) {
        cookieAcceptBtn.addEventListener('click', () => {
            localStorage.setItem(CONSENT_KEY, 'true');
            cookieBanner.classList.add('hidden');
        });
    }
});
