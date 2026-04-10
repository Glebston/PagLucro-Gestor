// js/ui/formHandler.js
// ==========================================================
// MÓDULO FORM HANDLER (v5.8.0 - Reorder Support)
// Responsabilidade: Gerenciar toda a lógica interna do
// modal de Pedidos, incluindo lista dinâmica e Reordenamento.
// ==========================================================

import { DOM } from './dom.js';
import { updateSourceSelectionUI } from './helpers.js';
import { 
    partTemplateHTML, 
    comumPartContentTemplateHTML, 
    specificSizeRowTemplateHTML, 
    detalhadoPartContentTemplateHTML, 
    financialRowTemplateHTML 
} from './templates.js';
import { initializeRadar, checkCapacityWarning } from './deliveryRadar.js';

// Utilitário interno para converter a string HTML em um DocumentFragment (idêntico ao comportamento antigo)
const getFragment = (htmlString) => {
    const template = document.createElement('template');
    template.innerHTML = htmlString;
    return template.content.cloneNode(true);
};

// Estado local para gerenciar a lista de pagamentos antes de salvar
let currentPaymentsList = [];

// API para o Listener pegar os dados
export const getPaymentList = () => [...currentPaymentsList];
export const setPaymentList = (list) => { 
    currentPaymentsList = list || []; 
    renderPaymentManager();
    updateFinancials();
};

const renderPaymentManager = () => {
    // 1. Identifica ou Cria o Container da Lista
    let managerContainer = document.getElementById('payment-list-manager');
    
    // Se não existir, injetamos logo após o container de inputs original (para não quebrar layout HTML)
    if (!managerContainer) {
        // Escondemos os inputs originais visualmente (mas mantemos no DOM por segurança)
        if (DOM.downPayment) DOM.downPayment.parentElement.style.display = 'none';
        if (DOM.downPaymentDate) DOM.downPaymentDate.parentElement.style.display = 'none';
        if (DOM.downPaymentSourceContainer) DOM.downPaymentSourceContainer.style.display = 'none';
        
        // O container "Pai" onde tudo vive (Adiantamento / Sinal)
        const parentSection = DOM.downPayment ? DOM.downPayment.closest('.border') : null;
        
        if (parentSection) {
            managerContainer = document.createElement('div');
            managerContainer.id = 'payment-list-manager';
            managerContainer.className = 'mt-2 space-y-3';
            parentSection.appendChild(managerContainer);
        }
    }

    if (!managerContainer) return; // Fallback se o HTML for muito diferente

    // 2. Calcula Totais
    const totalPaid = currentPaymentsList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

    // 3. Renderiza o HTML da Lista
    managerContainer.innerHTML = `
        <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div class="flex flex-wrap gap-2 items-end mb-3 border-b pb-3 border-gray-200">
                <div class="flex-1 min-w-[120px]">
                    <label class="block text-xs font-bold text-gray-500 mb-1">Valor (R$)</label>
                    <input type="number" id="new-pay-amount" class="w-full p-2 border rounded text-sm" placeholder="0.00">
                </div>
                <div class="w-[130px]">
                    <label class="block text-xs font-bold text-gray-500 mb-1">Data</label>
                    <input type="date" id="new-pay-date" class="w-full p-2 border rounded text-sm" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="w-[100px]">
                    <label class="block text-xs font-bold text-gray-500 mb-1">Conta</label>
                    <select id="new-pay-source" class="w-full p-2 border rounded text-sm bg-white">
                        <option value="banco">Banco</option>
                        <option value="caixa">Caixa</option>
                    </select>
                </div>
                <button type="button" id="btn-add-payment" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 transition-colors h-[38px] w-[38px] flex items-center justify-center" title="Adicionar Pagamento">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                </button>
            </div>

            <div class="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                ${currentPaymentsList.length === 0 ? '<p class="text-xs text-gray-400 text-center italic py-2">Nenhum pagamento lançado.</p>' : ''}
                ${currentPaymentsList.map((p, index) => `
                    <div class="flex justify-between items-center bg-white p-2 rounded border border-gray-100 shadow-sm text-sm">
                        <div class="flex items-center space-x-3">
                            <span class="font-mono text-gray-500 text-xs">${new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <span class="font-bold text-gray-700">R$ ${parseFloat(p.amount).toFixed(2)}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full ${p.source === 'banco' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${p.source === 'banco' ? 'Banco' : 'Caixa'}</span>
                        </div>
                        <button type="button" class="text-red-400 hover:text-red-600 p-1 btn-remove-payment" data-index="${index}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                        </button>
                    </div>
                `).join('')}
            </div>
            
            <div class="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center">
                <span class="text-xs font-bold text-gray-500 uppercase">Total Pago</span>
                <span class="text-lg font-bold text-green-600">R$ ${totalPaid.toFixed(2)}</span>
            </div>
        </div>
    `;

    // 4. Listeners da Lista (Adicionar e Remover)
    const addBtn = managerContainer.querySelector('#btn-add-payment');
    const amountInput = managerContainer.querySelector('#new-pay-amount');
    const dateInput = managerContainer.querySelector('#new-pay-date');
    const sourceInput = managerContainer.querySelector('#new-pay-source');

    addBtn.addEventListener('click', () => {
        const amount = parseFloat(amountInput.value);
        if (!amount || amount <= 0) return alert('Digite um valor válido.');
        
        currentPaymentsList.push({
            id: null, // Novo pagamento não tem ID ainda
            amount: amount,
            date: dateInput.value,
            source: sourceInput.value,
            status: 'pago' // Assumimos pago ao lançar aqui
        });
        
        renderPaymentManager();
        updateFinancials();
    });

    managerContainer.querySelectorAll('.btn-remove-payment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            currentPaymentsList.splice(index, 1);
            renderPaymentManager();
            updateFinancials();
        });
    });
};

