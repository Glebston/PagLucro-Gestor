// js/listeners/inventoryListeners.js
// ===================================================================================
// A VACINA SPA DO ALMOXARIFADO (GLOBAL DELEGATION) - CORRIGIDO (INJEÇÃO DE DEPENDÊNCIA)
// ===================================================================================

export const initializeInventoryListeners = (deps) => {
    // Extrai as funções injetadas pelo main.js
    const { saveInventoryItem, deleteInventoryItem, updateItemQuantity, getInventoryItems } = deps.services;
    const { renderInventoryModal, closeInventoryModal } = deps.ui;
    
    // ==========================================
    // ESCUTA GLOBAL DE CLIQUES
    // ==========================================
    document.addEventListener('click', async (e) => {
        
        // 1. Abrir Modal de Novo Insumo
        if (e.target.closest('#addInventoryItemBtn')) {
            e.preventDefault();
            renderInventoryModal();
        }

        // 2. Fechar Modal (X ou Cancelar)
        if (e.target.closest('#closeInventoryModalBtn') || e.target.closest('#cancelInvModalBtn')) {
            e.preventDefault();
            closeInventoryModal();
        }

        // 3. Botão de Adicionar Estoque (+)
        const btnIncrease = e.target.closest('.btn-increase-stock');
        if (btnIncrease) {
            e.preventDefault();
            const id = btnIncrease.getAttribute('data-id');
            await updateItemQuantity(id, +1);
        }

        // 4. Botão de Reduzir Estoque (-)
        const btnDecrease = e.target.closest('.btn-decrease-stock');
        if (btnDecrease) {
            e.preventDefault();
            const id = btnDecrease.getAttribute('data-id');
            await updateItemQuantity(id, -1);
        }

        // 5. Editar Insumo
        const btnEdit = e.target.closest('.btn-edit-item');
        if (btnEdit) {
            e.preventDefault();
            const id = btnEdit.getAttribute('data-id');
            const items = getInventoryItems();
            const item = items.find(i => i.id === id);
            if (item) renderInventoryModal(item);
        }

        // 6. Excluir Insumo
        const btnDelete = e.target.closest('.btn-delete-item');
        if (btnDelete) {
            e.preventDefault();
            const id = btnDelete.getAttribute('data-id');
            if (window.confirm("ALERTA: Tem certeza que deseja excluir permanentemente este insumo do estoque?")) {
                await deleteInventoryItem(id);
            }
        }
    });

    // ==========================================
    // ESCUTA GLOBAL DE FORMULÁRIOS (SUBMIT)
    // ==========================================
    document.addEventListener('submit', async (e) => {
        if (e.target.id === 'inventoryForm') {
            e.preventDefault();
            
            const id = document.getElementById('invItemId').value;
            const name = document.getElementById('invItemName').value;
            const quantity = Number(document.getElementById('invItemQty').value);
            const minQuantity = Number(document.getElementById('invItemMin').value);
            const unit = document.getElementById('invItemUnit').value;

            const itemData = {
                name,
                quantity,
                minQuantity,
                unit
            };

            try {
                // Feedback visual de carregamento no botão
                const submitBtn = e.target.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Salvando...`;
                submitBtn.disabled = true;

                await saveInventoryItem(itemData, id || null);
                closeInventoryModal();
            } catch (error) {
                console.error("Erro ao salvar insumo:", error);
                alert("Erro ao salvar. O Firebase bloqueou a ação (verifique se você tem permissão).");
                const submitBtn = e.target.querySelector('button[type="submit"]');
                submitBtn.innerHTML = "Tentar Novamente";
                submitBtn.disabled = false;
            }
        }
    });
};
