// js/ui/inventoryRenderer.js
// ===================================================================================
// O DESENHISTA DO ALMOXARIFADO (RENDERER)
// ===================================================================================

export const renderInventoryTable = (items) => {
    // Lei do Lazy Loading: Busca o elemento no exato momento da injeção
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return; // Se a tela não estiver ativa no DOM, aborta silenciosamente

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-500 italic">Nenhum insumo cadastrado no estoque.</td></tr>`;
        return;
    }

    // Ordena alfabeticamente
    const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name));

    tbody.innerHTML = sortedItems.map(item => {
        const isLowStock = Number(item.quantity) <= Number(item.minQuantity);
        
        return `
        <tr class="hover:bg-slate-50 transition border-b border-gray-100 group" data-id="${item.id}">
            <td class="p-4">
                <div class="font-semibold text-gray-800">${item.name}</div>
                <div class="text-xs text-gray-400 mt-1">
                    Alerta em: ${item.minQuantity || 0} ${item.unit || 'un'}
                    ${item.updatedBy ? `<br>Modificado por: <span class="text-gray-500">${item.updatedBy.split('@')[0]}</span>` : ''}
                </div>
            </td>
            <td class="p-4 text-center">
                <span class="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold shadow-sm ${isLowStock ? 'bg-red-100 text-red-700 ring-1 ring-red-300' : 'bg-green-100 text-green-700'}">
                    ${item.quantity || 0} ${item.unit || 'un'}
                </span>
            </td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-3">
                    <button class="btn-decrease-stock w-10 h-10 rounded-full bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-600 font-bold transition flex items-center justify-center shadow-sm transform active:scale-90" data-id="${item.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
                    </button>
                    <button class="btn-increase-stock w-10 h-10 rounded-full bg-white border border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200 text-gray-600 font-bold transition flex items-center justify-center shadow-sm transform active:scale-90" data-id="${item.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
            </td>
            <td class="p-4 text-right admin-only-element">
                <button class="btn-edit-item text-blue-500 hover:text-blue-700 mx-2 transition p-2 hover:bg-blue-50 rounded-lg" title="Editar" data-id="${item.id}">✏️</button>
                <button class="btn-delete-item text-red-500 hover:text-red-700 transition p-2 hover:bg-red-50 rounded-lg" title="Excluir" data-id="${item.id}">🗑️</button>
            </td>
        </tr>
    `}).join('');
};