export const updateFinancials = () => {
    let subtotal = 0;
    DOM.financialsContainer.querySelectorAll('.financial-item').forEach(item => {
        const quantity = parseFloat(item.querySelector('.financial-quantity').value) || 0;
        const price = parseFloat(item.querySelector('.financial-price').value) || 0;
        const itemSubtotal = quantity * price;
        item.querySelector('.financial-subtotal').textContent = `R$ ${itemSubtotal.toFixed(2)}`;
        subtotal += itemSubtotal;

        // --- INÍCIO: ZONA 3 (Cérebro do Raio-X em Tempo Real) ---
        const partId = item.dataset.partId;
        const partElement = document.querySelector(`.part-item[data-part-id="${partId}"]`);
        const raioXPanel = item.querySelector('.raio-x-panel');
        
        if (partElement && partElement._outsourcedCosts && partElement._outsourcedCosts.length > 0) {
            // Soma todo o custo terceirizado unitário desta peça
            const unitOutsourcedCost = partElement._outsourcedCosts.reduce((acc, c) => acc + (parseFloat(c.unitCost) || 0), 0);
            
            // 🧮 NOVOS CÁLCULOS COM BASE NA QUANTIDADE
            const totalOutsourcedCost = unitOutsourcedCost * quantity;
            const totalSobra = itemSubtotal - totalOutsourcedCost; // itemSubtotal já é (price * quantity)
            
            // Exibe o painel
            raioXPanel.classList.remove('hidden');
            
            // Atualiza os 3 valores na tela
            if (item.querySelector('.raio-x-subtotal')) {
                item.querySelector('.raio-x-subtotal').textContent = `R$ ${itemSubtotal.toFixed(2)}`;
            }
            item.querySelector('.raio-x-cost').textContent = `R$ ${totalOutsourcedCost.toFixed(2)}`;
            
            const profitElement = item.querySelector('.raio-x-profit');
            profitElement.textContent = `Sobra Fábrica Total: R$ ${totalSobra.toFixed(2)}`;
            
            // Proteção Visual Inteligente (Avaliando a sobra total)
            if (price > 0 && totalSobra <= 0) {
                // Alerta Vermelho: Prejuízo ou Empate
                profitElement.className = 'font-bold px-2 py-1 rounded raio-x-profit bg-red-100 text-red-700 border border-red-300';
            } else if (price > 0 && totalSobra > 0) {
                // Alerta Verde: Lucro
                profitElement.className = 'font-bold px-2 py-1 rounded raio-x-profit bg-green-100 text-green-700 border border-green-200';
            } else {
                profitElement.className = 'font-bold px-2 py-1 rounded raio-x-profit bg-gray-200 text-gray-500';
            }
        } else if (raioXPanel) {
            raioXPanel.classList.add('hidden');
        }
        // --- FIM: ZONA 3 ---
    });

    const discount = parseFloat(DOM.discount.value) || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    
    // v5.0: Calcula o total baseado na nova lista
    const downPayment = currentPaymentsList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

    // [CORREÇÃO] Sincronização Completa com o Legado
    // Isso garante que, mesmo que o sistema salve do jeito antigo, salve os dados certos.
    if (DOM.downPayment) {
        DOM.downPayment.value = downPayment > 0 ? downPayment : '';
    }

    // Se houver pagamentos na lista, pegamos o último para atualizar a "Fonte" e "Data" legadas
    if (currentPaymentsList.length > 0) {
        const lastPayment = currentPaymentsList[currentPaymentsList.length - 1];
        
        // 1. Sincroniza a Data Antiga
        if (DOM.downPaymentDate) {
            DOM.downPaymentDate.value = lastPayment.date;
        }

        // 2. Sincroniza a Fonte Antiga (Caixa/Banco)
        // O ID geralmente é 'paymentFinSource' ou 'downPaymentSource'. Tentamos achar ambos.
        const legacySourceSelect = document.getElementById('paymentFinSource') || document.getElementById('downPaymentSource');
        if (legacySourceSelect) {
            legacySourceSelect.value = lastPayment.source; // 'caixa' ou 'banco'
        }
    }

    DOM.grandTotal.textContent = `R$ ${grandTotal.toFixed(2)}`;
    DOM.remainingTotal.textContent = `R$ ${(grandTotal - downPayment).toFixed(2)}`;
};

