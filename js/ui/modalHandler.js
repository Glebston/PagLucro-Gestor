// ==========================================================
// MÓDULO MODAL HANDLER (v4.3.0)
// Responsabilidade: Gerenciar a exibição e lógica de 
// todos os modais da aplicação (Info, Confirm, Quitação, etc.)
// ==========================================================

// Importa o DOM do especialista dom.js
import { DOM, CHECK_ICON_SVG } from './dom.js';

// Importa a função de helper (v5.7.6: Corrigida importação de ui.js para helpers.js)
import { updateSourceSelectionUI } from './helpers.js';

// ========================================================
// [NOVO] MOTOR DE LAZY LOADING (CARREGAMENTO SOB DEMANDA)
// ========================================================
let isOrderModalLoaded = false;
let orderModalLoadPromise = null;

export const ensureOrderModalLoaded = async () => {
    if (isOrderModalLoaded) return;
    if (orderModalLoadPromise) return orderModalLoadPromise; // Evita chamadas duplicadas

    orderModalLoadPromise = (async () => {
        try {
            // 1. Busca o arquivo HTML fisicamente
            const response = await fetch('modals/orderModal.html');
            if (!response.ok) throw new Error('Falha ao buscar orderModal.html');
            const html = await response.text();

            // 2. Injeta no "terreno vazio" que deixamos no index.html
            document.getElementById('orderModalContainer').innerHTML = html;

            // 3. Reconecta os fios vitais do dom.js
            DOM.orderModal = document.getElementById('orderModal');
            DOM.orderForm = document.getElementById('orderForm');
            DOM.modalTitle = document.getElementById('modalTitle');
            DOM.orderId = document.getElementById('orderId');
            DOM.clientName = document.getElementById('clientName');
            DOM.clientPhone = document.getElementById('clientPhone');
            DOM.orderStatus = document.getElementById('orderStatus');
            DOM.orderDate = document.getElementById('orderDate');
            DOM.deliveryDate = document.getElementById('deliveryDate');
            DOM.mockupFiles = document.getElementById('mockupFiles');
            DOM.existingFilesContainer = document.getElementById('existingFilesContainer');
            DOM.partsContainer = document.getElementById('partsContainer');
            DOM.addPartBtn = document.getElementById('addPartBtn');
            DOM.generalObservation = document.getElementById('generalObservation');
            DOM.financialsContainer = document.getElementById('financialsContainer');
            DOM.downPayment = document.getElementById('downPayment');
            DOM.downPaymentDate = document.getElementById('downPaymentDate');
            DOM.downPaymentSourceContainer = document.getElementById('downPaymentSourceContainer');
            DOM.downPaymentStatusPago = document.querySelector('input[name="downPaymentStatus"][value="pago"]');
            DOM.downPaymentStatusAReceber = document.querySelector('input[name="downPaymentStatus"][value="a_receber"]');
            DOM.discount = document.getElementById('discount');
            DOM.grandTotal = document.getElementById('grandTotal');
            DOM.remainingTotal = document.getElementById('remainingTotal');
            DOM.cancelBtn = document.getElementById('cancelBtn');
            DOM.saveBtn = document.getElementById('saveBtn');
            DOM.uploadIndicator = document.getElementById('uploadIndicator');

            isOrderModalLoaded = true;
        } catch (error) {
            console.error("Erro no Carregamento Sob Demanda:", error);
            showInfoModal("Erro ao carregar a tela de pedidos. Verifique sua conexão.");
        }
    })();

    return orderModalLoadPromise;
};

// ========================================================
// [NOVO] MOTOR DE LAZY LOADING: CONFIGURAÇÕES (#settingsModal)
// ========================================================
let isSettingsModalLoaded = false;
let settingsModalLoadPromise = null;

export const ensureSettingsModalLoaded = async () => {
    if (isSettingsModalLoaded) return;
    if (settingsModalLoadPromise) return settingsModalLoadPromise;

    settingsModalLoadPromise = (async () => {
        try {
            // 1. Busca o arquivo HTML fisicamente
            const response = await fetch('modals/settingsModal.html');
            if (!response.ok) throw new Error('Falha ao buscar settingsModal.html');
            const html = await response.text();

            // 2. Injeta no "terreno vazio" que deixamos no index.html
            document.getElementById('settingsModalContainer').innerHTML = html;

            // 3. Atualiza a referência principal do DOM
            DOM.settingsModal = document.getElementById('settingsModal');

            isSettingsModalLoaded = true;
        } catch (error) {
            console.error("Erro no Carregamento Sob Demanda:", error);
            showInfoModal("Erro ao carregar as configurações. Verifique sua conexão.");
        }
    })();

    return settingsModalLoadPromise;
};

