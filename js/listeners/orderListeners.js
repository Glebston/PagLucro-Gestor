// js/listeners/orderListeners.js
// ==========================================================
// MÓDULO ORDER LISTENERS (v5.34.0 - UX Receipt Fix)
// ==========================================================

// [REFATORADO] Importações divididas por responsabilidade

// 1. Motor de PDF
import { 
    generateReceiptPdf, 
    generateComprehensivePdf, 
    generateProductionOrderPdf 
} from '../services/pdfService.js';

// 2. Serviço de Imagens (Upload Nativo)
import { 
    uploadImageToStorage 
} from '../services/imageService.js';

// 3. Ferramentas Administrativas
import { runDatabaseMigration } from '../admin/migrationTools.js';

// 4. CRM - Ficha de Ouro (Cérebro e Templates)
import { getCustomerMetrics } from '../services/customerService.js';
import { 
    customerDashboardModalTemplateHTML, 
    customerHistoryRowTemplateHTML, 
    createNodeFromHTML 
} from '../ui/templates.js';

// --- INÍCIO: ZONA DE BLINDAGEM DO LINK (Firebase) ---
import { db, auth } from '../firebaseConfig.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// --- FIM: ZONA DE BLINDAGEM ---

/**
 * Coleta os dados do formulário do pedido.
 */

function collectFormData(UI) {
    const paymentList = UI.getPaymentList ? UI.getPaymentList() : [];
    const totalDownPayment = paymentList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

    const paymentMethodValue = UI.DOM.paymentMethod ? UI.DOM.paymentMethod.value : '';
   
    // Lógica Híbrida: Determina os campos legados baseados no último pagamento da lista
    let legacySource = 'banco'; 
    let legacyDate = new Date().toISOString().split('T')[0]; 

    if (paymentList.length > 0) {
        const lastPayment = paymentList[paymentList.length - 1];
        legacySource = lastPayment.source || 'banco';
        legacyDate = lastPayment.date || legacyDate;
    }
    
    const data = {
        clientName: UI.DOM.clientName.value, 
        clientPhone: UI.DOM.clientPhone.value, 
        orderStatus: UI.DOM.orderStatus.value,
        orderDate: UI.DOM.orderDate.value, 
        deliveryDate: UI.DOM.deliveryDate.value, 
        generalObservation: UI.DOM.generalObservation.value,
        parts: [], 
        downPayment: totalDownPayment, 
        discount: parseFloat(UI.DOM.discount.value) || 0,
        paymentMethod: paymentMethodValue, 
        mockupUrls: Array.from(UI.DOM.existingFilesContainer.querySelectorAll('a')).map(a => a.href),
        
        // --- BLOCO CORRIGIDO ---
        payments: paymentList, // <--- AQUI: Salvamos a lista real no banco
        downPaymentDate: legacyDate, // <--- AQUI: Usa a data do pagamento real
        paymentFinSource: legacySource, // <--- AQUI: Usa a fonte (Caixa/Banco) real
        paymentFinStatus: 'pago'
    };
    
    // Coleta Peças
    UI.DOM.partsContainer.querySelectorAll('.part-item').forEach(p => {
        const id = p.dataset.partId;
        
        // --- INÍCIO: ZONA DE CAPTURA (Multi-Mockups Nativos) ---
        let mockupsAtuais = [];
        
        if (p._uploadedMockupUrls && p._uploadedMockupUrls.length > 0) {
            mockupsAtuais = p._uploadedMockupUrls; // Pegou URLs novas recém-upadas no Firebase
        } else {
            // Tenta resgatar imagens antigas (ou já salvas) renderizadas no DOM
            const previewImgs = p.querySelectorAll('.mockup-preview');
            previewImgs.forEach(img => {
                if (!img.classList.contains('hidden') && img.src.startsWith('http')) {
                    mockupsAtuais.push(img.src);
                }
            });
        }

        // [LEGADO]: Mantém mockupPeca para não quebrar PDFs antigos, mas a nova fonte da verdade é mockupPecas (array)
        const urlLegada = mockupsAtuais.length > 0 ? mockupsAtuais[0] : null;

        const part = { 
            type: p.querySelector('.part-type').value, 
            material: p.querySelector('.part-material').value, 
            colorMain: p.querySelector('.part-color-main').value, 
            partInputType: p.dataset.partType, 
            sizes: {}, 
            details: [], 
            specifics: [], 
            unitPriceStandard: 0, 
            unitPriceSpecific: 0, 
            unitPrice: 0,
            outsourcedCosts: p._outsourcedCosts ? [...p._outsourcedCosts] : [],
            mockupPeca: urlLegada, // Suporte ao legado (1 imagem)
            mockupPecas: mockupsAtuais // A nova matriz de múltiplas imagens!
        };
        // --- FIM: ZONA DE CAPTURA ---
        
        if (part.partInputType === 'comum') {
            p.querySelectorAll('.size-input').forEach(i => { if (i.value) { const {category, size} = i.dataset; if (!part.sizes[category]) part.sizes[category] = {}; part.sizes[category][size] = parseInt(i.value, 10); }});
            p.querySelectorAll('.specific-size-row').forEach(r => { const w = r.querySelector('.item-spec-width').value.trim(), h = r.querySelector('.item-spec-height').value.trim(), o = r.querySelector('.item-spec-obs').value.trim(); if(w||h||o) part.specifics.push({ width:w, height:h, observation:o }); });
            const std = UI.DOM.financialsContainer.querySelector(`.financial-item[data-part-id="${id}"][data-price-group="standard"]`);
            if(std) part.unitPriceStandard = parseFloat(std.querySelector('.financial-price').value) || 0;
            const spec = UI.DOM.financialsContainer.querySelector(`.financial-item[data-part-id="${id}"][data-price-group="specific"]`);
            if(spec) part.unitPriceSpecific = parseFloat(spec.querySelector('.financial-price').value) || 0;
        } else {
            p.querySelectorAll('.detailed-item-row').forEach(r => { const n = r.querySelector('.item-det-name').value, s = r.querySelector('.item-det-size').value, num = r.querySelector('.item-det-number').value; if(n||s||num) part.details.push({name:n, size:s, number:num}); });
            const dtl = UI.DOM.financialsContainer.querySelector(`.financial-item[data-part-id="${id}"][data-price-group="detailed"]`);
            if(dtl) part.unitPrice = parseFloat(dtl.querySelector('.financial-price').value) || 0;
        }
        data.parts.push(part);
    });
    return data;
}