const createFinancialRow = (partId, name, quantity, priceGroup) => {
    const finTpl = getFragment(financialRowTemplateHTML);
    const finItem = finTpl.querySelector('.financial-item');
    finItem.dataset.partId = partId;
    finItem.dataset.priceGroup = priceGroup;

    finItem.querySelector('.financial-part-name > span:first-child').textContent = name;
    const label = priceGroup === 'standard' ? '(Padrão)' : priceGroup === 'specific' ? '(Específico)' : '';
    finItem.querySelector('.price-group-label').textContent = label;

    finItem.querySelector('.financial-quantity').value = quantity;
    finItem.querySelector('.financial-price').addEventListener('input', updateFinancials);

    // --- INÍCIO: ZONA 2 (Painel do Raio-X Invisível) ---
    const raioXHtml = `
        <div class="col-span-12 hidden raio-x-panel mt-1 p-2.5 rounded text-xs border bg-gray-50 flex flex-wrap justify-between items-center transition-all shadow-inner gap-2">
            <span class="font-medium text-gray-700">Valor Total: <b class="raio-x-subtotal">R$ 0,00</b></span>
            <span class="font-medium text-gray-600">Custo Terceirizado Total: <b class="raio-x-cost text-red-500">R$ 0,00</b></span>
            <span class="font-bold px-2 py-1 rounded raio-x-profit">Sobra Fábrica Total: R$ 0,00</span>
        </div>
    `;
    finItem.insertAdjacentHTML('beforeend', raioXHtml);
    // --- FIM: ZONA 2 ---

    return finItem;
};

export const renderFinancialSection = () => {
    const existingPrices = new Map();
    DOM.financialsContainer.querySelectorAll('.financial-item').forEach(item => {
        const partId = item.dataset.partId;
        const priceGroup = item.dataset.priceGroup;
        const price = item.querySelector('.financial-price').value;
        if (price) { 
            existingPrices.set(`${partId}-${priceGroup}`, price);
        }
    });

    DOM.financialsContainer.innerHTML = '';
    
    DOM.partsContainer.querySelectorAll('.part-item').forEach(partItem => {
        const partId = partItem.dataset.partId;
        const partName = partItem.querySelector('.part-type').value || `Peça ${partId}`;
        const partType = partItem.dataset.partType;

        if (partType === 'comum') {
            let standardQty = 0;
            partItem.querySelectorAll('.size-input').forEach(input => {
                standardQty += parseInt(input.value) || 0;
            });
            const specificQty = partItem.querySelectorAll('.specific-size-row').length;

            if (standardQty > 0) {
                const finRow = createFinancialRow(partId, partName, standardQty, 'standard');
                const key = `${partId}-standard`;
                if (existingPrices.has(key)) finRow.querySelector('.financial-price').value = existingPrices.get(key);
                DOM.financialsContainer.appendChild(finRow);
            }
            if (specificQty > 0) {
                const finRow = createFinancialRow(partId, partName, specificQty, 'specific');
                const key = `${partId}-specific`;
                if (existingPrices.has(key)) finRow.querySelector('.financial-price').value = existingPrices.get(key);
                DOM.financialsContainer.appendChild(finRow);
            }
        } else { 
            const totalQty = partItem.querySelectorAll('.detailed-item-row').length;
            if (totalQty > 0) {
                const finRow = createFinancialRow(partId, partName, totalQty, 'detailed');
                const key = `${partId}-detailed`;
                if (existingPrices.has(key)) finRow.querySelector('.financial-price').value = existingPrices.get(key);
                DOM.financialsContainer.appendChild(finRow);
            }
        }
    });
    
    updateFinancials();
};

