// js/ui/orderRenderer.js
// ==========================================================
// MÓDULO ORDER RENDERER (v6.0.1 - Divisor de Mundos & ERP Industrial)
// Responsabilidade: Renderizar pedidos, gerenciar links PRO e layout Kanban.
// Status: FASE 1 ATIVA (Multiplicação de Cards, Fim do Pedido Fantasma, Colunas Industriais)
// ==========================================================

import { DOM, SIZES_ORDER } from './dom.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, auth } from '../firebaseConfig.js'; 
import { updateOrderStatusOnly, updateProductionItemStatus } from '../services/orderService.js';

// --- CONTROLE DE ESTADO GLOBAL DO MÓDULO ---

const closeMenusOnClickOutside = (e) => {
    if (!e.target.closest('button[id$="Btn"]') && !e.target.closest('div[role="menu"]')) {
        const allMenus = document.querySelectorAll('[id$="Menu"]');
        allMenus.forEach(menu => {
            if (!menu.classList.contains('hidden')) {
                menu.classList.add('hidden');
            }
        });
    }
};
document.addEventListener('click', closeMenusOnClickOutside);

// [EVOLUÇÃO] Memória fotográfica avançada para o Drag and Drop (Guarda o Pedido e a Peça exata)
let draggedItem = { orderId: null, partIndex: null };

// [EVOLUÇÃO SAAS] Memória Dinâmica e Motor de Busca das Colunas
let dynamicProductionStages = null;
let isSkeletonReady = false; // [NOVO] Trava Mestra contra a Condição de Corrida
let pendingCardsQueue = [];  // [NOVO] Fila de espera para os cards apressados

const fetchProductionStages = async () => {
    if (dynamicProductionStages) return dynamicProductionStages;

    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return ["Não Iniciado", "Corte", "Costura"]; // Fallback de emergência

        const mappingRef = doc(db, "user_mappings", currentUser.uid);
        const mappingSnap = await getDoc(mappingRef);
        const companyId = mappingSnap.exists() ? mappingSnap.data().companyId : currentUser.uid;

        const rootRef = doc(db, `companies/${companyId}`);
        const rootSnap = await getDoc(rootRef);

        if (rootSnap.exists() && rootSnap.data().etapas_producao && rootSnap.data().etapas_producao.length > 0) {
            let stages = rootSnap.data().etapas_producao;
            
            // [O MARCO ZERO UNIVERSAL] Se a fábrica não tiver a coluna, injetamos à força no início
            if (stages[0] !== "Não Iniciado") {
                stages.unshift("Não Iniciado");
            }
            dynamicProductionStages = stages;
            
        } else {
            // Fallback caso a fábrica ainda não tenha salvo as próprias configurações
            dynamicProductionStages = ["Não Iniciado", "Corte", "Estampa/Bordado", "Sublimação", "Costura", "Terceirizado", "Revisão", "Embalagem", "Finalizado"];
        }
    } catch (error) {
        console.error("Erro ao buscar etapas de produção:", error);
        dynamicProductionStages = ["Não Iniciado", "Corte", "Costura", "Finalizado"];
    }
    
    return dynamicProductionStages;
};

// --- FUNÇÕES AUXILIARES ---

const getUserPlan = () => {
    return localStorage.getItem('userPlan') || 'essencial';
};

const getDeliveryCountdown = (deliveryDate, status) => {
    if (status === 'Finalizado' || status === 'Entregue') {
        return { text: '📦 Aguardando retirada', color: 'orange' };
    }
    if (!deliveryDate) return { text: 'Sem data', color: 'gray' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate + 'T00:00:00');
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `Atrasado há ${Math.abs(diffDays)} dia(s)`, color: 'red' };
    if (diffDays === 0) return { text: 'Entrega hoje', color: 'red' };
    if (diffDays === 1) return { text: 'Resta 1 dia', color: 'yellow' };
    if (diffDays <= 3) return { text: `Restam ${diffDays} dias`, color: 'yellow' };
    return { text: `Restam ${diffDays} dias`, color: 'green' };
};