export const renderInventoryModal = (item = null) => {
    const modalContainer = document.getElementById('viewModal');
    if (!modalContainer) return;

    const isEdit = !!item;
    
    // Injeção Dinâmica do Modal
    modalContainer.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full relative animate-fade-in border-t-4 border-blue-600">
            <button id="closeInventoryModalBtn" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition bg-gray-50 hover:bg-gray-100 rounded-full p-1">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <h3 class="text-xl font-bold mb-1 text-gray-800">${isEdit ? 'Editar Insumo' : 'Novo Insumo'}</h3>
            <p class="text-sm text-gray-500 mb-6">Preencha os dados do material para o controle da fábrica.</p>
            
            <form id="inventoryForm" class="space-y-4">
                <input type="hidden" id="invItemId" value="${item ? item.id : ''}">
                
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-1">Nome do Insumo</label>
                    <input type="text" id="invItemName" class="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm" placeholder="Ex: Tecido DryFit, Tinta Preta" value="${item ? item.name : ''}" required>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Qtd Inicial</label>
                        <input type="number" step="0.01" id="invItemQty" class="w-full border border-gray-300 p-2.5 rounded-lg shadow-sm" value="${item ? item.quantity : '0'}" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Unidade</label>
                        <select id="invItemUnit" class="w-full border border-gray-300 p-2.5 rounded-lg bg-white shadow-sm">
                            <option value="un" ${item && item.unit === 'un' ? 'selected' : ''}>Unidades</option>
                            <option value="kg" ${item && item.unit === 'kg' ? 'selected' : ''}>Kg</option>
                            <option value="m" ${item && item.unit === 'm' ? 'selected' : ''}>Metros</option>
                            <option value="L" ${item && item.unit === 'L' ? 'selected' : ''}>Litros</option>
                            <option value="rolos" ${item && item.unit === 'rolos' ? 'selected' : ''}>Rolos</option>
                            <option value="caixas" ${item && item.unit === 'caixas' ? 'selected' : ''}>Caixas</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-1">Estoque Mínimo (Alerta)</label>
                    <input type="number" step="0.01" id="invItemMin" class="w-full border border-gray-300 p-2.5 rounded-lg shadow-sm" placeholder="Avisar quando chegar em..." value="${item ? item.minQuantity : '5'}" required>
                </div>
                
                <div class="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button type="button" id="cancelInvModalBtn" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold transition">Cancelar</button>
                    <button type="submit" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition shadow-md flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                        Salvar Insumo
                    </button>
                </div>
            </form>
        </div>
    `;
    
    modalContainer.classList.remove('hidden');
};

export const closeInventoryModal = () => {
    const modalContainer = document.getElementById('viewModal');
    if (modalContainer) {
        modalContainer.classList.add('hidden');
        modalContainer.innerHTML = ''; // Limpa o DOM fantasma
    }
};

// ==========================================
// WIDGET DE ALERTA DE ESTOQUE (CHEFIA)
// ==========================================
export const renderLowStockWidget = (items) => {
    // 1. Remove o widget antigo da tela para não duplicar
    const oldWidget = document.getElementById('lowStockWidgetContainer');
    if (oldWidget) oldWidget.remove();

    // 2. Proteção RBAC: Produção não precisa ver alertas de compras
    if (window.USER_ROLE === 'production') return;

    // 3. Filtra os itens críticos
    const lowStockItems = items.filter(item => Number(item.quantity) <= Number(item.minQuantity));

    // [INTELIGÊNCIA DE SESSÃO] Se o estoque normalizou, reseta a memória do aviso
    if (lowStockItems.length === 0) {
        sessionStorage.removeItem('hideLowStockWarning');
        return;
    }

    // [INTELIGÊNCIA DE SESSÃO] Se a chefia já clicou para ver nesta sessão, não desenha de novo
    if (sessionStorage.getItem('hideLowStockWarning') === 'true') return;

    // 4. Encontra o topo da tela do Kanban
    const mainView = document.getElementById('mainViewContainer');
    if (!mainView) return;

    // 5. Constrói e injeta o visual do Widget com Tailwind
    const widgetHTML = `
        <div id="lowStockWidgetContainer" class="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-sm animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between relative">
            
            <button onclick="sessionStorage.setItem('hideLowStockWarning', 'true'); document.getElementById('lowStockWidgetContainer').remove();" class="absolute top-2 right-2 text-red-400 hover:text-red-600 transition p-1" title="Fechar aviso">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <div class="flex items-center gap-3 pr-8 mb-3 sm:mb-0">
                <div class="bg-red-100 p-2 rounded-full text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-red-800">Alerta de Reposição de Estoque</h3>
                    <p class="text-sm text-red-600 mt-1">
                        ${lowStockItems.length === 1 
                            ? `O insumo <strong>${lowStockItems[0].name}</strong> chegou ao limite de segurança.` 
                            : `Você possui <strong>${lowStockItems.length} insumos</strong> com estoque crítico.`}
                    </p>
                </div>
            </div>
            
            <button onclick="sessionStorage.setItem('hideLowStockWarning', 'true'); document.getElementById('navInventoryBtn').click()" class="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition shadow-sm w-full sm:w-auto text-center">
                Verificar Estoque
            </button>
        </div>
    `;

    mainView.insertAdjacentHTML('afterbegin', widgetHTML);
};