const addContentToPart = (partItem, partData = {}) => {
    const contentContainer = partItem.querySelector('.part-content-container');
    contentContainer.innerHTML = '';
    const partType = partItem.dataset.partType;

    partItem.querySelectorAll('.part-type-selector').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === partType);
    });

    if (partType === 'comum') {
        const comumTpl = getFragment(comumPartContentTemplateHTML);
        const sizesGrid = comumTpl.querySelector('.sizes-grid');
        sizesGrid.className = 'sizes-grid hidden mt-3 space-y-4';

        const categories = {
            'Baby Look': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Normal': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Infantil': ['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos']
        };
        let gridHtml = '';
        for (const category in categories) {
            gridHtml += `
            <div class="p-3 border rounded-md bg-white shadow-sm">
                <h4 class="font-bold text-gray-600 mb-3 text-sm uppercase tracking-wide border-b pb-1">${category}</h4>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-3 justify-start">`;
            
            categories[category].forEach(size => {
                const value = partData.sizes?.[category]?.[size] || '';
                gridHtml += `
                    <div class="size-input-container flex flex-col items-center">
                        <label class="text-xs font-bold text-gray-500 mb-1">${size}</label>
                        <input type="number" data-category="${category}" data-size="${size}" value="${value}" class="p-2 border border-gray-300 rounded-md w-full text-center size-input focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors">
                    </div>`;
            });
            gridHtml += '</div></div>';
        }
        sizesGrid.innerHTML = gridHtml;
        
        const specificList = comumTpl.querySelector('.specific-sizes-list');
        const addSpecificRow = (spec = {}) => {
            const specTpl = getFragment(specificSizeRowTemplateHTML);
            specTpl.querySelector('.item-spec-width').value = spec.width || '';
            specTpl.querySelector('.item-spec-height').value = spec.height || '';
            specTpl.querySelector('.item-spec-obs').value = spec.observation || '';
            specTpl.querySelector('.remove-specific-row-btn').addEventListener('click', (e) => {
                e.target.closest('.specific-size-row').remove();
                renderFinancialSection();
            });
            specificList.appendChild(specTpl);
        };

        (partData.specifics || []).forEach(addSpecificRow);

        comumTpl.querySelector('.add-specific-size-btn').addEventListener('click', () => {
            addSpecificRow();
            renderFinancialSection();
        });

        comumTpl.querySelector('.toggle-sizes-btn').addEventListener('click', (e) => e.target.nextElementSibling.classList.toggle('hidden'));
        sizesGrid.addEventListener('input', renderFinancialSection);
        contentContainer.appendChild(comumTpl);

    } else { 
        const detalhadoTpl = getFragment(detalhadoPartContentTemplateHTML);
        const listContainer = detalhadoTpl.querySelector('.detailed-items-list');
        const gridContainer = detalhadoTpl.querySelector('.detailed-sizes-grid-container');
        
        // --- INÍCIO DA LÓGICA DE REORDENAMENTO (DRAG AND DROP) ---
        // Apenas o container precisa ouvir o 'dragover' para calcular a posição
        listContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Permite o drop
            const afterElement = getDragAfterElement(listContainer, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) {
                    listContainer.appendChild(draggable);
                } else {
                    listContainer.insertBefore(draggable, afterElement);
                }
            }
        });

        // Função auxiliar para determinar a posição do drop
        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.detailed-item-row:not(.dragging)')];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
        // --- FIM DA LÓGICA DE REORDENAMENTO ---

        const addRow = (detail = {}, prefilledSize = null) => {
            const row = document.createElement('div');
            // Alterado de grid-cols-12 para incluir a alça
            row.className = 'grid grid-cols-12 gap-2 items-center detailed-item-row transition-all duration-200 bg-white border border-transparent rounded hover:border-gray-200';
            
            const sizeValue = prefilledSize || detail.size || '';
            const isReadonly = prefilledSize ? 'readonly' : '';

            // Layout atualizado: 
            // 1 col (Alça) | 4 cols (Nome) | 4 cols (Tamanho) | 2 cols (Num) | 1 col (Remove)
            row.innerHTML = `
                <div class="col-span-1 flex justify-center cursor-move drag-handle text-gray-300 hover:text-gray-500" title="Arraste para mover">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
                </div>
                <div class="col-span-4"><input type="text" placeholder="Nome na Peça" class="p-1 border rounded-md w-full text-sm item-det-name" value="${detail.name || ''}"></div>
                <div class="col-span-4"><input type="text" placeholder="Tamanho" class="p-1 border rounded-md w-full text-sm item-det-size" value="${sizeValue}" ${isReadonly}></div>
                <div class="col-span-2"><input type="text" placeholder="Nº / Detalhe" class="p-1 border rounded-md w-full text-sm item-det-number" value="${detail.number || ''}"></div>
                <div class="col-span-1 flex justify-center"><button type="button" class="remove-detailed-row text-red-500 font-bold hover:text-red-700">&times;</button></div>`;
            
            // Listeners para Drag and Drop
            const handle = row.querySelector('.drag-handle');
            
            // Só permite arrastar se estiver segurando a alça (evita problemas ao selecionar texto)
            handle.addEventListener('mouseenter', () => { row.setAttribute('draggable', 'true'); });
            handle.addEventListener('mouseleave', () => { row.setAttribute('draggable', 'false'); });
            // Fallback para toque em mobile
            handle.addEventListener('touchstart', () => { row.setAttribute('draggable', 'true'); }, {passive: true});

            row.addEventListener('dragstart', () => {
                row.classList.add('dragging', 'opacity-50', 'bg-blue-50');
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging', 'opacity-50', 'bg-blue-50');
                row.removeAttribute('draggable'); // Reseta por segurança
            });

            row.querySelector('.remove-detailed-row').addEventListener('click', () => {
                row.remove();
                renderFinancialSection();
            });
            listContainer.appendChild(row);
        };

        const categories = {
            'Baby Look': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Normal': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Infantil': ['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos']
        };
        
        let gridHtml = '<div class="space-y-4">';
        for (const category in categories) {
            gridHtml += `
            <div class="bg-slate-50 p-2 rounded border border-slate-200">
                <h4 class="font-bold text-xs text-gray-500 uppercase mb-2">${category}</h4>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 justify-start">`;
            categories[category].forEach(size => {
                gridHtml += `
                    <div class="size-input-container">
                        <label class="text-xs font-medium mb-1 text-gray-400">${size}</label>
                        <input type="number" data-category="${category}" data-size="${size}" class="p-1 border rounded-md w-full text-center detailed-size-input text-sm">
                    </div>`;
            });
            gridHtml += '</div></div>';
        }
        gridHtml += '</div>';
        gridContainer.innerHTML += gridHtml; 
        
        if (partData.details && partData.details.length > 0) {
            partData.details.forEach(detail => addRow(detail, null)); 
            gridContainer.classList.add('hidden');
            detalhadoTpl.querySelector('.generate-detailed-lines-btn').classList.add('hidden');
            detalhadoTpl.querySelector('.detailed-list-wrapper').classList.remove('hidden');
        }

        detalhadoTpl.querySelector('.generate-detailed-lines-btn').addEventListener('click', (e) => {
            const partItem = e.target.closest('.part-item'); 
            if (!partItem) return;

            listContainer.querySelectorAll('.detailed-item-row').forEach(row => row.remove());

            partItem.querySelectorAll('.detailed-size-input').forEach(input => {
                const quantity = parseInt(input.value) || 0;
                if (quantity > 0) {
                    const { category, size } = input.dataset;
                    const prefilledSize = `${size} (${category})`; 
                    for (let i = 0; i < quantity; i++) addRow({}, prefilledSize); 
                }
            });

            renderFinancialSection(); 
            partItem.querySelector('.detailed-sizes-grid-container').classList.add('hidden');
            e.target.classList.add('hidden'); 
            partItem.querySelector('.detailed-list-wrapper').classList.remove('hidden');
        });

        detalhadoTpl.querySelector('.add-manual-detailed-row-btn').addEventListener('click', () => {
            addRow({}, null); 
            renderFinancialSection();
        });
        
        contentContainer.appendChild(detalhadoTpl);
    }
};