// [DIVISOR DE MUNDOS] O partIndex diz se estamos renderizando uma peça isolada (Produção) ou o pedido todo (Gestor)
export const generateOrderCardHTML = (order, viewType, partIndex = null) => {
    const isProduction = window.USER_ROLE === 'production';
    
    // Variáveis que só o Gestor usa
    let totalValue = 0;
    if (!isProduction) {
        (order.parts || []).forEach(p => {
            const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
            const specificQty = (p.specifics || []).length;
            const detailedQty = (p.details || []).length;
            totalValue += (standardQty * (p.unitPriceStandard ?? p.unitPrice ?? 0)) + 
                          (specificQty * (p.unitPriceSpecific ?? p.unitPrice ?? 0)) + 
                          (detailedQty * (p.unitPrice ?? 0));
        });
        totalValue -= (order.discount || 0);
    }

    const countdown = getDeliveryCountdown(order.deliveryDate, order.orderStatus);
    const countdownColorClasses = { red: 'bg-red-100 text-red-800', yellow: 'bg-yellow-100 text-yellow-800', green: 'bg-green-100 text-green-800', gray: 'bg-gray-100 text-gray-800', orange: 'bg-orange-100 text-orange-800' };
    const formattedDeliveryDate = order.deliveryDate ? new Date(order.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'A definir';

    // Construção do Visual Baseado no Cargo
    let cardTitle = '';
    let cardSubtitle = '';
    let badgeStatus = '';
    let buttonsHtml = '';
    let totalHtml = '';

    if (isProduction && partIndex !== null) {
        // MUNDO 1: CHÃO DE FÁBRICA (Card Fracionado)
        const part = order.parts[partIndex];
        const standardQty = Object.values(part.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
        const specificQty = (part.specifics || []).length;
        const detailedQty = (part.details || []).length;
        const totalPartQty = standardQty + specificQty + detailedQty;

        // --- INÍCIO: ZONA DE COMUNICAÇÃO OPERACIONAL ---
        let terceirizadoTag = '';
        if (part.outsourcedCosts && part.outsourcedCosts.length > 0) {
            terceirizadoTag = `<span class="mt-1 inline-block bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200">⚠️ Requer Terceirizado</span>`;
        }
        // --- FIM: ZONA DE COMUNICAÇÃO OPERACIONAL ---

        // Fim do Pedido Fantasma: Exibe o nome do cliente e a peça específica
        cardTitle = `<span class="text-xs text-gray-400 block mb-1">#${order.id.substring(0,6).toUpperCase()}</span>${order.clientName}`;
        cardSubtitle = `
            <div class="mt-2 p-2 bg-blue-50 rounded-md border border-blue-100 text-sm text-blue-800 font-bold flex flex-col justify-center">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg> 
                    <span class="truncate">${totalPartQty}x ${part.type}</span>
                </div>
                ${terceirizadoTag}
            </div>`;
        
        // [CIRURGIA DA ETIQUETA] Sincroniza a cor e o texto com a inteligência da coluna
        const firstStage = (dynamicProductionStages && dynamicProductionStages.length > 0) ? dynamicProductionStages[0] : 'Não Iniciado';
        const lastStage = (dynamicProductionStages && dynamicProductionStages.length > 0) ? dynamicProductionStages[dynamicProductionStages.length - 1] : 'Finalizado';
        const finishedStatuses = ['Finalizado', 'Aguardando Retirada', 'Pronto para Entrega'];

        if (part.status_producao) {
            badgeStatus = part.status_producao;
        } else if (finishedStatuses.includes(order.orderStatus)) {
            badgeStatus = lastStage;
        } else {
            badgeStatus = firstStage;
        }
        } else {
        // MUNDO 2: GESTOR (Card do Pedido Completo)
        
        // [CRM - FICHA DE OURO] A Chave Mestra: Tenta usar o telefone, se não tiver, usa o nome exato.
        const clientKey = order.clientPhone ? order.clientPhone : order.clientName;
        
        // [CRM - FICHA DE OURO] Injeção do Ícone de Perfil Dourado.
        // NOTA TÉCNICA: Sem quebras de linha entre as tags para não estragar o localeCompare() do Kanban.
        cardTitle = `<div class="flex items-center gap-1.5" title="${order.clientName}"><span class="truncate max-w-[150px] sm:max-w-[190px]">${order.clientName}</span><button type="button" class="open-customer-profile-btn text-yellow-500 hover:text-yellow-600 hover:scale-110 transition-transform focus:outline-none" data-phone="${clientKey}" title="Abrir Ficha de Ouro"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 drop-shadow-sm" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg></button></div>`;
        
        // [CIRURGIA 1] Blindagem da etiqueta: Se não tiver status, assume 'Pendente'
        badgeStatus = order.orderStatus || 'Pendente'; 
        
        // [CIRURGIA 2] Matemática limpa do Resta Pagar (apenas visual, sem tocar no banco)
        const downPayment = parseFloat(order.downPayment) || 0;
        const remaining = totalValue - downPayment;
        
        let remainingHtml = '';
        if (remaining > 0.01) {
            remainingHtml = `<p class="text-sm text-red-600 font-semibold mt-0.5">Resta Pagar: R$ ${remaining.toFixed(2)}</p>`;
        } else {
            remainingHtml = `<p class="text-sm text-green-600 font-semibold mt-0.5">Quitado</p>`;
        }

        totalHtml = `
            <div class="flex flex-col">
                <p class="text-sm text-gray-600">Total: <span class="font-semibold text-blue-600">R$ ${totalValue.toFixed(2)}</span></p>
                ${remainingHtml}
            </div>`;
        
        buttonsHtml = viewType === 'pending' ?
            `<button data-id="${order.id}" class="edit-btn p-2 rounded-md text-gray-500 hover:bg-yellow-100 hover:text-yellow-700 transition-colors" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg></button>` :
            `<button data-id="${order.id}" class="replicate-btn p-2 rounded-md text-gray-500 hover:bg-green-100 hover:text-green-700 transition-colors" title="Replicar"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M5 3a2 2 0 00-2 2v6a1 1 0 102 0V5h6a1 1 0 100-2H5z" /></svg></button>`;
    }
    
    const detailsBtnText = isProduction ? 'Detalhes da Arte' : 'Detalhes do pedido';
    const card = document.createElement('div');
    card.className = `bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col space-y-3 transform hover:-translate-y-1 ${isProduction ? 'cursor-grab active:cursor-grabbing border-l-4 border-blue-500' : ''}`;
    
    // Injeção cirúrgica de rastreamento no HTML
    card.dataset.id = order.id;
    if (isProduction && partIndex !== null) {
        card.dataset.partIndex = partIndex;
    }
    card.dataset.deliveryDate = order.deliveryDate || 'Sem Data';

    // Motor de Drag and Drop Dinâmico (Lê a peça, não o pedido)
    if (isProduction && viewType === 'pending') {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            draggedItem = { orderId: order.id, partIndex: partIndex };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', JSON.stringify(draggedItem));
            setTimeout(() => card.classList.add('opacity-50', 'scale-95'), 0);
        });
        card.addEventListener('dragend', () => {
            draggedItem = { orderId: null, partIndex: null };
            card.classList.remove('opacity-50', 'scale-95');
        });
    }

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <h3 class="text-lg font-bold text-gray-800">${cardTitle}</h3>
            <span class="status-badge status-${badgeStatus.replace(/\s|\//g, '-').toLowerCase()} bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold">${badgeStatus}</span>
        </div>
        ${cardSubtitle}
        ${viewType === 'pending' ? `<div class="text-sm font-medium text-gray-500 flex items-center"><svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span class="ml-1.5">Entrega: <strong>${formattedDeliveryDate}</strong></span></div>` : ''}
        ${totalHtml}
        ${viewType === 'pending' ? `<div class="text-sm font-semibold py-1 px-2 rounded-full text-center ${countdownColorClasses[countdown.color]}">${countdown.text}</div>` : ''}
        <div class="flex space-x-2 items-center pt-3 border-t border-gray-100 mt-auto">
            <button data-id="${order.id}" class="view-btn flex-1 bg-gray-100 text-gray-700 font-semibold py-2 px-3 rounded-lg text-sm hover:bg-gray-200 transition-colors">${detailsBtnText}</button>
            ${buttonsHtml}
            ${(viewType === 'pending' && !isProduction) ? `<button data-id="${order.id}" class="settle-and-deliver-btn p-2 rounded-md text-gray-500 hover:bg-green-100 hover:text-green-700 transition-colors" title="Quitar e Entregar"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg></button>` : ''}
            ${!isProduction ? `<button data-id="${order.id}" class="delete-btn p-2 rounded-md text-gray-500 hover:bg-red-100 hover:text-red-700 transition-colors" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg></button>` : ''}
        </div>
    `;
    return card;
};

// --- GERENCIAMENTO DE LISTA (KANBAN/GRID) ---

// [PROTEÇÃO SPA] Helper para buscar a lista dinamicamente, ignorando o cache estático do dom.js
const getOrdersList = () => document.getElementById('ordersList');

const setupOrderListContainer = async (viewType) => {
    const listEl = getOrdersList();
    if (!listEl) return; // Escudo ativado: se a tela não existe, não faz nada

    listEl.innerHTML = '';
    listEl.className = '';
    const isProduction = window.USER_ROLE === 'production';

    isSkeletonReady = false; // [ESCUDO ATIVADO] Bloqueia a entrada de cards

    if (viewType === 'pending') {
        listEl.classList.add('kanban-board');
        if (isProduction) {
            listEl.classList.add('flex', 'overflow-x-auto', 'pb-4', 'space-x-4');
            // [CIRURGIA] Obrigamos o sistema a esperar a lista oficial antes de desenhar a tela!
            const stages = await fetchProductionStages();
            stages.forEach(status => findOrCreateKanbanColumn(status));
        }
    } else {
        listEl.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4', '2xl:grid-cols-5', 'gap-6');
    }

    isSkeletonReady = true; // [ESCUDO DESATIVADO] Libera a entrada de cards

    // [A REDENÇÃO] O esqueleto tá pronto! Processa quem estava na sala de espera:
    if (pendingCardsQueue.length > 0) {
        pendingCardsQueue.forEach(item => addOrderCard(item.order, item.viewType));
        pendingCardsQueue = []; // Limpa a fila para não duplicar
    }
};

const findOrCreateKanbanColumn = (rawGroupKey) => {
    const listEl = getOrdersList();
    if (!listEl) return null;

    const isProduction = window.USER_ROLE === 'production';
    let groupKey = rawGroupKey;

    if (isProduction && dynamicProductionStages) {
        const cleanRaw = String(rawGroupKey).trim().toLowerCase();
        const officialMatch = dynamicProductionStages.find(stage => stage.toLowerCase() === cleanRaw);
        
        if (officialMatch) {
            groupKey = officialMatch; 
        } else {
            groupKey = dynamicProductionStages[0]; 
        }
    }

    let column = listEl.querySelector(`.kanban-column[data-group-key="${groupKey}"]`);
    if (column) return column.querySelector('.kanban-column-content');

    let formattedTitle = groupKey;
    if (!isProduction) {
        formattedTitle = groupKey === 'Sem Data' ? 'Sem Data de Entrega' : new Date(groupKey + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    
    column = document.createElement('div');
    column.className = `kanban-column rounded-xl transition-colors ${isProduction ? 'bg-gray-50 flex-shrink-0 w-80 min-w-[320px]' : 'min-h-[200px]'}`;
    column.dataset.groupKey = groupKey;
    
    if (isProduction && dynamicProductionStages) {
        const stageIndex = dynamicProductionStages.indexOf(groupKey);
        column.style.order = stageIndex !== -1 ? stageIndex : 999;
    }
    
    column.innerHTML = `
        <h2 class="font-bold text-lg text-gray-700 mb-4 flex items-center px-4 pt-4">
            ${formattedTitle}
            <span class="kanban-column-counter ml-2 text-sm font-medium bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">0</span>
        </h2>
        <div class="kanban-column-content space-y-4 min-h-[150px] p-4 rounded-b-lg"></div>
    `;

    if (isProduction) {
        column.addEventListener('dragenter', (e) => e.preventDefault());
        column.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move';
            column.classList.add('bg-blue-100', 'border-2', 'border-dashed', 'border-blue-400');
        });
        
        column.addEventListener('dragleave', () => {
            column.classList.remove('bg-blue-100', 'border-2', 'border-dashed', 'border-blue-400');
        });
        
        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            column.classList.remove('bg-blue-100', 'border-2', 'border-dashed', 'border-blue-400');
            
            let droppedData = null;
            try {
                const dataString = e.dataTransfer.getData('application/json');
                droppedData = dataString ? JSON.parse(dataString) : draggedItem;
            } catch(err) {
                droppedData = draggedItem;
            }
            
            if (droppedData && droppedData.orderId && groupKey) {
                const { orderId, partIndex } = droppedData;
                const selector = `[data-id="${orderId}"]${partIndex !== null ? `[data-part-index="${partIndex}"]` : ''}`;
                const draggedCard = document.querySelector(selector);
                
                if (draggedCard) {
                    column.querySelector('.kanban-column-content').appendChild(draggedCard);
                    updateKanbanColumnCounter(column.querySelector('.kanban-column-content'));
                    
                    const badge = draggedCard.querySelector('.status-badge');
                    if (badge) {
                        badge.textContent = groupKey;
                        badge.className = `status-badge status-${groupKey.replace(/[\s/]/g, '-').toLowerCase()} bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold`;
                    }
                }

                if (partIndex !== null) {
                    await updateProductionItemStatus(orderId, partIndex, groupKey);
                } else {
                    await updateOrderStatusOnly(orderId, groupKey);
                }
            }
        });
    }

   const allColumns = Array.from(listEl.querySelectorAll('.kanban-column'));
    let inserted = false;

    if (!isProduction && groupKey !== 'Sem Data') {
        const newDate = new Date(groupKey + 'T00:00:00');
        for (const existingCol of allColumns) {
            const existingGroupKey = existingCol.dataset.groupKey;
            if (existingGroupKey !== 'Sem Data' && newDate < new Date(existingGroupKey + 'T00:00:00')) {
                listEl.insertBefore(column, existingCol);
                inserted = true;
                break;
            }
        }
    }

    if (!inserted) listEl.appendChild(column);
    
    return column.querySelector('.kanban-column-content');
};

const updateKanbanColumnCounter = (columnContent) => {
    const column = columnContent.closest('.kanban-column');
    if (!column) return;
    const counter = column.querySelector('.kanban-column-counter');
    const count = columnContent.children.length;
    counter.textContent = count;
    
    if (count === 0 && window.USER_ROLE !== 'production') column.remove();
};

export const addOrderCard = (order, viewType) => {
    const listEl = getOrdersList();
    if (!listEl) return;

    const isProduction = window.USER_ROLE === 'production';
    
    if (isProduction && viewType === 'pending' && !isSkeletonReady) {
        pendingCardsQueue.push({ order, viewType });
        return; 
    }

    if (isProduction && viewType === 'pending') {
        if (!order.parts || order.parts.length === 0) return;
        
        order.parts.forEach((part, index) => {
            const card = generateOrderCardHTML(order, viewType, index);
            
            const firstStage = (dynamicProductionStages && dynamicProductionStages.length > 0) ? dynamicProductionStages[0] : 'Não Iniciado';
            const lastStage = (dynamicProductionStages && dynamicProductionStages.length > 0) ? dynamicProductionStages[dynamicProductionStages.length - 1] : 'Finalizado';
            
            let groupKey = part.status_producao;
            
            if (!groupKey) {
                const finishedStatuses = ['Finalizado', 'Aguardando Retirada', 'Pronto para Entrega'];
                if (finishedStatuses.includes(order.orderStatus)) {
                    groupKey = lastStage; 
                } else {
                    groupKey = firstStage; 
                }
            } 
            
            const columnContent = findOrCreateKanbanColumn(groupKey);
            if (!columnContent) return; // Segurança
            
            const cardsInColumn = Array.from(columnContent.querySelectorAll('.bg-white'));
            let inserted = false;
            for (const existingCard of cardsInColumn) {
                if (order.clientName.localeCompare(existingCard.querySelector('h3').textContent.replace(/#.*(?=[A-Z])/i, '').trim()) < 0) {
                    columnContent.insertBefore(card, existingCard);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) columnContent.appendChild(card);
            updateKanbanColumnCounter(columnContent);
        });

    } else {
        const card = generateOrderCardHTML(order, viewType);
        
        if (viewType === 'pending') {
            const groupKey = order.deliveryDate || 'Sem Data';
            const columnContent = findOrCreateKanbanColumn(groupKey);
            if (!columnContent) return; // Segurança

            const cardsInColumn = Array.from(columnContent.querySelectorAll('.bg-white'));
            let inserted = false;
            for (const existingCard of cardsInColumn) {
                if (order.clientName.localeCompare(existingCard.querySelector('h3').textContent) < 0) {
                    columnContent.insertBefore(card, existingCard);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) columnContent.appendChild(card);
            updateKanbanColumnCounter(columnContent);
        } else {
            const allCards = Array.from(listEl.querySelectorAll('.bg-white'));
            let inserted = false;
            const orderDate = new Date(order.deliveryDate || 0);
            for (const existingCard of allCards) {
                if (orderDate > new Date(existingCard.dataset.deliveryDate || 0)) {
                    listEl.insertBefore(card, existingCard);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) listEl.appendChild(card);
        }
    }

    const placeholder = listEl.querySelector('.orders-placeholder');
    if (placeholder) placeholder.remove();
};

export const updateOrderCard = (order, viewType) => {
    const listEl = getOrdersList();
    if (!listEl) return;

    const existingCards = listEl.querySelectorAll(`[data-id="${order.id}"]`);
    if (existingCards.length === 0) { 
        addOrderCard(order, viewType); 
        return; 
    }

    existingCards.forEach(card => {
        const oldColumnContent = card.closest('.kanban-column-content');
        card.remove();
        if (oldColumnContent) updateKanbanColumnCounter(oldColumnContent);
    });

    addOrderCard(order, viewType);
};

export const removeOrderCard = (orderId) => {
    const listEl = getOrdersList();
    if (!listEl) return;

    const cards = listEl.querySelectorAll(`[data-id="${orderId}"]`);
    cards.forEach(card => {
        const columnContent = card.closest('.kanban-column-content');
        card.remove();
        if (columnContent) updateKanbanColumnCounter(columnContent);
    });
    
    if (listEl.querySelectorAll('.bg-white').length === 0) {
        showOrdersPlaceholder(listEl.classList.contains('kanban-board') ? 'pending' : 'delivered');
    }
};

const showOrdersPlaceholder = (viewType) => {
    if (window.USER_ROLE === 'production') return;

    const listEl = getOrdersList();
    if (!listEl) return;

    const message = viewType === 'pending' ? 'Nenhum pedido pendente.' : 'Nenhum pedido entregue encontrado.';
    const colSpanClass = viewType === 'pending' ? 'w-full' : 'col-span-full';
    listEl.innerHTML = `<div class="${colSpanClass} text-center py-10 text-gray-500 orders-placeholder">${message}</div>`;
};

export const renderOrders = async (allOrders, currentOrdersView) => {
    await setupOrderListContainer(currentOrdersView);
    
    let ordersToRender;
    
    if (currentOrdersView === 'pending') {
        ordersToRender = allOrders.filter(o => o.orderStatus !== 'Entregue');
        ordersToRender.sort((a, b) => {
            const dateA = a.deliveryDate || '9999-12-31';
            const dateB = b.deliveryDate || '9999-12-31';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return a.clientName.localeCompare(b.clientName);
        });
    } else { 
        ordersToRender = allOrders.filter(o => o.orderStatus === 'Entregue');
        ordersToRender.sort((a, b) => {
            const dateA = a.deliveryDate || '0000-01-01';
            const dateB = b.deliveryDate || '0000-01-01';
            return dateB.localeCompare(dateA);
        });
    }

    if (ordersToRender.length === 0) {
        showOrdersPlaceholder(currentOrdersView);
    } else {
        ordersToRender.forEach(order => addOrderCard(order, currentOrdersView));
    }

    // Buscamos o loading do DOM dinamicamente
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
};

const sortSizes = (sizesObject) => {
    return Object.entries(sizesObject).sort((a, b) => {
        const indexA = SIZES_ORDER.indexOf(a[0]);
        const indexB = SIZES_ORDER.indexOf(b[0]);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
};

// --- VISUALIZAÇÃO DETALHADA (MODAL) - MANTIDO INTACTO DA SUA VERSÃO ---

export const viewOrder = (order, targetPartIndex = null) => {
    if (!order) return;

    const currentPlan = getUserPlan();
    const isPro = currentPlan === 'pro';
    const isProduction = window.USER_ROLE === 'production'; 

    let subTotal = 0;

    let partsHtml = (order.parts || []).map((p, index) => {
        // MÁGICA DA FÁBRICA: Esconde as outras peças se estivermos focados em uma específica
        if (isProduction && targetPartIndex !== null && index != targetPartIndex) return '';

        const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
        const specificQty = (p.specifics || []).length;
        const detailedQty = (p.details || []).length;

        const standardSub = standardQty * (p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0);
        const specificSub = specificQty * (p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0);
        const detailedSub = detailedQty * (p.unitPrice || 0);

        const partSubtotal = standardSub + specificSub + detailedSub;
        subTotal += partSubtotal;

        let itemsDetailHtml = '';
        if (p.partInputType === 'comum') {
            let standardSizesHtml = p.sizes && Object.keys(p.sizes).length > 0 ? Object.entries(p.sizes).map(([cat, sizes]) => `<strong>${cat}:</strong> ${sortSizes(sizes).map(([size, qty]) => `${size}(${qty})`).join(', ')}`).join('<br>') : '';
            let specificSizesHtml = p.specifics && p.specifics.length > 0 ? '<br><strong>Específicos:</strong><br>' + p.specifics.map(s => `&nbsp;&nbsp;- L: ${s.width || 'N/A'}, A: ${s.height || 'N/A'} (${s.observation || 'Sem obs.'})`).join('<br>') : '';
            if (standardSizesHtml || specificSizesHtml) itemsDetailHtml = `<div class="text-xs text-gray-600 pl-2 mt-1">${standardSizesHtml}${specificSizesHtml}</div>`;
        } else if (p.partInputType === 'detalhado' && p.details && p.details.length > 0) {
            itemsDetailHtml = '<div class="text-xs text-gray-600 pl-2 mt-1">' + p.details.map(d => `${d.name || ''} - ${d.size || ''} - ${d.number || ''}`).join('<br>') + '</div>';
        }

        let unitPriceHtml = '';
        if(p.partInputType === 'comum') {
            if(standardQty > 0) unitPriceHtml += `R$ ${(p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0).toFixed(2)} (Padrão)<br>`;
            if(specificQty > 0) unitPriceHtml += `R$ ${(p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0).toFixed(2)} (Específico)`;
        } else {
            unitPriceHtml = `R$ ${(p.unitPrice || 0).toFixed(2)}`;
        }

        let partLinkBtn = '';
        if (isPro && p.partInputType === 'detalhado' && !isProduction) {
            partLinkBtn = `<button data-part-index="${index}" class="generate-part-link-btn ml-2 text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded hover:bg-indigo-50" title="Copiar Link de Preenchimento para ${p.type}"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></button>`;
        }

        // [NOVO] Lê o status fracionado da peça (O Marco Zero Universal)
        const itemStage = p.status_producao || 'Não Iniciado';
        const stageBadge = `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap shadow-sm">${itemStage}</span>`;

        // --- INÍCIO: ZONA DO MOCKUP INDIVIDUAL NO MODAL ---
        let mockupThumbHtml = '';
        if (p.mockupPeca) {
            mockupThumbHtml = `
                <a href="${p.mockupPeca}" target="_blank" class="shrink-0 ml-2 relative z-10" title="Ver Arte em tela cheia">
                    <img src="${p.mockupPeca}" class="w-8 h-8 object-contain rounded border border-gray-300 bg-white hover:scale-[3] origin-left transition-transform duration-200 shadow-sm cursor-pointer" alt="Arte">
                </a>`;
        }
        // --- FIM: ZONA DO MOCKUP INDIVIDUAL NO MODAL ---

        return `
            <tr>
                <td class="py-1 px-2 border">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center font-medium text-gray-800">
                            <span>${p.type}</span>${mockupThumbHtml}
                        </div>
                        ${partLinkBtn}
                    </div>
                    ${itemsDetailHtml}
                </td>
                <td class="py-1 px-2 border">${p.material}</td>
                <td class="py-1 px-2 border">${p.colorMain}</td>
                <td class="py-1 px-2 border text-center">${standardQty + specificQty + detailedQty}</td>
                <td class="py-1 px-2 border text-center">${stageBadge}</td> <td class="py-1 px-2 border text-right ${isProduction ? 'hidden' : ''}">${unitPriceHtml.trim()}</td>
                <td class="py-1 px-2 border text-right font-semibold ${isProduction ? 'hidden' : ''}">R$ ${partSubtotal.toFixed(2)}</td>
            </tr>`;
    }).join('');

    const discount = order.discount || 0;
    const grandTotal = subTotal - discount;
    const remaining = grandTotal - (order.downPayment || 0);

    let paymentSourceDisplay = 'N/A';
    let paymentDateDisplay = 'N/A';

    if (order.payments && Array.isArray(order.payments) && order.payments.length > 0) {
        const sources = order.payments.map(p => `${p.source === 'caixa' ? 'Caixa' : (p.source === 'banco' ? 'Banco' : p.source)} (R$ ${parseFloat(p.amount).toFixed(2)})`);
        paymentSourceDisplay = sources.join(', ');
        const lastPayment = order.payments[order.payments.length - 1];
        if (lastPayment && lastPayment.date) {
            paymentDateDisplay = new Date(lastPayment.date + 'T00:00:00').toLocaleDateString('pt-br');
            if (order.payments.length > 1) paymentDateDisplay += ' (Múltiplas)';
        }
    } else {
        paymentSourceDisplay = order.paymentFinSource === 'caixa' ? 'Caixa' : (order.paymentFinSource === 'banco' ? 'Banco' : 'N/A');
        if (order.downPaymentDate) paymentDateDisplay = new Date(order.downPaymentDate + 'T00:00:00').toLocaleDateString('pt-br');
    }

    const paymentFinStatusText = order.paymentFinStatus === 'a_receber' ? 'A Receber' : 'Recebido';

    // --- INÍCIO: ZONA DE ARQUIVOS INTELIGENTE (Fábrica vs Gestor) ---
    let arquivosHtml = '';
    let tituloArquivos = 'Arquivos do Pedido';
    
    if (isProduction && targetPartIndex !== null) {
        tituloArquivos = 'Arte da Peça (Para Produção)';
        const part = order.parts[targetPartIndex];
        if (part.mockupPeca) {
            arquivosHtml = `<a href="${part.mockupPeca}" target="_blank"><img src="${part.mockupPeca}" class="w-32 h-32 object-cover border rounded-md mockup-image hover:scale-[3] origin-left transition-transform duration-200 shadow-sm" alt="Arte da Peça"></a>`;
        } else {
            arquivosHtml = '<span class="text-sm text-gray-500 italic">Nenhuma arte individual atrelada a esta peça.</span>';
        }
    } else {
        // Gestor vê os arquivos normais
        arquivosHtml = (order.mockupUrls || []).map(url => `<a href="${url}" target="_blank"><img src="${url}" class="w-32 h-32 object-cover border rounded-md mockup-image hover:scale-[3] origin-left transition-transform duration-200 shadow-sm"></a>`).join('') || '<span class="text-sm text-gray-500 italic">Nenhum arquivo.</span>';
    }
    // --- FIM: ZONA DE ARQUIVOS INTELIGENTE ---

    let financialSectionHtml = '';
    let extraFooterButtons = '';

    if (!isProduction) {
        // --- INÍCIO: CÁLCULO TOTAL DO RAIO-X PARA O MODAL ---
        let totalCustoTerceiros = 0;
        (order.parts || []).forEach(p => {
            if (p.outsourcedCosts && p.outsourcedCosts.length > 0) {
                const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
                const specificQty = (p.specifics || []).length;
                const detailedQty = (p.details || []).length;
                const partTotalQty = standardQty + specificQty + detailedQty;
                
                const partUnitCost = p.outsourcedCosts.reduce((acc, cost) => acc + (parseFloat(cost.unitCost) || 0), 0);
                totalCustoTerceiros += (partUnitCost * partTotalQty);
            }
        });
        const lucroBrutoReal = grandTotal - totalCustoTerceiros;
        
        let raioXHtml = '';
        if (totalCustoTerceiros > 0) {
            raioXHtml = `
            <div class="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div class="text-sm">
                    <span class="text-gray-500 font-medium">Custos Terceirizados (Produção):</span> 
                    <span class="font-bold text-red-500 block">R$ ${totalCustoTerceiros.toFixed(2)}</span>
                </div>
                <div class="text-sm">
                    <span class="text-gray-500 font-medium">Sobra Real da Fábrica:</span> 
                    <span class="font-bold text-green-600 block text-lg">R$ ${lucroBrutoReal.toFixed(2)}</span>
                </div>
            </div>`;
        }
        // --- FIM: CÁLCULO TOTAL DO RAIO-X ---

        financialSectionHtml = `
            <h3 class="font-bold text-lg mt-4">Financeiro</h3>
            <div class="grid grid-cols-2 gap-x-8 mt-2 border-t pt-4 text-sm">
                <div><strong>Valor Bruto:</strong> R$ ${subTotal.toFixed(2)}</div>
                <div><strong>Desconto:</strong> R$ ${discount.toFixed(2)}</div>
                <div class="font-bold text-blue-600 text-lg"><strong>Valor Final (Cliente):</strong> R$ ${grandTotal.toFixed(2)}</div>
                <div class="font-bold text-red-600 text-lg"><strong>Resta Pagar:</strong> R$ ${remaining.toFixed(2)}</div>
            </div>
            ${raioXHtml}
            <div class="grid grid-cols-2 gap-x-8 mt-4 border-t pt-4 text-sm">
            <div class="grid grid-cols-2 gap-x-8 mt-2 border-t pt-4 text-sm">
                <div><strong>Valor Pago (Adiant.):</strong> R$ ${(order.downPayment || 0).toFixed(2)}</div>
                <div><strong>Forma de Pagamento:</strong> ${order.paymentMethod || 'N/A'}</div>
                <div><strong>Data do Pagamento:</strong> ${paymentDateDisplay}</div>
                <div><strong>Status do Pagamento:</strong> ${paymentFinStatusText}</div>
                <div><strong>Origem do Pagamento:</strong> ${paymentSourceDisplay}</div>
            </div>`;

        extraFooterButtons = `
            <div class="relative inline-block text-left">
                <button id="whatsappMenuBtn" type="button" class="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-sm">WhatsApp</button>
                <div id="whatsappMenu" class="hidden absolute right-0 bottom-full mb-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
                    <div class="py-1">
                        <button id="btnOpenWhatsAppAction" data-id="${order.id}" class="w-full text-left px-4 py-3 text-sm hover:bg-gray-100">Abrir Conversa</button>
                        <button id="btnCopyLinkAction" data-id="${order.id}" class="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 border-t border-gray-100">Copiar Link de Aprovação</button>
                    </div>
                </div>
            </div>
            <div class="relative inline-block text-left">
                <button id="documentsBtn" type="button" class="bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors shadow-sm">Documentos</button>
                <div id="documentsMenu" class="hidden absolute right-0 bottom-full mb-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
                    <div class="py-1">
                        <button id="comprehensivePdfBtn" data-id="${order.id}" class="w-full text-left px-4 py-3 text-sm hover:bg-gray-100">PDF do Pedido</button>
                        <button id="productionPdfBtn" data-id="${order.id}" class="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 border-t border-gray-100">OS de Produção</button>
                    </div>
                </div>
            </div>`;
    }

    const modalContent = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div id="printable-details" class="p-8 pb-8 overflow-y-auto">
                <h2 class="text-2xl font-bold mb-4">Detalhes do Pedido - ${isProduction ? 'ID#'+order.id.slice(0,6).toUpperCase() : order.clientName}</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mb-4 items-center">
                    ${!isProduction ? `<div><strong>Telefone:</strong> ${order.clientPhone || 'N/A'}</div>` : ''}
                    <div><strong>Status Geral:</strong> <span class="status-badge status-${(order.orderStatus || 'Pendente').replace(/[\s/]/g, '-').toLowerCase()} bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-bold border border-gray-300 ml-1 shadow-sm">${order.orderStatus || 'Pendente'}</span></div>
                    <div><strong>Data de Entrega:</strong> ${order.deliveryDate ? new Date(order.deliveryDate + 'T00:00:00').toLocaleDateString('pt-br') : 'N/A'}</div>
                </div>
                <h3 class="font-bold text-lg mt-4">Peças em Produção</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm mt-2 min-w-[600px]">
                        <thead><tr class="bg-gray-100"><th class="px-2 py-1">Tipo/Detalhes</th><th class="px-2 py-1">Material</th><th class="px-2 py-1">Cor</th><th class="px-2 py-1 text-center">Qtd</th><th class="px-2 py-1 text-center">Etapa Atual</th><th class="px-2 py-1 text-right ${isProduction ? 'hidden' : ''}">V. Un.</th><th class="px-2 py-1 text-right ${isProduction ? 'hidden' : ''}">Subtotal</th></tr></thead>
                        <tbody>${partsHtml}</tbody>
                    </table>
                </div>
                <h3 class="font-bold text-lg mt-4">Observação Geral</h3>
                <p class="text-sm p-2 border rounded-md mt-2 min-h-[40px]">${order.generalObservation || 'Nenhuma.'}</p>

                ${financialSectionHtml}

            <div id="mockupContainerView" class="pt-4 border-t mt-4">
                <h3 class="font-bold text-lg text-blue-800">${tituloArquivos}</h3>
                <div class="flex flex-wrap gap-4 mt-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
                    ${arquivosHtml}
                </div>
            </div>
        </div>
            <div class="p-4 bg-gray-100 border-t flex flex-col sm:flex-row justify-end items-center space-y-2 sm:space-y-0 sm:space-x-4">
                ${extraFooterButtons}
                <button id="closeViewBtn" class="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors shadow-sm">Fechar</button>
            </div>
        </div>`;
    DOM.viewModal.innerHTML = modalContent;
    DOM.viewModal.classList.remove('hidden');

    const setupDropdown = (btnId, menuId) => {
        const btn = document.getElementById(btnId);
        const menu = document.getElementById(menuId);
        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('[id$="Menu"]').forEach(m => { if (m.id !== menuId) m.classList.add('hidden'); });
                menu.classList.toggle('hidden');
            });
        }
    };
    setupDropdown('whatsappMenuBtn', 'whatsappMenu');
    setupDropdown('documentsBtn', 'documentsMenu');

    const btnClose = document.getElementById('closeViewBtn');
    if (btnClose) btnClose.addEventListener('click', () => DOM.viewModal.classList.add('hidden'));

    const handleGenerateLink = async (targetBtn, partIndex = null) => {
        const originalContent = targetBtn.innerHTML;
        targetBtn.innerHTML = partIndex !== null ? '⏳' : '⏳ Gerando...';

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Usuário não autenticado.");

            const userMappingRef = doc(db, "user_mappings", currentUser.uid);
            const userMappingSnap = await getDoc(userMappingRef);

            let companyId = null;
            if (userMappingSnap.exists()) {
                companyId = userMappingSnap.data().companyId;
            } else {
                companyId = currentUser.uid;
            }

            if (!companyId) throw new Error("ID da Empresa não encontrado.");

            const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            const baseUrl = window.location.origin + path;

            let link = `${baseUrl}/preencher.html?cid=${companyId}&oid=${order.id}`;
            if (partIndex !== null) {
                link += `&partIndex=${partIndex}`;
            }

            await navigator.clipboard.writeText(link);

            if (partIndex !== null) {
                targetBtn.innerHTML = `<svg class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
            } else {
                targetBtn.innerHTML = `<svg class="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg> Link Copiado!`;
                targetBtn.classList.add('bg-green-50');
            }

            setTimeout(() => {
                targetBtn.innerHTML = originalContent;
                if (partIndex === null) targetBtn.classList.remove('bg-green-50');
            }, 3000);

        } catch (err) {
            console.error('Erro na geração do link:', err);
            alert(`Erro: ${err.message}`);
            targetBtn.innerHTML = originalContent;
        }
    };

    if (!isProduction) {
        document.querySelectorAll('.generate-part-link-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = btn.dataset.partIndex;
                handleGenerateLink(btn, index);
            });
        });
    }
};