export function initializeOrderListeners(UI, deps) {

    const { getState, setState, getOptionsFromStorage, services, userCompanyName } = deps;

    // --- 1. GATILHO SECRETO DE MIGRAÇÃO ---
    if (UI.DOM.modalTitle) {
        UI.DOM.modalTitle.addEventListener('click', (e) => {
            if (e.shiftKey) {
                runDatabaseMigration(UI.showInfoModal);
            }
        });
    } // <--- FECHE O IF DO MODAL AQUI

    // --- 2. NOVA FUNCIONALIDADE: BUSCA GLOBAL COM CONTEXTO (REFATORADO PARA SPA) ---
    // Usamos Event Delegation no document para capturar o input mesmo depois que a tela é injetada
    document.addEventListener('input', (e) => {
        if (e.target.id === 'globalSearchInput') {
            const term = e.target.value.trim().toLowerCase();
            const searchContainer = document.getElementById('searchResultsContainer');
            const dashboard = document.getElementById('ordersDashboard');
            const clearSearchBtn = document.getElementById('clearSearchBtn');
            const resultsPending = document.getElementById('resultsPendingList');
            const resultsDelivered = document.getElementById('resultsDeliveredList');
            const wrapperPending = document.getElementById('resultsPendingWrapper');
            const wrapperDelivered = document.getElementById('resultsDeliveredWrapper');
            const noResults = document.getElementById('noResultsMessage');

            // Proteção extra caso a tela ainda esteja montando
            if (!searchContainer || !dashboard) return;

            // 1. Controle do Botão "X" (Limpar)
            if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', term.length === 0);

            // 2. Se a busca for curta, reseta para o Dashboard normal
            if (term.length < 2) {
                searchContainer.classList.add('hidden');
                dashboard.classList.remove('hidden');
                return;
            }

            // 3. Ativa Modo de Busca
            dashboard.classList.add('hidden');
            searchContainer.classList.remove('hidden');
            
            // 4. Filtra os Pedidos (Nome, ID ou Telefone)
            const allOrders = services.getAllOrders();
            const matches = allOrders.filter(o => {
                const searchStr = `${o.clientName} ${o.id} ${o.clientPhone || ''}`.toLowerCase();
                return searchStr.includes(term);
            });

            // 5. Limpa e Segrega os Resultados
            if(resultsPending) resultsPending.innerHTML = '';
            if(resultsDelivered) resultsDelivered.innerHTML = '';

            const pendingOrders = matches.filter(o => o.orderStatus !== 'Entregue');
            const deliveredOrders = matches.filter(o => o.orderStatus === 'Entregue');

            // 6. Renderiza Resultados Pendentes (Visual Kanban Card)
            if (pendingOrders.length > 0) {
                if(wrapperPending) wrapperPending.classList.remove('hidden');
                pendingOrders.forEach(order => {
                    if (UI.generateOrderCardHTML && resultsPending) {
                        const card = UI.generateOrderCardHTML(order, 'pending');
                        resultsPending.appendChild(card);
                    }
                });
            } else {
                if(wrapperPending) wrapperPending.classList.add('hidden');
            }

            // 7. Renderiza Resultados Entregues (Visual Grid Card)
            if (deliveredOrders.length > 0) {
                if(wrapperDelivered) wrapperDelivered.classList.remove('hidden');
                deliveredOrders.forEach(order => {
                    if (UI.generateOrderCardHTML && resultsDelivered) {
                        const card = UI.generateOrderCardHTML(order, 'delivered');
                        resultsDelivered.appendChild(card);
                    }
                });
            } else {
                if(wrapperDelivered) wrapperDelivered.classList.add('hidden');
            }

            // 8. Mensagem "Nenhum resultado"
            if (pendingOrders.length === 0 && deliveredOrders.length === 0) {
                if(noResults) noResults.classList.remove('hidden');
            } else {
                if(noResults) noResults.classList.add('hidden');
            }
        }
    });

    // Funcionalidade do botão Limpar (X) via Delegação
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#clearSearchBtn');
        if (btn) {
            const searchInput = document.getElementById('globalSearchInput');
            if(searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input', { bubbles: true })); 
                searchInput.focus();
            }
        }
    });

    // ==========================================================
    // INÍCIO DO BLOCO DE LAZY LOADING E LISTENERS DO MODAL
    // ==========================================================
    let isModalListenersAttached = false;

    const attachModalListenersOnce = () => {
        if (isModalListenersAttached) return;

        // 1. Automação de Resposta de Ajuste
        UI.DOM.orderStatus.addEventListener('change', (e) => {
            if (e.target.value === 'Aguardando Aprovação') {
                const today = new Date().toLocaleDateString('pt-BR');
                const autoMessage = `[Ajuste Realizado em ${today}]: Arte atualizada. Por favor, confira novamente.`;
                const currentObs = UI.DOM.generalObservation.value;
                if (!currentObs.includes(autoMessage)) {
                    const prefix = currentObs ? '\n\n' : '';
                    UI.DOM.generalObservation.value = currentObs + prefix + autoMessage;
                    UI.DOM.generalObservation.classList.add('ring-2', 'ring-green-500', 'transition-all', 'duration-500');
                    setTimeout(() => UI.DOM.generalObservation.classList.remove('ring-2', 'ring-green-500'), 1000);
                }
            }
        });

        // --- INÍCIO: INTELIGÊNCIA DO MOCKUP GLOBAL (Modo Clássico) ---
        const globalMockupInput = UI.DOM.mockupFiles;
        if (globalMockupInput) {
            // Tenta achar a caixa pontilhada em volta do botão (baseado no padrão Tailwind)
            const globalDropzone = globalMockupInput.closest('.border-dashed') || globalMockupInput.parentElement;
            
            if (globalDropzone) {
                // Efeitos visuais ao arrastar por cima
                globalDropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    globalDropzone.classList.add('bg-blue-50', 'border-blue-400');
                });
                
                globalDropzone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    globalDropzone.classList.remove('bg-blue-50', 'border-blue-400');
                });
                
                // Evento de Soltar a imagem (Drop)
                globalDropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    globalDropzone.classList.remove('bg-blue-50', 'border-blue-400');
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const dt = new DataTransfer();
                        // Mantém as imagens que já estavam lá e adiciona as novas
                        if (globalMockupInput.files) Array.from(globalMockupInput.files).forEach(f => dt.items.add(f));
                        Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
                        
                        globalMockupInput.files = dt.files;
                        globalMockupInput.dispatchEvent(new Event('change', { bubbles: true })); // Atualiza o texto nativo da tela
                    }
                });
            }

            // Evento Mágico de Colar (Ctrl+V) em qualquer lugar do Modal
            document.addEventListener('paste', (e) => {
                const orderModalOpen = UI.DOM.orderModal && !UI.DOM.orderModal.classList.contains('hidden');
                if (!orderModalOpen) return;

                // BLINDAGENS: Ignora se estiver digitando texto ou colando na área da peça individual
                if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
                if (e.target.tagName === 'TEXTAREA') return;
                if (e.target.closest('.mockup-dropzone')) return; 

                const clipboardItems = e.clipboardData.items;
                let hasImage = false;
                const dt = new DataTransfer();

                if (globalMockupInput.files) {
                    Array.from(globalMockupInput.files).forEach(f => dt.items.add(f));
                }

                for (let i = 0; i < clipboardItems.length; i++) {
                    if (clipboardItems[i].type.indexOf('image') !== -1) {
                        const imageFile = clipboardItems[i].getAsFile();
                        const newFile = new File([imageFile], `imagem-colada-${Date.now()}.png`, { type: imageFile.type });
                        dt.items.add(newFile);
                        hasImage = true;
                    }
                }

                if (hasImage) {
                    globalMockupInput.files = dt.files;
                    globalMockupInput.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Pisca a área global de verde para dar feedback visual de sucesso
                    if (globalDropzone) {
                        globalDropzone.classList.add('bg-green-50', 'border-green-400', 'transition-colors', 'duration-300');
                        setTimeout(() => globalDropzone.classList.remove('bg-green-50', 'border-green-400'), 800);
                    }
                }
            });
        }
        // --- FIM: INTELIGÊNCIA DO MOCKUP GLOBAL ---

        // 2. Salvar Pedido
        UI.DOM.orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.DOM.saveBtn.disabled = true; 
            UI.DOM.uploadIndicator.classList.remove('hidden');
            
            try {
                // Upload das imagens globais (Modo Clássico - Agora Nativo)
                const files = UI.DOM.mockupFiles.files;
                const uploadPromises = Array.from(files).map(file => uploadImageToStorage(file));
                const newUrls = (await Promise.all(uploadPromises)).filter(Boolean);
                
                // --- INÍCIO: MISSÃO CRÍTICA (Upload Bidimensional Nativo) ---
                const partsNodes = Array.from(UI.DOM.partsContainer.querySelectorAll('.part-item'));
                
                const partUploadPromises = partsNodes.map(async (p) => {
                    // Se existe o array de arquivos (novo sistema)
                    if (p._mockupFiles && p._mockupFiles.length > 0) {
                        // Varre cada imagem dessa peça específica
                        const internalPromises = p._mockupFiles.map(file => uploadImageToStorage(file));
                        const urls = await Promise.all(internalPromises);
                        p._uploadedMockupUrls = urls.filter(Boolean); // Guarda as URLs do Firebase na memória da peça
                    } 
                    // Se for legado (edição de pedido antigo com apenas 1 arquivo preso na memória velha)
                    else if (p._mockupFile) {
                        const url = await uploadImageToStorage(p._mockupFile);
                        p._uploadedMockupUrls = url ? [url] : [];
                    }
                });
                
                await Promise.all(partUploadPromises); // Sobe TODAS as peças e TODAS as imagens simultaneamente!
                // --- FIM: MISSÃO CRÍTICA ---
                
                const orderData = collectFormData(UI); 
                orderData.mockupUrls.push(...newUrls);
                
                let orderId = UI.DOM.orderId.value ? UI.DOM.orderId.value.trim() : '';
                if (orderId) orderData.id = orderId;

                const savedOrderId = await services.saveOrder(orderData, orderId); 
                if (!orderId && savedOrderId) {
                    await services.saveOrder({ id: savedOrderId }, savedOrderId);
                }
                
                const clientName = orderData.clientName;
                const existingTransactions = services.getTransactionsByOrderId ? services.getTransactionsByOrderId(savedOrderId) : [];
                const newPaymentList = UI.getPaymentList ? UI.getPaymentList() : [];

                const idsInNewList = newPaymentList.map(p => p.id).filter(id => id);
                for (const existing of existingTransactions) {
                    // [CORREÇÃO SÊNIOR] Removemos a trava da Quitação.
                    // Agora, qualquer lançamento removido da telinha do modal será apagado do Financeiro.
                    if (!idsInNewList.includes(existing.id)) {
                        await services.deleteTransaction(existing.id);
                    }
                }

                for (const payment of newPaymentList) {
                    const transactionData = {
                        date: payment.date,
                        description: `Adiantamento Pedido - ${clientName}`,
                        amount: parseFloat(payment.amount),
                        type: 'income',
                        category: 'Adiantamento de Pedido',
                        source: payment.source,
                        status: 'pago',
                        orderId: savedOrderId
                    };
                    await services.saveTransaction(transactionData, payment.id);
                }

                UI.hideOrderModal();
                
                if (orderData.orderStatus === 'Entregue') {
                    const generate = await UI.showConfirmModal(
                        "Pedido salvo com sucesso! Deseja gerar o Recibo de Quitação e Entrega?", 
                        "Sim, gerar recibo", 
                        "Não, obrigado"
                    );
                    if (generate) {
                        const fullOrderData = { ...orderData, id: savedOrderId };
                        await generateReceiptPdf(fullOrderData, userCompanyName(), UI.showInfoModal);
                    }
                } else {
                     UI.showInfoModal("Pedido salvo com sucesso!");
                }

            } catch (error) { 
                console.error("Erro ao salvar pedido:", error);
                UI.showInfoModal(`Erro ao salvar: ${error.message || 'Verifique o console'}`); 
            } finally { 
                UI.DOM.saveBtn.disabled = false; 
                UI.DOM.uploadIndicator.classList.add('hidden'); 
            }
        });

        // 3. Listeners Menores (Protegidos)
        UI.DOM.cancelBtn.addEventListener('click', () => UI.hideOrderModal());
        UI.DOM.addPartBtn.addEventListener('click', () => { 
            let { partCounter } = getState();
            partCounter++; 
            UI.addPart({}, partCounter); 
            setState({ partCounter });
        });
        UI.DOM.discount.addEventListener('input', UI.updateFinancials);
        UI.DOM.clientPhone.addEventListener('input', (e) => {
            e.target.value = UI.formatPhoneNumber(e.target.value);
        });
        UI.DOM.orderModal.addEventListener('click', (e) => {
            const optionsBtn = e.target.closest('button.manage-options-btn'); 
            if (optionsBtn) { 
                const currentOptionType = optionsBtn.dataset.type;
                setState({ currentOptionType });
                UI.openOptionsModal(currentOptionType, getOptionsFromStorage(currentOptionType)); 
            }
            const removeMockupBtn = e.target.closest('.remove-mockup-btn');
            if (removeMockupBtn) {
                removeMockupBtn.parentElement.remove(); 
            }
            const sourceBtn = e.target.closest('#downPaymentSourceContainer .source-selector');
            if (sourceBtn) {
                UI.updateSourceSelectionUI(UI.DOM.downPaymentSourceContainer, sourceBtn.dataset.source);
            }
        });

        isModalListenersAttached = true;
    };

    // Abertura do Modal de Novo Pedido (Com Lazy Loading Animado)
    UI.DOM.addOrderBtn.addEventListener('click', async () => { 
        const originalText = UI.DOM.addOrderBtn.innerHTML;
        UI.DOM.addOrderBtn.innerHTML = '<svg class="animate-spin h-5 w-5 sm:mr-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="hidden sm:inline">Carregando...</span>';
        
        await UI.ensureOrderModalLoaded();
        attachModalListenersOnce();
        
        UI.DOM.addOrderBtn.innerHTML = originalText;
        
        setState({ partCounter: 0 }); 
        UI.resetForm(); 
        UI.showOrderModal(); 
    });
    // ==========================================================
    // FIM DO BLOCO DE LAZY LOADING
    // ==========================================================

    // --- LISTENERS DA GRID (Refatorado para suportar Busca) ---
    
    // 1. Criamos a função lógica que sabe lidar com os cliques nos cards
    const handleOrderCardClick = async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        // Se clicar no botão de fechar (caso ele estivesse aqui por engano)
        if (btn.id === 'closeViewBtn') return; 

        // ==========================================================
        // [INÍCIO: CRM - FICHA DE OURO] Renderização do Modal
        // ==========================================================
        if (btn.classList.contains('open-customer-profile-btn')) {
            e.stopPropagation(); // Evita conflitos de clique
            const clientKey = btn.dataset.phone;
            const allOrders = services.getAllOrders();
            const metrics = getCustomerMetrics(clientKey, allOrders);
            
            // 1. Cria ou recupera o Modal no DOM (Lazy Loading)
            let modal = document.getElementById('customerDashboardModal');
            if (!modal) {
                modal = createNodeFromHTML(customerDashboardModalTemplateHTML);
                document.body.appendChild(modal);
                
                // Listeners de fechamento do Modal
                modal.querySelector('.close-customer-modal-btn').addEventListener('click', () => modal.classList.add('hidden'));
                modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.classList.add('hidden'); });
            }
            
            // 2. Preenche Header e KPIs
            const customerName = metrics.history.length > 0 ? metrics.history[0].clientName : clientKey;
            modal.querySelector('#cdm-customer-name').textContent = customerName;
            modal.querySelector('#cdm-customer-phone').textContent = clientKey !== customerName ? clientKey : 'Sem telefone';
            
            modal.querySelector('#cdm-ltv').textContent = `R$ ${metrics.ltv.toFixed(2).replace('.', ',')}`;
            modal.querySelector('#cdm-ticket').textContent = `R$ ${metrics.ticketMedio.toFixed(2).replace('.', ',')}`;
            
            const lastDateObj = metrics.lastOrderDate ? new Date(metrics.lastOrderDate + 'T00:00:00') : null;
            modal.querySelector('#cdm-last-date').textContent = lastDateObj ? lastDateObj.toLocaleDateString('pt-BR') : '--/--/----';
            modal.querySelector('#cdm-total-orders').textContent = metrics.totalOrders;
            
            // 3. Monta o Histórico de Pedidos
            const listContainer = modal.querySelector('#cdm-orders-list');
            listContainer.innerHTML = ''; 
            
            metrics.history.forEach(order => {
                const row = createNodeFromHTML(customerHistoryRowTemplateHTML);
                
                const rowDateObj = order.deliveryDate ? new Date(order.deliveryDate + 'T00:00:00') : null;
                row.querySelector('.cdm-row-date').textContent = rowDateObj ? rowDateObj.toLocaleDateString('pt-BR') : 'Sem Data';
                
                const statusBadge = row.querySelector('.cdm-row-status');
                statusBadge.textContent = order.orderStatus || 'Pendente';
                if (order.orderStatus === 'Entregue') {
                    statusBadge.classList.add('bg-green-100', 'text-green-800');
                } else {
                    statusBadge.classList.add('bg-gray-200', 'text-gray-800');
                }
                
                let desc = order.parts && order.parts.length > 0 ? order.parts.map(p => p.type).join(', ') : 'Pedido vazio';
                row.querySelector('.cdm-row-desc').textContent = desc;
                
                let totalPieces = 0;
                if (order.parts) {
                    order.parts.forEach(p => {
                        const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
                        const specificQty = (p.specifics || []).length;
                        const detailedQty = (p.details || []).length;
                        totalPieces += (standardQty + specificQty + detailedQty);
                    });
                }
                row.querySelector('.cdm-row-pieces').textContent = totalPieces;
                
                const orderTotal = order._calculatedTotal || 0;
                row.querySelector('.cdm-row-value').textContent = `R$ ${orderTotal.toFixed(2).replace('.', ',')}`;
                
                // Mágica: Atrela o ID do pedido ao botão de replicar da linha
                row.querySelector('.replicate-btn').dataset.id = order.id;
                
                listContainer.appendChild(row);
            });
            
            modal.classList.remove('hidden');
            return;
        }
        // ==========================================================
        // [FIM: CRM - FICHA DE OURO]
        // ==========================================================

        const id = btn.dataset.id;
        if (!id && !btn.id.includes('Pdf')) return;

        const order = id ? services.getOrderById(id) : null;

        if (btn.classList.contains('edit-btn') && order) {
            await UI.ensureOrderModalLoaded();
            attachModalListenersOnce();
            let { partCounter } = getState();
            partCounter = 0;
            const transactions = services.getTransactionsByOrderId ? services.getTransactionsByOrderId(id) : [];
            
            // [CORREÇÃO SÊNIOR] Puxa tanto os Adiantamentos quanto as Quitações antigas para a tela de edição!
            const downPayments = transactions.filter(t => t.category === 'Adiantamento de Pedido' || t.category === 'Quitação de Pedido');
            
            partCounter = UI.populateFormForEdit(order, partCounter);
            if (UI.setPaymentList) {
                UI.setPaymentList(downPayments);
            }
            setState({ partCounter });
            UI.showOrderModal();
            
        } else if (btn.classList.contains('replicate-btn') && order) {
            // [CRM - FICHA DE OURO] Esconde o modal de perfil para focar no novo pedido
            const cdmModal = document.getElementById('customerDashboardModal');
            if (cdmModal && !cdmModal.classList.contains('hidden')) {
                cdmModal.classList.add('hidden');
            }

            await UI.ensureOrderModalLoaded();
            attachModalListenersOnce();
            let { partCounter } = getState();
            partCounter = 0;
            partCounter = UI.populateFormForEdit(order, partCounter);
            setState({ partCounter });
            UI.DOM.orderId.value = ''; 
            UI.DOM.modalTitle.textContent = 'Novo Pedido (Replicado)';
            UI.DOM.orderStatus.value = 'Pendente'; 
            UI.DOM.orderDate.value = new Date().toISOString().split('T')[0];
            UI.DOM.deliveryDate.value = ''; 
            UI.DOM.discount.value = ''; 
            UI.updateFinancials();
            if (UI.setPaymentList) UI.setPaymentList([]);
            UI.showOrderModal();
            
        } else if (btn.classList.contains('delete-btn')) {
            UI.showConfirmModal("Tem certeza que deseja excluir este pedido?", "Excluir", "Cancelar")
              .then(async (confirmed) => {
                  if (confirmed) {
                      try {
                          await services.deleteAllTransactionsByOrderId(id);
                          await services.deleteOrder(id);
                          // Atualiza a busca se estiver ativa
                          const searchInput = document.getElementById('globalSearchInput');
                          if (searchInput && searchInput.value) {
                              searchInput.dispatchEvent(new Event('input'));
                          }
                      } catch (error) {
                          console.error("Erro ao excluir pedido e finanças:", error);
                          UI.showInfoModal("Falha ao excluir. Verifique o console.");
                      }
                  }
              });
        } else if (btn.classList.contains('view-btn') && order) {
            // [NOVO] Lê o índice da peça do card (se existir) para isolar a visualização na fábrica
            const cardElement = btn.closest('[data-part-index]');
            const targetPartIndex = cardElement && cardElement.dataset.partIndex ? parseInt(cardElement.dataset.partIndex, 10) : null;
            
            UI.viewOrder(order, targetPartIndex);
            UI.showViewModal();
            
        // [CORREÇÃO SÊNIOR] Erro de digitação 'pdatedOrderData' corrigido para 'updatedOrderData'
} else if (btn.classList.contains('reopen-btn') && order) {
    const confirmed = await UI.showConfirmModal(
        "Deseja reabrir este pedido?\n\nEle voltará para o painel de produção. Os lançamentos financeiros realizados serão mantidos.",
        "Sim, Reabrir",
        "Cancelar"
    );

    if (confirmed) {
        try {
            const updatedOrderData = { ...order, id: id };
            updatedOrderData.orderStatus = 'Pendente';
            updatedOrderData.reopened = true; // Marca o DNA de reabertura

            await services.saveOrder(updatedOrderData, id); // Variável corrigida aqui!
            
            const searchInput = document.getElementById('globalSearchInput');
            if (searchInput && searchInput.value) {
                searchInput.dispatchEvent(new Event('input'));
            } else {
                const toggleViewBtn = document.getElementById('toggleViewBtn');
                if (toggleViewBtn) toggleViewBtn.click();
            }
            
            UI.showInfoModal("Pedido reaberto! Verifique a aba de Pendentes.");
        } catch (error) {
            console.error("Erro ao reabrir pedido:", error);
            UI.showInfoModal("Erro ao reabrir o pedido.");
        }
    }
        } else if (btn.classList.contains('settle-and-deliver-btn') && order) {
            try {
                let totalValue = 0;
                (order.parts || []).forEach(p => {
                    const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
                    const specificQty = (p.specifics || []).length;
                    const detailedQty = (p.details || []).length;
                    const standardSub = standardQty * (p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0);
                    const specificSub = specificQty * (p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0);
                    const detailedSub = detailedQty * (p.unitPrice || 0);
                    totalValue += standardSub + specificSub + detailedSub;
                });
                totalValue -= (order.discount || 0);

                const adiantamentoExistente = order.downPayment || 0;
                const valorRestante = totalValue - adiantamentoExistente;

                const updatedOrderData = { ...order, id: id };
                updatedOrderData.downPayment = totalValue; 
                updatedOrderData.orderStatus = 'Entregue';

                if (valorRestante <= 0) {
                    const confirmed = await UI.showConfirmModal(
                        "Este pedido já está pago. Deseja apenas marcá-lo como 'Entregue'?",
                        "Sim, marcar como 'Entregue'",
                        "Cancelar"
                    );
                    
                    if (confirmed) {
                        await services.saveOrder(updatedOrderData, id);
                        const generate = await UI.showConfirmModal(
                            "Pedido movido para 'Entregues' com sucesso! Deseja gerar o Recibo de Quitação e Entrega?",
                            "Sim, gerar recibo",
                            "Não, obrigado"
                        );
                        if (generate) {
                            await generateReceiptPdf(updatedOrderData, userCompanyName(), UI.showInfoModal);
                        }
                        // Atualiza a busca se estiver ativa
                        const searchInput = document.getElementById('globalSearchInput');
                        if (searchInput && searchInput.value) searchInput.dispatchEvent(new Event('input'));
                    }
                } 
                else {
                    // Etapa 1: Pergunta sobre o pagamento agora (o Esc aqui aborta a ação)
                    const querReceber = await UI.showConfirmModal(
                        `Este pedido tem um saldo devedor de R$ ${valorRestante.toFixed(2).replace('.', ',')}. O cliente vai realizar o pagamento agora?`,
                        "Sim, Receber Agora",
                        "Não / Outras Opções"
                    );

                    if (querReceber) {
                        // OPÇÃO A: RECEBER AGORA (Abre a janela de Quitação)
                        const settlementData = await UI.showSettlementModal(id, valorRestante);

                        if (settlementData) { 
                            // [NOVO] Matemática de Desconto/Acréscimo em tempo real
                            const novoDesconto = settlementData.discountAdded || 0;
                            const novoAcrescimo = settlementData.surchargeAdded || 0;
                            
                            // Atualiza o pedido: soma os descontos extras e abate os juros do desconto total
                            updatedOrderData.discount = (updatedOrderData.discount || 0) + novoDesconto - novoAcrescimo;
                            
                            await services.saveOrder(updatedOrderData, id);

                            const transactionData = {
                                date: settlementData.date, 
                                description: `Quitação Pedido - ${updatedOrderData.clientName}`,
                                amount: settlementData.finalAmount || valorRestante, // [CORREÇÃO] Salva exatamente o que entrou no caixa
                                type: 'income',
                                category: 'Quitação de Pedido', 
                                source: settlementData.source, 
                                status: 'pago',
                                orderId: id 
                            };
                            
                            await services.saveTransaction(transactionData, null);
                            
                            const generate = await UI.showConfirmModal(
                                "Pedido quitado e movido para 'Entregues' com sucesso! Deseja gerar o Recibo de Quitação e Entrega?",
                                "Sim, gerar recibo",
                                "Não, obrigado"
                            );
                            if (generate) {
                                await generateReceiptPdf(updatedOrderData, userCompanyName(), UI.showInfoModal);
                            }
                            const searchInput = document.getElementById('globalSearchInput');
                            if (searchInput && searchInput.value) searchInput.dispatchEvent(new Event('input'));
                        }
                    } else {
                        // Etapa 2: Como ele disse Não/Esc, perguntamos se é Fiado ou se foi um engano
                        const querFiado = await UI.showConfirmModal(
                            `Deseja entregar a mercadoria NA CONFIANÇA (Fiado) e registrar a dívida de R$ ${valorRestante.toFixed(2).replace('.', ',')} para cobrar depois?`,
                            "Sim, Entregar na Confiança",
                            "Cancelar e Voltar"
                        );

                        if (querFiado) {
                            // OPÇÃO B: FIADO
                            // [CORREÇÃO CRÍTICA]: Revertemos o valor pago para o adiantamento real que já existia.
                            // Assim o PDF e o banco de dados saberão que o restante NÃO foi pago.
                            updatedOrderData.downPayment = adiantamentoExistente;

                            await services.saveOrder(updatedOrderData, id);
                            
                            const transactionData = {
                                date: new Date().toISOString().split('T')[0], 
                                description: `Saldo Pendente (Entrega na Confiança) - ${updatedOrderData.clientName}`,
                                amount: valorRestante,
                                type: 'income',
                                category: 'Quitação de Pedido',
                                source: 'caixa', 
                                status: 'a_receber', 
                                orderId: id 
                            };
                            
                            await services.saveTransaction(transactionData, null);
                            
                            // [NOVO] Gatilho para o PDF de Confissão de Dívida
                            const querTermo = await UI.showConfirmModal(
                                `Pedido entregue na confiança!\nDébito gerado no financeiro.\n\nDeseja imprimir o "Termo de Confissão de Dívida" para o cliente assinar?`,
                                "Sim, Imprimir Termo",
                                "Não, pular"
                            );

                            if (querTermo) {
                                // [CORREÇÃO]: Damos 400ms para o HTML do modal "respirar" e fechar. 
                                // Isso impede que o navegador bloqueie o prompt nativo ou engula a data digitada.
                                setTimeout(async () => {
                                    const dataInput = window.prompt("Qual a data limite combinada para o pagamento?\n(Ex: 25/04/2026. Deixe em branco se preferir preencher à caneta no papel)", "");
                                    const dataLimpa = dataInput ? String(dataInput).trim() : "";
                                    
                                    // Forçamos o navegador a quebrar o cache e usar a versão mais recente do motor de PDF
                                    const { generateTermoConfiancaPdf } = await import(`../services/pdfService.js?v=${Date.now()}`);
                                    const companyName = typeof userCompanyName === 'function' ? userCompanyName() : 'Sua Empresa';
                                    
                                    await generateTermoConfiancaPdf(updatedOrderData, companyName, UI.showInfoModal, dataLimpa);
                                }, 400);
                            } else {
                                UI.showInfoModal(`Pedido concluído!\n\nO débito de R$ ${valorRestante.toFixed(2).replace('.', ',')} está no painel financeiro aguardando pagamento.`);
                            }
                            
                            const searchInput = document.getElementById('globalSearchInput');
                            if (searchInput && searchInput.value) searchInput.dispatchEvent(new Event('input'));
                        }
                        // Se ele apertar "Cancelar e Voltar" (ou Esc) na segunda tela, o código acaba aqui. Abortado em segurança!
                    }
                }
                
            } catch (error) {
                console.error("Erro ao quitar e entregar pedido:", error);
                UI.showInfoModal("Ocorreu um erro ao atualizar o pedido.");
            }
        }
    };

    // 2 e 3. Conectamos a função globalmente ao document para interceptar cliques nos cards (SPA Seguro)
    document.addEventListener('click', (e) => {
        // [CRM - FICHA DE OURO] Inclusão do #customerDashboardModal na delegação de eventos
        const isOrderCardClick = e.target.closest('#ordersList, #searchResultsContainer, #customerDashboardModal');
        if (isOrderCardClick) {
            handleOrderCardClick(e);
        }
    });

    // --- LISTENER DO MODAL DE DETALHES (View/Visualizar) ---
    UI.DOM.viewModal.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        
        // 1. Botão FECHAR (X)
        if (btn && btn.id === 'closeViewBtn') { 
            UI.hideViewModal();
            UI.DOM.viewModal.innerHTML = ''; 
            return;
        }

        // 2. Lógica do Dropdown (Documentos)
        if (btn && btn.id === 'documentsBtn') {
            e.stopPropagation(); 
            const menu = UI.DOM.viewModal.querySelector('#documentsMenu');
            if(menu) menu.classList.toggle('hidden');
            // Fecha o outro menu se estiver aberto
            UI.DOM.viewModal.querySelector('#whatsappMenu')?.classList.add('hidden');
            return; 
        }

        // 3. Lógica do Dropdown (WhatsApp) - NOVO
        if (btn && btn.id === 'whatsappMenuBtn') {
            e.stopPropagation(); 
            const menu = UI.DOM.viewModal.querySelector('#whatsappMenu');
            if(menu) menu.classList.toggle('hidden');
            // Fecha o outro menu se estiver aberto
            UI.DOM.viewModal.querySelector('#documentsMenu')?.classList.add('hidden');
            return; 
        }

        // Fecha qualquer menu se clicar fora dos botões (mas dentro do modal)
        const docMenu = UI.DOM.viewModal.querySelector('#documentsMenu');
        if (docMenu && !docMenu.classList.contains('hidden')) docMenu.classList.add('hidden');
        
        const zapMenu = UI.DOM.viewModal.querySelector('#whatsappMenu');
        if (zapMenu && !zapMenu.classList.contains('hidden')) zapMenu.classList.add('hidden');

        if (!btn) return;
        
        // Ações de PDF
        if (btn.id === 'comprehensivePdfBtn') {
            generateComprehensivePdf(btn.dataset.id, services.getAllOrders(), userCompanyName(), UI.showInfoModal);
        }
        
        if (btn.id === 'productionPdfBtn') {
            generateProductionOrderPdf(btn.dataset.id, services.getAllOrders(), userCompanyName(), UI.showInfoModal);
        }

        // --- INÍCIO: GERAÇÃO DE LINK BLINDADO (Direct Read) ---
        // 4. Ação: Abrir WhatsApp 
        if (btn.id === 'btnOpenWhatsAppAction') {
            const order = services.getOrderById(btn.dataset.id);
            if (!order || !order.clientPhone) {
                UI.showInfoModal("Este pedido não possui telefone cadastrado.");
                return;
            }

            // [MÁGICA DE BLINDAGEM]: Busca a empresa atual para colocar no link
            let companyId = null;
            if (auth.currentUser) {
                try {
                    const mappingSnap = await getDoc(doc(db, "user_mappings", auth.currentUser.uid));
                    companyId = mappingSnap.exists() ? mappingSnap.data().companyId : auth.currentUser.uid;
                } catch(e) { console.warn("Erro ao buscar companyId", e); }
            }
            const cidParam = companyId ? `?cid=${companyId}&id=` : `?id=`;

            let phone = order.clientPhone.replace(/\D/g, '');
            if (phone.length <= 11) phone = '55' + phone;
            const company = userCompanyName(); 
            const firstName = order.clientName.split(' ')[0]; 
            const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            
            // O Link agora nasce com o DNA da empresa!
            const approvalLink = `${baseUrl}/aprovacao.html${cidParam}${order.id}`;
            const message = `Olá ${firstName}, aqui é da ${company}. Segue o link para conferência e aprovação do layout do seu pedido: ${approvalLink} . Por favor, confira os nomes e tamanhos. Qualquer dúvida, estou à disposição!`;
            
            const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            const link = document.createElement('a');
            link.href = url;
            link.target = 'whatsapp_tab'; 
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // 5. Ação: Copiar Link (NOVO)
        if (btn.id === 'btnCopyLinkAction') {
            const orderId = btn.dataset.id;
            
            // [MÁGICA DE BLINDAGEM]: Busca a empresa atual para colocar no link
            let companyId = null;
            if (auth.currentUser) {
                try {
                    const mappingSnap = await getDoc(doc(db, "user_mappings", auth.currentUser.uid));
                    companyId = mappingSnap.exists() ? mappingSnap.data().companyId : auth.currentUser.uid;
                } catch(e) { console.warn("Erro ao buscar companyId", e); }
            }
            const cidParam = companyId ? `?cid=${companyId}&id=` : `?id=`;

            const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            const approvalLink = `${baseUrl}/aprovacao.html${cidParam}${orderId}`;

            try {
                await navigator.clipboard.writeText(approvalLink);
                
                const originalContent = btn.innerHTML;
                btn.innerHTML = `<span class="text-green-600 font-bold flex items-center gap-2"><i class="fa-solid fa-check"></i> Copiado!</span>`;
                setTimeout(() => {
                    if (btn) btn.innerHTML = originalContent;
                }, 1500);

            } catch (err) {
                console.error("Erro ao copiar link:", err);
                UI.showInfoModal("Não foi possível copiar o link automaticamente.");
            }
        }
        // --- FIM: GERAÇÃO DE LINK BLINDADO ---
    });
    
    // --- LISTENER GLOBAL DE TECLAS (ESC) ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const viewModalOpen = UI.DOM.viewModal && !UI.DOM.viewModal.classList.contains('hidden');
            const orderModalOpen = UI.DOM.orderModal && !UI.DOM.orderModal.classList.contains('hidden');

            if (viewModalOpen) {
                UI.hideViewModal();
                UI.DOM.viewModal.innerHTML = '';
            } else if (orderModalOpen) {
                UI.hideOrderModal();
            }
        }
    });

}
