// ==========================================================
// MÓDULO TEMPLATES (Fase 3 da Refatoração)
// Responsabilidade: Armazenar os fragmentos HTML (Templates)
// retirados do index.html para desfragmentar o DOM principal.
// ==========================================================

export const partTemplateHTML = `
<div class="part-item border p-4 rounded-md bg-gray-50 relative space-y-3 mb-4">
    <button type="button" class="remove-part-btn absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow hover:bg-red-600">&times;</button>
    
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div class="relative col-span-1 md:col-span-2 flex items-center">
            <input type="text" placeholder="Peça (ex: Camisa)" class="p-2 border rounded-md w-full part-type focus:ring-2 focus:ring-blue-500 outline-none" list="part-type-list">
            <button type="button" class="manage-options-btn p-1 absolute right-1 text-gray-400 hover:text-gray-600" data-type="partTypes">⚙️</button>
        </div>
        <div class="relative flex items-center">
            <input type="text" placeholder="Material" class="p-2 border rounded-md w-full part-material focus:ring-2 focus:ring-blue-500 outline-none" list="part-material-list">
            <button type="button" class="manage-options-btn p-1 absolute right-1 text-gray-400 hover:text-gray-600" data-type="materialTypes">⚙️</button>
        </div>
        <input type="text" placeholder="Cor" class="p-2 border rounded-md w-full part-color-main focus:ring-2 focus:ring-blue-500 outline-none">
    </div>

    <div class="mockup-dropzone mt-2 border-2 border-dashed border-gray-300 rounded-lg p-3 text-center bg-white hover:bg-gray-100 transition flex flex-col items-center justify-center cursor-pointer relative min-h-[80px]" tabindex="0">
        <div class="z-10 flex flex-col items-center pointer-events-none dropzone-content">
            <span class="text-xl mb-1">📎</span>
            <span class="text-xs text-gray-500 font-medium">Cole (Ctrl+V) ou Arraste a arte aqui</span>
        </div>
        <img class="mockup-preview hidden absolute inset-0 w-full h-full object-contain p-1 rounded-lg z-0 bg-white" src="" alt="Preview da Arte">
        <button type="button" class="remove-mockup-btn hidden absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow text-xs z-20 hover:bg-red-600" title="Remover Arte">&times;</button>
    </div>
    <div class="flex items-center space-x-2 pt-2 border-t mt-2">
        <span class="text-xs font-semibold text-gray-500 uppercase">Modo:</span>
        <button type="button" class="part-type-selector text-sm px-2 py-1 rounded" data-type="comum">Simples</button>
        <button type="button" class="part-type-selector text-sm px-2 py-1 rounded" data-type="detalhado">Grade Detalhada</button>
    </div>
    <div class="part-content-container mt-2"></div>
</div>`;

export const comumPartContentTemplateHTML = `<button type="button" class="toggle-sizes-btn mt-2 text-blue-600 text-sm font-semibold hover:underline">+ Mostrar Grade Padrão</button><div class="sizes-grid hidden mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2"></div><div class="border-t mt-4 pt-3"><div class="specific-sizes-list space-y-2"></div><button type="button" class="add-specific-size-btn mt-2 bg-gray-100 text-gray-700 text-xs font-bold uppercase py-2 px-3 rounded hover:bg-gray-200">+ Tamanho Personalizado</button></div>`;

export const specificSizeRowTemplateHTML = `<div class="specific-size-row grid grid-cols-12 gap-2 items-center"><div class="col-span-3"><input type="text" placeholder="L (cm)" class="p-1 border rounded w-full text-xs item-spec-width"></div><div class="col-span-3"><input type="text" placeholder="A (cm)" class="p-1 border rounded w-full text-xs item-spec-height"></div><div class="col-span-5"><input type="text" placeholder="Obs" class="p-1 border rounded w-full text-xs item-spec-obs"></div><div class="col-span-1 flex justify-center"><button type="button" class="remove-specific-row-btn text-red-400 hover:text-red-600 font-bold">&times;</button></div></div>`;

export const detalhadoPartContentTemplateHTML = `<div class="detailed-sizes-grid-container p-3 border border-gray-200 rounded-lg bg-white mb-4"><h4 class="font-bold text-xs text-gray-500 uppercase mb-2">1. Quantidade por Tamanho</h4></div><button type="button" class="generate-detailed-lines-btn mt-2 w-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold py-2 px-4 rounded-lg hover:bg-indigo-100 transition flex items-center justify-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" /></svg> 2. Gerar Lista de Nomes</button><div class="detailed-list-wrapper hidden mt-4 border-t pt-4"><div class="flex justify-between items-center mb-2"><h4 class="font-bold text-xs text-gray-500 uppercase">3. Nomes & Números</h4><button type="button" class="add-manual-detailed-row-btn text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">+ Linha Manual</button></div><div class="detailed-items-list space-y-2 mt-3 bg-gray-50 p-2 rounded border"></div></div>`;

