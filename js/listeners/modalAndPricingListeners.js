// js/listeners/modalAndPricingListeners.js

// v5.7.22: REMOVIDA importação estática de UI.
// import * as UI from '../ui.js';

/**
 * Inicializa os listeners para modais genéricos, tabela de preços e atalhos de teclado.
 * v5.7.22: A função agora recebe o módulo 'UI' injetado pelo main.js.
 * @param {object} UI - O módulo UI (injetado)
 * @param {object} deps - Dependências injetadas
 * @param {object} deps.services - Funções de serviço (getAllPricingItems, etc.)
 * @param {object} deps.helpers - Funções auxiliares (getOptionsFromStorage, etc.)
 * @param {Function} deps.getState - Getter para o estado (currentOptionType)
 */
export function initializeModalAndPricingListeners(UI, deps) {
    
    const { services, helpers, getState } = deps;

    // --- Listeners de Modais Genéricos e Opções ---

    // Botões de fechar/cancelar em modais diversos
    // v5.7.6: Removido 'cancelTransactionBtn' deste loop, pois agora é 
    // tratado especificamente em financeListeners.js
    [
        UI.DOM.infoModalCloseBtn, 
        // UI.DOM.cancelTransactionBtn, // REMOVIDO
        UI.DOM.cancelBalanceBtn, 
        UI.DOM.closeOptionsModalBtn, 
        UI.DOM.settlementCancelBtn
    ].forEach(button => {
        if (button) button.addEventListener('click', () => button.closest('.fixed').classList.add('hidden'));
    });

    // Modal de "Gerenciar Opções" (Tipos de Peça / Materiais)
    UI.DOM.addOptionBtn.addEventListener('click', () => {
        const newOption = UI.DOM.newOptionInput.value.trim();
        const { currentOptionType } = getState();
        
        if (newOption && currentOptionType) {
            let options = helpers.getOptionsFromStorage(currentOptionType);
            if (!options.includes(newOption)) {
                options.push(newOption);
                helpers.saveOptionsToStorage(currentOptionType, options);
                UI.populateDatalists(helpers.getOptionsFromStorage('partTypes'), helpers.getOptionsFromStorage('materialTypes'));
                UI.openOptionsModal(currentOptionType, options); // Reabre o modal atualizado
                UI.DOM.newOptionInput.value = '';
            }
        }
    });

    UI.DOM.optionsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-option-btn')) {
            const { currentOptionType } = getState();
            let options = helpers.getOptionsFromStorage(currentOptionType);
            options.splice(e.target.dataset.index, 1);
            helpers.saveOptionsToStorage(currentOptionType, options);
            UI.populateDatalists(helpers.getOptionsFromStorage('partTypes'), helpers.getOptionsFromStorage('materialTypes'));
            UI.openOptionsModal(currentOptionType, options); // Reabre o modal atualizado
        }
    });

    // --- Tabela de Preços ---
    UI.DOM.priceTableBtn.addEventListener('click', () => { 
        UI.renderPriceTable(services.getAllPricingItems(), 'view'); 
        
        // v5.7.6: Centralizado via modalHandler para aplicar o remendo de z-index
        UI.showPriceTableModal(); 
    });
    
    // v5.7.6: Centralizado via modalHandler
    UI.DOM.closePriceTableBtn.addEventListener('click', () => UI.hidePriceTableModal());
    
    UI.DOM.editPriceTableBtn.addEventListener('click', () => UI.renderPriceTable(services.getAllPricingItems(), 'edit'));
    UI.DOM.cancelPriceTableBtn.addEventListener('click', () => UI.renderPriceTable(services.getAllPricingItems(), 'view'));

    UI.DOM.addPriceItemBtn.addEventListener('click', () => { 
        const newItem = { id: `new-${Date.now()}` };
        UI.addPriceTableRow(newItem, 'edit');
    });

    UI.DOM.savePriceTableBtn.addEventListener('click', async () => {
        try {
            const itemsToSave = Array.from(document.getElementById('priceTableBody').querySelectorAll('tr'))
                .map(row => ({ 
                    id: row.dataset.id, 
                    name: row.querySelector('.price-item-name').value.trim(), 
                    description: row.querySelector('.price-item-desc').value.trim(), 
                    price: parseFloat(row.querySelector('.price-item-price').value) || 0
                }))
                .filter(item => item.name); // Salva apenas se tiver nome

            await services.savePriceTableChanges(itemsToSave);
            // O listener reativo (handlePricingChange) cuidará da UI
            UI.renderPriceTable(services.getAllPricingItems(), 'view');

        } catch (error) {
            console.error("Erro ao salvar tabela de preços:", error);
            UI.showInfoModal("Não foi possível salvar as alterações.");
        }
    });
    
    UI.DOM.priceTableContainer.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-price-item-btn');
        if (deleteBtn) {
            const row = deleteBtn.closest('tr');
            const itemId = row.dataset.id;
            
            if (itemId.startsWith('new-')) {
                UI.removePriceTableRow(itemId);
            } else {
                UI.showConfirmModal("Tem certeza que deseja excluir este item?", "Excluir", "Cancelar")
                  .then(ok => {
                      if (ok) services.deletePriceItem(itemId);
                  });
            }
        }
    });

    // --- Listener Global de Teclado para Atalhos (SPA Seguro) ---
    document.addEventListener('keydown', (event) => {
        // Helper interno para verificar visibilidade com segurança (evita erro de null)
        const isVisible = (element) => element && !element.classList.contains('hidden');

        // Atalho para confirmação (Enter)
        if (event.key === 'Enter') {
            if (isVisible(UI.DOM.confirmModal)) {
                if (UI.DOM.confirmOkBtn) UI.DOM.confirmOkBtn.click();
                event.preventDefault(); 
            } 
            else if (isVisible(UI.DOM.settlementModal)) {
                if (UI.DOM.settlementConfirmBtn) UI.DOM.settlementConfirmBtn.click();
                event.preventDefault();
            }
            else if (isVisible(UI.DOM.initialBalanceModal)) {
                if (UI.DOM.saveBalanceBtn) UI.DOM.saveBalanceBtn.click();
                event.preventDefault();
            } 
            else if (isVisible(UI.DOM.forgotPasswordModal)) {
                if (UI.DOM.sendResetEmailBtn) UI.DOM.sendResetEmailBtn.click();
                event.preventDefault();
            } 
            else if (isVisible(UI.DOM.infoModal)) {
                if (UI.DOM.infoModalCloseBtn) UI.DOM.infoModalCloseBtn.click();
            }
        }

        // Atalho para cancelamento/fechamento (Escape)
        if (event.key === 'Escape') {
            if (isVisible(UI.DOM.confirmModal)) {
                if (UI.DOM.confirmCancelBtn) UI.DOM.confirmCancelBtn.click();
            } 
            else if (isVisible(UI.DOM.settlementModal)) {
                if (UI.DOM.settlementCancelBtn) UI.DOM.settlementCancelBtn.click();
            }
            else if (isVisible(UI.DOM.initialBalanceModal)) {
                if (UI.DOM.cancelBalanceBtn) UI.DOM.cancelBalanceBtn.click();
            } 
            else if (isVisible(UI.DOM.forgotPasswordModal)) {
                if (UI.DOM.cancelResetBtn) UI.DOM.cancelResetBtn.click();
            } 
            else if (isVisible(UI.DOM.viewModal)) {
                const closeBtn = document.getElementById('closeViewBtn');
                if (closeBtn) closeBtn.click();
            } 
            else if (isVisible(UI.DOM.orderModal)) {
                if (UI.DOM.cancelBtn) UI.DOM.cancelBtn.click();
            } 
            else if (isVisible(UI.DOM.priceTableModal)) {
                if (isVisible(UI.DOM.cancelPriceTableBtn)) {
                    UI.DOM.cancelPriceTableBtn.click();
                } else if (UI.DOM.closePriceTableBtn) {
                    UI.DOM.closePriceTableBtn.click();
                }
            }
            else if (isVisible(UI.DOM.transactionModal)) {
                if (UI.DOM.cancelTransactionBtn) UI.DOM.cancelTransactionBtn.click();
            }
            else if (isVisible(UI.DOM.optionsModal)) {
                if (UI.DOM.closeOptionsModalBtn) UI.DOM.closeOptionsModalBtn.click();
            }
            else if (isVisible(UI.DOM.infoModal)) {
                if (UI.DOM.infoModalCloseBtn) UI.DOM.infoModalCloseBtn.click();
            }
        }
    });
}