export const addPart = (partData = {}, partCounter) => {
    const partTpl = getFragment(partTemplateHTML);
    const partItem = partTpl.querySelector('.part-item');
    partItem.dataset.partId = partCounter;
    partItem.dataset.partType = partData.partInputType || 'comum';
    
    const partTypeInput = partItem.querySelector('.part-type');
    partTypeInput.value = partData.type || '';
    partItem.querySelector('.part-material').value = partData.material || '';
    partItem.querySelector('.part-color-main').value = partData.colorMain || '';
    
    partTypeInput.addEventListener('input', renderFinancialSection);
    
    addContentToPart(partItem, partData);

    // --- INÍCIO: ZONA 1 e 4 (Gestor de Terceirizados + Bloqueio Premium) ---
    partItem._outsourcedCosts = partData.outsourcedCosts ? [...partData.outsourcedCosts] : [];
    
    // Verifica o plano salvo no sistema (no código legado, 'pro' representa o plano Premium)
    const userPlan = localStorage.getItem('userPlan') || 'essencial';
    const isPremium = userPlan === 'pro';

    if (isPremium) {
        // 🟢 MODO PREMIUM: Totalmente Funcional
        const terceirizadosHtml = `
            <div class="mt-4 border-t pt-3 border-gray-200">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-xs font-bold text-purple-700 uppercase flex items-center gap-1">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clip-rule="evenodd" /></svg>
                        Custo Terceirizado (Por Peça)
                    </h4>
                </div>
                <div class="flex gap-2 mb-2">
                    <input type="text" class="out-desc p-1 border rounded text-xs flex-1 bg-white" placeholder="Ex: Bordado Logo">
                    <div class="relative w-24">
                        <span class="absolute left-1 top-1 text-gray-400 text-xs">R$</span>
                        <input type="number" step="0.01" class="out-cost p-1 pl-6 border rounded text-xs w-full bg-white" placeholder="0.00">
                    </div>
                    <button type="button" class="btn-add-out bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 rounded font-bold text-lg leading-none transition-colors">+</button>
                </div>
                <div class="out-list space-y-1"></div>
            </div>
        `;
        partItem.insertAdjacentHTML('beforeend', terceirizadosHtml);
        
        const renderOutsourcedList = () => {
            const listContainer = partItem.querySelector('.out-list');
            listContainer.innerHTML = '';
            partItem._outsourcedCosts.forEach((cost, index) => {
                const row = document.createElement('div');
                row.className = 'flex justify-between items-center bg-purple-50 px-2 py-1 rounded border border-purple-100 text-xs mt-1 shadow-sm';
                row.innerHTML = `
                    <span class="text-gray-700 font-medium">${cost.description}</span>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-purple-700">R$ ${parseFloat(cost.unitCost).toFixed(2)}</span>
                        <button type="button" class="text-red-400 hover:text-red-600 font-bold px-1" data-index="${index}">&times;</button>
                    </div>
                `;
                row.querySelector('button').addEventListener('click', () => {
                    partItem._outsourcedCosts.splice(index, 1);
                    renderOutsourcedList();
                    updateFinancials(); 
                });
                listContainer.appendChild(row);
            });
        };

        partItem.querySelector('.btn-add-out').addEventListener('click', () => {
            const descInput = partItem.querySelector('.out-desc');
            const costInput = partItem.querySelector('.out-cost');
            const desc = descInput.value.trim();
            const cost = parseFloat(costInput.value);
            
            if (desc && cost > 0) {
                partItem._outsourcedCosts.push({ description: desc, unitCost: cost });
                descInput.value = '';
                costInput.value = '';
                renderOutsourcedList();
                updateFinancials(); 
            }
        });
        
        renderOutsourcedList();

    } else {
        // 🔴 MODO BLOQUEADO: Gatilho de Upsell (Plano Básico)
        const upsellHtml = `
            <div class="mt-4 border-t pt-3 border-gray-200 opacity-70 group relative">
                <div class="absolute inset-0 z-10 flex items-center justify-center cursor-not-allowed" title="Funcionalidade exclusiva do Plano Premium"></div>
                <div class="flex justify-between items-center mb-2 filter grayscale">
                    <h4 class="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                        <svg class="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/></svg>
                        Custo Terceirizado (Premium)
                    </h4>
                </div>
                <div class="flex gap-2 mb-2 pointer-events-none filter grayscale">
                    <input type="text" class="p-1 border rounded text-xs flex-1 bg-gray-50 text-gray-400" placeholder="Ex: Bordado Logo" disabled>
                    <div class="relative w-24">
                        <span class="absolute left-1 top-1 text-gray-400 text-xs">R$</span>
                        <input type="number" class="p-1 pl-6 border rounded text-xs w-full bg-gray-50" placeholder="0.00" disabled>
                    </div>
                    <button type="button" class="bg-gray-200 text-gray-400 px-3 rounded font-bold text-lg leading-none" disabled>+</button>
                </div>
            </div>
        `;
        partItem.insertAdjacentHTML('beforeend', upsellHtml);
    }
    // --- FIM: ZONA 1 e 4 ---
    DOM.partsContainer.appendChild(partItem);
    
    renderFinancialSection();
    
    // --- INÍCIO: ZONA 5 (Inteligência do Mockup Individual) ---
    const dropzone = partItem.querySelector('.mockup-dropzone');
    const previewImg = partItem.querySelector('.mockup-preview');
    const removeMockupBtn = partItem.querySelector('.remove-mockup-btn');
    const dropzoneContent = partItem.querySelector('.dropzone-content');

    // 1. Inicializa a memória da imagem (fica nulo por padrão)
    partItem._mockupFile = null;

    if (dropzone) {
        // Função interna para processar o arquivo recebido (Drag ou Paste)
        const processMockupFile = (file) => {
            if (!file || !file.type.startsWith('image/')) {
                alert('Formato inválido. Por favor, insira apenas imagens.');
                return;
            }
            
            partItem._mockupFile = file; // Salva o arquivo real para envio futuro ao ImgBB

            // Usa FileReader para mostrar a miniatura imediatamente
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewImg.classList.remove('hidden');
                removeMockupBtn.classList.remove('hidden');
                dropzoneContent.classList.add('hidden');
                dropzone.classList.remove('border-dashed', 'border-gray-300');
                dropzone.classList.add('border-solid', 'border-blue-400');
            };
            reader.readAsDataURL(file);
        };

        // 2. Prepara para o Modo Edição (se a peça já vier do banco com arte salva)
        if (partData.mockupPeca) {
            previewImg.src = partData.mockupPeca;
            previewImg.classList.remove('hidden');
            removeMockupBtn.classList.remove('hidden');
            dropzoneContent.classList.add('hidden');
            dropzone.classList.remove('border-dashed', 'border-gray-300');
            dropzone.classList.add('border-solid', 'border-blue-400');
        }

        // 3. Listeners de Drag & Drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('bg-blue-50', 'border-blue-400');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.classList.remove('bg-blue-50', 'border-blue-400');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('bg-blue-50', 'border-blue-400');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processMockupFile(e.dataTransfer.files[0]);
            }
        });

        // 4. Listener para Colar (Ctrl+V) - Requer clicar na área antes
        dropzone.addEventListener('paste', (e) => {
            e.preventDefault();
            const clipboardItems = e.clipboardData.items;
            let imageFile = null;
            for (let i = 0; i < clipboardItems.length; i++) {
                if (clipboardItems[i].type.indexOf('image') !== -1) {
                    imageFile = clipboardItems[i].getAsFile();
                    break;
                }
            }
            if (imageFile) processMockupFile(imageFile);
        });

        // 5. Botão de Remover a Arte
        removeMockupBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita conflitos
            partItem._mockupFile = null; // Apaga da memória
            
            // Se tinha imagem do banco, apaga a referência para enviar atualização limpa
            if (partData.mockupPeca) partData.mockupPeca = null; 

            previewImg.src = '';
            previewImg.classList.add('hidden');
            removeMockupBtn.classList.add('hidden');
            dropzoneContent.classList.remove('hidden');
            dropzone.classList.remove('border-solid', 'border-blue-400');
            dropzone.classList.add('border-dashed', 'border-gray-300');
        });
    }
    // --- FIM: ZONA 5 ---

    partItem.querySelector('.remove-part-btn').addEventListener('click', () => {
        partItem.remove();
        renderFinancialSection();
    });
    
    partItem.querySelectorAll('.part-type-selector').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newType = e.target.dataset.type;
            partItem.dataset.partType = newType;
            addContentToPart(partItem, {}); 
            renderFinancialSection();
        });
    });
};