export const financialRowTemplateHTML = `<div class="financial-item grid grid-cols-12 gap-2 items-center border-b pb-2 last:border-0"><div class="col-span-4 font-medium text-sm financial-part-name leading-tight"><span>Item</span><span class="block text-xs font-normal text-gray-400 price-group-label"></span></div><div class="col-span-2 text-center"><input type="number" class="p-1 border rounded w-full bg-gray-50 text-center text-sm financial-quantity" readonly></div><div class="col-span-3"><div class="flex items-center relative"><span class="text-gray-400 absolute left-1 text-xs">R$</span><input type="number" step="0.01" class="p-1 border rounded w-full pl-5 text-sm financial-price"></div></div><div class="col-span-3 text-right"><p class="font-bold text-sm text-gray-800 financial-subtotal">R$ 0,00</p></div></div>`;

// ==========================================================
// INÍCIO DO CÓDIGO NOVO: CRM - FICHA DE OURO
// ==========================================================
export const customerDashboardModalTemplateHTML = `
<div id="customerDashboardModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div class="bg-gray-50 border-b px-6 py-4 flex justify-between items-center">
            <div>
                <h2 class="text-xl font-bold text-gray-800" id="cdm-customer-name">Nome do Cliente</h2>
                <p class="text-sm text-gray-500 flex items-center gap-1 mt-1 font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                    <span id="cdm-customer-phone">(00) 00000-0000</span>
                </p>
            </div>
            <button type="button" class="close-customer-modal-btn text-gray-400 hover:text-red-500 transition focus:outline-none bg-gray-200 hover:bg-red-100 p-2 rounded-full">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>

        <div class="grid grid-cols-3 gap-3 p-5 bg-white border-b">
            <div class="bg-blue-50 rounded-lg p-3 text-center border border-blue-100 shadow-sm">
                <span class="block text-[10px] text-blue-500 font-bold uppercase tracking-wider">LTV (Total Gasto)</span>
                <span class="block text-xl font-black text-blue-700 mt-1" id="cdm-ltv">R$ 0,00</span>
            </div>
            <div class="bg-green-50 rounded-lg p-3 text-center border border-green-100 shadow-sm">
                <span class="block text-[10px] text-green-500 font-bold uppercase tracking-wider">Ticket Médio</span>
                <span class="block text-xl font-black text-green-700 mt-1" id="cdm-ticket">R$ 0,00</span>
            </div>
            <div class="bg-purple-50 rounded-lg p-3 text-center border border-purple-100 shadow-sm">
                <span class="block text-[10px] text-purple-500 font-bold uppercase tracking-wider">Última Compra</span>
                <span class="block text-lg font-bold text-purple-700 mt-1" id="cdm-last-date">--/--/----</span>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-5 bg-gray-100">
            <h3 class="text-xs font-bold text-gray-500 mb-3 uppercase border-b border-gray-200 pb-2">Histórico de Pedidos (<span id="cdm-total-orders">0</span>)</h3>
            <div id="cdm-orders-list" class="space-y-3">
                </div>
        </div>
        
    </div>
</div>`;

export const customerHistoryRowTemplateHTML = `
<div class="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center shadow-sm hover:shadow transition">
    <div>
        <div class="flex items-center gap-2 mb-1.5">
            <span class="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded cdm-row-date">00/00/0000</span>
            <span class="text-[10px] uppercase px-2 py-0.5 rounded font-bold cdm-row-status">Status</span>
        </div>
        <p class="text-sm font-semibold text-gray-800 cdm-row-desc leading-tight max-w-[250px] truncate" title="Descrição do pedido">Camisas e Bonés</p>
        <p class="text-xs text-gray-500 mt-1"><span class="cdm-row-pieces font-bold text-gray-700">0</span> peças • <span class="cdm-row-value font-bold text-green-600">R$ 0,00</span></p>
    </div>
    <button type="button" class="replicate-btn text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-3 py-2 rounded-md text-xs font-bold transition shadow-sm border border-blue-200" data-id="">
        <span class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
            Replicar
        </span>
    </button>
</div>`;
// ==========================================================
// FIM DO CÓDIGO NOVO
// ==========================================================

/**
 * Função utilitária para converter as strings HTML em elementos DOM reais.
 * Isso substitui o comportamento antigo do cloneNode(true).
 */
export function createNodeFromHTML(htmlString) {
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild; // Retorna o nó principal
}
