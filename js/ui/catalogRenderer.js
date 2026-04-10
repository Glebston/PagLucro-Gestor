// js/ui/catalogRenderer.js
// ========================================================
// RENDERIZADOR DE UI (CATÁLOGO)
// Responsabilidade: Transformar dados JSON em HTML visual (Cards)
// ========================================================

// [PROTEÇÃO SPA] Helper para buscar elementos em tempo real
const getDOM = () => ({
    list: document.getElementById('catalogList'),
    countDisplay: document.getElementById('catalogCountDisplay'),
    activeDisplay: document.getElementById('activeCountDisplay'),
    publicLink: document.getElementById('publicStoreLink')
});

/**
 * Renderiza a grade de produtos e atualiza os contadores
 * @param {Object} data - Objeto retornado pelo catalogService.getCatalogItems
 * @param {string} companyId - UID da empresa para gerar o link público
 */
export function renderCatalogUI(data, companyId) {
    const { items, totalCount, activeCount } = data;
    const currentDOM = getDOM(); // Busca a tela fresca

    // 1. Atualiza Contadores e Link (Protegido contra null)
    updateStats(totalCount, activeCount, currentDOM);
    updatePublicLink(companyId, activeCount, currentDOM);

    if (!currentDOM.list) return; // Escudo ativado

    // 2. Limpa a lista atual
    currentDOM.list.innerHTML = '';

    // 3. Estado Vazio (Nenhum produto cadastrado)
    if (items.length === 0) {
        currentDOM.list.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                <div class="bg-gray-50 p-4 rounded-full mb-3">
                    <svg class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <h3 class="text-lg font-medium text-gray-900">Seu catálogo está vazio</h3>
                <p class="text-sm">Cadastre seu primeiro produto para ativar sua loja.</p>
            </div>
        `;
        return;
    }

    // 4. Renderiza os Cards
    const htmlBuffer = items.map(item => createCardHTML(item)).join('');
    currentDOM.list.innerHTML = htmlBuffer;
}

// --- FUNÇÕES AUXILIARES (PRIVADAS) ---

function updateStats(total, active, currentDOM) {
    if (currentDOM.countDisplay) {
        // Contador de Armazenamento (Total)
        currentDOM.countDisplay.textContent = `${total}/30`;
        if (total >= 30) {
            currentDOM.countDisplay.className = "text-lg font-bold text-red-600"; // Alerta visual
        } else {
            currentDOM.countDisplay.className = "text-sm text-blue-600";
        }
    }

    if (currentDOM.activeDisplay) {
        // Contador de Vitrine (Ativos)
        currentDOM.activeDisplay.textContent = `${active}/20`;
        if (active >= 20) {
            currentDOM.activeDisplay.className = "text-lg font-bold text-orange-500"; // Alerta visual
        } else {
            currentDOM.activeDisplay.className = "text-sm text-green-600";
        }
    }
}

function updatePublicLink(companyId, activeCount, currentDOM) {
    if (!currentDOM.publicLink) return;

    // Só mostra o link se tiver pelo menos 1 item ativo
    if (activeCount > 0) {
        const link = `catalogo.html?uid=${companyId}`;
        currentDOM.publicLink.href = link;
        currentDOM.publicLink.classList.remove('hidden');
    } else {
        currentDOM.publicLink.classList.add('hidden');
    }
}

function createCardHTML(item) {
    // Lógica visual de Status
    const isChecked = item.isActive ? 'checked' : '';
    const statusClass = item.isActive ? 'border-green-500 ring-1 ring-green-100' : 'border-gray-200 opacity-90';
    const statusLabel = item.isActive ? '<span class="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Na Vitrine</span>' : '<span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Rascunho</span>';

    // Tratamento de Preço (se vazio, não mostra)
    const priceDisplay = item.price ? `<p class="text-sm font-bold text-gray-800 mt-1">${item.price}</p>` : '';

    return `
        <div class="bg-white rounded-xl shadow-sm border ${statusClass} flex flex-col overflow-hidden transition hover:shadow-md group relative">
            
            <div class="h-48 w-full bg-gray-100 relative overflow-hidden">
                <img src="${item.imageUrl}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                <div class="absolute top-2 right-2">
                    ${statusLabel}
                </div>
            </div>

            <div class="p-4 flex-1 flex flex-col">
                <div class="flex-1">
                    <span class="text-[10px] font-bold text-purple-600 uppercase tracking-wide">${item.category || 'Geral'}</span>
                    <h3 class="text-base font-semibold text-gray-900 leading-tight mb-1 truncate" title="${item.title}">${item.title}</h3>
                    ${priceDisplay}
                    <p class="text-xs text-gray-500 mt-2 line-clamp-2" title="${item.description}">${item.description || 'Sem descrição.'}</p>
                </div>

                <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    
                    <div class="flex items-center" title="Exibir na Vitrine">
                        <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" name="toggle" id="toggle_${item.id}" class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer" ${isChecked} data-id="${item.id}" data-action="toggleStatus"/>
                            <label for="toggle_${item.id}" class="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <button class="text-gray-400 hover:text-blue-600 transition p-1" data-id="${item.id}" data-action="editItem" title="Editar">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button class="text-gray-400 hover:text-red-600 transition p-1" data-id="${item.id}" data-action="deleteItem" title="Excluir">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