export const resetForm = () => {
    DOM.orderForm.reset();
    DOM.orderId.value = '';
    DOM.modalTitle.textContent = 'Novo Pedido';
    DOM.partsContainer.innerHTML = '';
    DOM.financialsContainer.innerHTML = '';
    DOM.existingFilesContainer.innerHTML = '';
    DOM.orderDate.value = new Date().toISOString().split('T')[0];
    // --- INÍCIO: ZONA DO RADAR DE PRODUÇÃO ---
    const capacityWarning = document.getElementById('capacityWarning');
    if (capacityWarning) capacityWarning.classList.add('hidden');
    const radarBadge = document.getElementById('radarBadge');
    if (radarBadge) radarBadge.classList.add('opacity-0');
    // --- FIM: ZONA DO RADAR DE PRODUÇÃO ---

    
    setPaymentList([]); // Limpa a lista de pagamentos
    
    updateFinancials();
};

export const populateFormForEdit = (orderData, currentPartCounter) => {
    // Nota: A lista de pagamentos é populada pelo Listener, 
    // pois os dados de transação vêm de outro serviço.
    // Aqui resetamos e preparamos os dados do pedido.
    
    resetForm();
    
    DOM.orderId.value = orderData.id;
    DOM.modalTitle.textContent = 'Editar Pedido';
    DOM.clientName.value = orderData.clientName;
    DOM.clientPhone.value = orderData.clientPhone;
    DOM.orderStatus.value = orderData.orderStatus;
    DOM.orderDate.value = orderData.orderDate;
    DOM.deliveryDate.value = orderData.deliveryDate;
    DOM.generalObservation.value = orderData.generalObservation;
    // DOM.downPayment ignorado propositalmente, usamos a lista agora
    DOM.discount.value = orderData.discount || '';
    
    if (DOM.paymentMethod) {
        DOM.paymentMethod.value = orderData.paymentMethod || '';
    }

    DOM.existingFilesContainer.innerHTML = '';
    if (orderData.mockupUrls && orderData.mockupUrls.length) {
        orderData.mockupUrls.forEach(url => {
            const fileWrapper = document.createElement('div');
            fileWrapper.className = 'flex items-center justify-between bg-gray-100 p-2 rounded-md';
            
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.className = 'text-blue-600 hover:underline text-sm truncate';
            link.textContent = url.split('/').pop().split('?')[0];
            
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'remove-mockup-btn text-red-500 hover:text-red-700 font-bold ml-2 px-2';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Remover anexo';

            fileWrapper.appendChild(link);
            fileWrapper.appendChild(deleteBtn);
            DOM.existingFilesContainer.appendChild(fileWrapper);
        });
    }

    (orderData.parts || []).forEach(part => {
        currentPartCounter++;
        addPart(part, currentPartCounter);
    });
    
    DOM.financialsContainer.querySelectorAll('.financial-item').forEach(finRow => {
        const partId = finRow.dataset.partId;
        const priceGroup = finRow.dataset.priceGroup;
        const part = orderData.parts[partId - 1];
        if (!part) return;

        if (priceGroup === 'standard') {
            finRow.querySelector('.financial-price').value = part.unitPriceStandard || part.unitPrice || '';
        } else if (priceGroup === 'specific') {
            finRow.querySelector('.financial-price').value = part.unitPriceSpecific || part.unitPrice || '';
        } else if (priceGroup === 'detailed') {
            finRow.querySelector('.financial-price').value = part.unitPrice || '';
        }
    });

    updateFinancials();
    DOM.orderModal.classList.remove('hidden');
    return currentPartCounter;
};