// ========================================================
// [NOVO] MOTOR DE LAZY LOADING: CATÁLOGO (#catalogModal)
// ========================================================
let isCatalogModalLoaded = false;
let catalogModalLoadPromise = null;

export const ensureCatalogModalLoaded = async () => {
    if (isCatalogModalLoaded) return;
    if (catalogModalLoadPromise) return catalogModalLoadPromise;

    catalogModalLoadPromise = (async () => {
        try {
            // 1. Busca o arquivo HTML fisicamente
            const response = await fetch('modals/catalogModal.html');
            if (!response.ok) throw new Error('Falha ao buscar catalogModal.html');
            const html = await response.text();

            // 2. Injeta no "terreno vazio" que deixamos no index.html
            document.getElementById('catalogModalContainer').innerHTML = html;

            // 3. Atualiza a referência principal do DOM
            DOM.catalogModal = document.getElementById('catalogModal');

            isCatalogModalLoaded = true;
        } catch (error) {
            console.error("Erro no Carregamento Sob Demanda do Catálogo:", error);
            showInfoModal("Erro ao carregar o catálogo. Verifique sua conexão.");
        }
    })();

    return catalogModalLoadPromise;
};
// ========================================================

export const showInfoModal = (message) => {
    DOM.infoModalMessage.textContent = message;
    DOM.infoModal.classList.remove('hidden');
};

export const showForgotPasswordModal = () => {
    return new Promise((resolve) => {
        DOM.resetEmailInput.value = '';
        DOM.forgotPasswordModal.classList.remove('hidden');
        DOM.resetEmailInput.focus();

        const handleSend = () => {
            cleanupAndResolve(DOM.resetEmailInput.value.trim());
        };

        const handleCancel = () => {
            cleanupAndResolve(null);
        };

        const cleanupAndResolve = (value) => {
            DOM.sendResetEmailBtn.removeEventListener('click', handleSend);
            DOM.cancelResetBtn.removeEventListener('click', handleCancel);
            DOM.forgotPasswordModal.classList.add('hidden');
            resolve(value);
        };

        DOM.sendResetEmailBtn.addEventListener('click', handleSend, { once: true });
        DOM.cancelResetBtn.addEventListener('click', handleCancel, { once: true });
    });
};

export const showConfirmModal = (message, okText = "OK", cancelText = "Cancelar") => {
    return new Promise((resolve) => {
        DOM.confirmModalMessage.textContent = message;
        DOM.confirmOkBtn.textContent = okText;
        DOM.confirmCancelBtn.textContent = cancelText;
        DOM.confirmModal.classList.remove('hidden');

        const confirmListener = () => resolvePromise(true);
        const cancelListener = () => resolvePromise(false);

        const resolvePromise = (value) => {
            DOM.confirmModal.classList.add('hidden');
            DOM.confirmOkBtn.removeEventListener('click', confirmListener);
            DOM.confirmCancelBtn.removeEventListener('click', cancelListener);
            resolve(value);
        };

        DOM.confirmOkBtn.addEventListener('click', confirmListener, { once: true });
        DOM.confirmCancelBtn.addEventListener('click', cancelListener, { once: true });
    });
};