// ==========================================
// RECEPTOR MAGNÉTICO: INTELIGÊNCIA ARTIFICIAL
// ==========================================
window.addEventListener('injetarPecasIA', (e) => {
    console.log("🔔 [formHandler] Pacote IA recebido! Iniciando protocolo de injeção...");
    const dadosIA = e.detail;

    // Função inteligente de Polling (Espera Ativa)
    const tentarInjetar = (tentativas) => {
        // Se a tela ainda não existe, ele não aborta, ele aguarda e tenta de novo!
        if (!DOM || !DOM.partsContainer) {
            if (tentativas > 0) {
                console.warn(`⏳ [formHandler] Modal ainda carregando... Tentando novamente. (Restam ${tentativas} tentativas)`);
                setTimeout(() => tentarInjetar(tentativas - 1), 150);
            } else {
                console.error("❌ [formHandler] Falha crítica: O modal Novo Pedido não renderizou a tempo.");
            }
            return;
        }

        console.log(`✅ [formHandler] Tela pronta! Injetando ${dadosIA.length} peças estruturadas...`);
        
        // Limpa a tela (remove a peça genérica que o botão Novo Pedido cria por padrão)
        DOM.partsContainer.innerHTML = '';
        DOM.financialsContainer.innerHTML = '';

        // Dicionário de pesos para forçar a ordenação visual idêntica à grade do sistema
        const sizeWeights = {
            'PP (Baby Look)': 100, 'P (Baby Look)': 101, 'M (Baby Look)': 102, 'G (Baby Look)': 103, 'GG (Baby Look)': 104, 'XG (Baby Look)': 105,
            'PP (Normal)': 200, 'P (Normal)': 201, 'M (Normal)': 202, 'G (Normal)': 203, 'GG (Normal)': 204, 'XG (Normal)': 205,
            '2 anos (Infantil)': 300, '4 anos (Infantil)': 301, '6 anos (Infantil)': 302, '8 anos (Infantil)': 303, '10 anos (Infantil)': 304, '12 anos (Infantil)': 305
        };
        
        if (Array.isArray(dadosIA)) {
            dadosIA.forEach((pecaIA, index) => {
                // Se for grade detalhada, aplica a ordenação baseada nos pesos antes de injetar
                let detalhesOrdenados = pecaIA.details || [];
                if (pecaIA.partInputType === 'detalhado' && detalhesOrdenados.length > 0) {
                    detalhesOrdenados.sort((a, b) => {
                        const pesoA = sizeWeights[a.size] || 999; // Se a IA inventar tamanho, vai pro final
                        const pesoB = sizeWeights[b.size] || 999;
                        return pesoA - pesoB;
                    });
                }

                const partData = {
                    type: pecaIA.type || 'Camisa (IA)',
                    material: pecaIA.material || '',
                    partInputType: pecaIA.partInputType === 'comum' ? 'comum' : 'detalhado',
                    sizes: pecaIA.sizes || {},
                    details: detalhesOrdenados
                };
                
                // Aciona a fábrica de cards para cada peça processada e organizada
                addPart(partData, index + 1);
            });
        }
    };
    // Inicia a operação com 10 tentativas de fôlego (até 1.5 segundos de margem de segurança)
    tentarInjetar(10);
});

// ==========================================
// RECEPTOR MAGNÉTICO: RADAR DE PRODUÇÃO
// ==========================================
// Delegação de eventos para garantir que funcione mesmo com HTML injetado dinamicamente
document.addEventListener('click', (e) => {
    // Verifica se o clique foi no botão do radar ou em algum ícone dentro dele
    if (e.target.closest('#radarBtn')) {
        initializeRadar();
    }
});

document.addEventListener('change', (e) => {
    // Verifica se a mudança foi no input de data de entrega
    if (e.target && e.target.id === 'deliveryDate') {
        checkCapacityWarning(e.target.value);
    }
});

// ==========================================
// FIX DE NAVEGAÇÃO: BOTÃO X (Fechar Modal)
// ==========================================
document.addEventListener('click', (e) => {
    // Se o usuário clicar no botão X
    if (e.target.closest('#closeOrderModalX')) {
        const orderModal = document.getElementById('orderModal');
        if (orderModal) {
            // Esconde a tela de pedido imediatamente
            orderModal.classList.add('hidden');
        }
    }
});