export const showSettlementModal = (orderId, amount) => {
    return new Promise((resolve) => {
        DOM.settlementOrderId.value = orderId;
        DOM.settlementAmountDisplay.textContent = `R$ ${amount.toFixed(2)}`;
        DOM.settlementAmountDisplay.className = "text-3xl font-bold text-blue-700 mt-1 transition-all duration-300"; // Reseta cor
        DOM.settlementDate.value = new Date().toISOString().split('T')[0];
        
        // Define 'banco' como padrão ao abrir
        updateSourceSelectionUI(DOM.settlementSourceContainer, 'banco');

        // [NOVO] Captura os campos e reseta os valores
        const discountInput = document.getElementById('settlementDiscount');
        const surchargeInput = document.getElementById('settlementSurcharge');
        if(discountInput) discountInput.value = '';
        if(surchargeInput) surchargeInput.value = '';
        
        let finalAmount = amount;

        // [NOVO] Função para recalcular o visor em tempo real
        const calculateTotals = () => {
            const disc = parseFloat(discountInput?.value) || 0;
            const surc = parseFloat(surchargeInput?.value) || 0;
            finalAmount = amount - disc + surc;
            
            DOM.settlementAmountDisplay.textContent = `R$ ${finalAmount.toFixed(2)}`;
            
            // Mágica visual de cores
            if (finalAmount < amount) {
                DOM.settlementAmountDisplay.className = "text-3xl font-bold text-green-600 mt-1 transition-all duration-300 scale-105";
            } else if (finalAmount > amount) {
                DOM.settlementAmountDisplay.className = "text-3xl font-bold text-red-600 mt-1 transition-all duration-300 scale-105";
            } else {
                DOM.settlementAmountDisplay.className = "text-3xl font-bold text-blue-700 mt-1 transition-all duration-300";
            }
        };

        DOM.settlementModal.classList.remove('hidden');
        DOM.settlementDate.focus(); 

        const handleConfirm = () => {
            const selectedSourceEl = DOM.settlementSourceContainer.querySelector('.source-selector.active');
            if (!selectedSourceEl) {
                const container = DOM.settlementSourceContainer;
                container.classList.add('ring-2', 'ring-red-500', 'rounded-md');
                setTimeout(() => container.classList.remove('ring-2', 'ring-red-500', 'rounded-md'), 1000);
                return;
            }
            
            // [NOVO] Retornamos o pacote completo para o Cérebro processar
            const data = {
                date: DOM.settlementDate.value,
                source: selectedSourceEl.dataset.source,
                discountAdded: parseFloat(discountInput?.value) || 0,
                surchargeAdded: parseFloat(surchargeInput?.value) || 0,
                finalAmount: finalAmount
            };
            cleanupAndResolve(data);
        };

        const handleCancel = () => {
            cleanupAndResolve(null);
        };
        
        const handleSourceClick = (e) => {
             const target = e.target.closest('.source-selector');
             if (target) {
                updateSourceSelectionUI(DOM.settlementSourceContainer, target.dataset.source);
             }
        };

        const cleanupAndResolve = (value) => {
            DOM.settlementModal.classList.add('hidden');
            DOM.settlementConfirmBtn.removeEventListener('click', handleConfirm);
            DOM.settlementCancelBtn.removeEventListener('click', handleCancel);
            DOM.settlementSourceContainer.removeEventListener('click', handleSourceClick);
            // Limpa os listeners para não vazar memória
            if(discountInput) discountInput.removeEventListener('input', calculateTotals);
            if(surchargeInput) surchargeInput.removeEventListener('input', calculateTotals);
            resolve(value);
        };

        DOM.settlementConfirmBtn.addEventListener('click', handleConfirm, { once: false });
        DOM.settlementCancelBtn.addEventListener('click', handleCancel, { once: true });
        DOM.settlementSourceContainer.addEventListener('click', handleSourceClick);
        
        // [NOVO] Escuta as digitações para fazer a matemática instantânea
        if(discountInput) discountInput.addEventListener('input', calculateTotals);
        if(surchargeInput) surchargeInput.addEventListener('input', calculateTotals);
    });
};

// ========================================================
// v5.7.6: INÍCIO - Funções adicionadas para modais com bug de z-index
// Estes são os modais com z-50 que conflitam com o banner z-50
// ========================================================

/**
 * (v5.7.6) Abre o modal de Pedido e aplica o remendo de z-index.
 */
export const showOrderModal = () => {
    if (DOM.orderModal) { // Proteção de segurança caso o lazy load atrase
        DOM.orderModal.style.zIndex = '55'; 
        DOM.orderModal.classList.remove('hidden');
    }
};

/**
 * (v5.7.6) Fecha o modal de Pedido.
 */
export const hideOrderModal = () => {
    if (DOM.orderModal) {
        DOM.orderModal.classList.add('hidden');
    }
};

/**
 * (v5.7.6) Abre o modal de Transação e aplica o remendo de z-index.
 */
export const showTransactionModal = () => {
    DOM.transactionModal.style.zIndex = '55'; // Remendo JS para sobrepor CSS em cache
    DOM.transactionModal.classList.remove('hidden');
};

/**
 * (v5.7.6) Fecha o modal de Transação.
 */
export const hideTransactionModal = () => {
    DOM.transactionModal.classList.add('hidden');
};

/**
 * (v5.7.6) Abre o modal de Tabela de Preços e aplica o remendo de z-index.
 */
export const showPriceTableModal = () => {
    DOM.priceTableModal.style.zIndex = '55'; // Remendo JS para sobrepor CSS em cache
    DOM.priceTableModal.classList.remove('hidden');
};

/**
 * (v5.7.6) Fecha o modal de Tabela de Preços.
 */
export const hidePriceTableModal = () => {
    DOM.priceTableModal.classList.add('hidden');
};

/**
 * (v5.7.6) Abre o modal de Visualização (Detalhes do Pedido) e aplica o remendo de z-index.
 */
export const showViewModal = () => {
    DOM.viewModal.style.zIndex = '55'; // Remendo JS para sobrepor CSS em cache
    DOM.viewModal.classList.remove('hidden');
};

/**
 * (v5.7.6) Fecha o modal de Visualização.
 */
export const hideViewModal = () => {
    DOM.viewModal.classList.add('hidden');
};

// ========================================================
// v5.7.6: FIM - Funções adicionadas
// ========================================================
