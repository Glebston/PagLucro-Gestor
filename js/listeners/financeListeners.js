// js/listeners/financeListeners.js
// ===========================================================
// MÓDULO FINANCE LISTENERS (SPA SEGURO)
// ==========================================================

// Importa as novas funções geradoras de relatórios em PDF
import { generateInadimplenciaPdf, generateContasAPagarPdf } from '../services/pdfService.js';

function handleEditTransaction(UI, id, getTransactions) {
    const transaction = getTransactions().find(t => t.id === id);
    if (!transaction) return;
    
    if (transaction.orderId) {
        UI.showInfoModal("🔒 Esta transação está vinculada a um Pedido.\n\nPara garantir a integridade financeira, edite-a através do botão 'Editar' no Painel de Pedidos.");
        return;
    }

    UI.DOM.transactionId.value = transaction.id; 
    UI.DOM.transactionDate.value = transaction.date; 
    UI.DOM.transactionDescription.value = transaction.description;
    UI.DOM.transactionAmount.value = transaction.amount; 
    UI.DOM.transactionType.value = transaction.type; 
   UI.DOM.transactionCategory.value = transaction.category || '';
    
    // [NOVO] Oculta a opção de parcelamento na edição (segurança contra duplicação)
    const recurringBlock = document.getElementById('isRecurringCb')?.closest('div.mt-2');
    if (recurringBlock) recurringBlock.classList.add('hidden');
    
    UI.updateSourceSelectionUI(UI.DOM.transactionSourceContainer, transaction.source || 'banco');
    
    const isIncome = transaction.type === 'income';
    
    // Mostra o container para ambos (Receita e Despesa)
    UI.DOM.transactionStatusContainer.classList.remove('hidden');
    
    // Altera os textos dinamicamente baseado no tipo
    document.getElementById('labelStatusPago').textContent = isIncome ? 'Recebido (Pago)' : 'Pago';
    document.getElementById('labelStatusPendente').textContent = isIncome ? 'A Receber' : 'A Pagar';
    
    // Se a transação estiver pendente (agora usamos 'pendente' ou o legado 'a_receber')
    const isPending = transaction.status === 'pendente' || transaction.status === 'a_receber' || transaction.status === 'a_pagar';
    (isPending ? document.getElementById('pendente') : UI.DOM.pago).checked = true;
    
    UI.DOM.transactionModalTitle.textContent = isIncome ? 'Editar Entrada' : 'Editar Despesa';
    UI.showTransactionModal();
}

function initializeFabListeners(UI) {
    if (!UI.DOM.fabToggleBtn || !UI.DOM.fabActions) return;

    UI.DOM.fabToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        const isExpanded = UI.DOM.fabToggleBtn.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            UI.DOM.fabActions.classList.add('hidden');
            UI.DOM.fabToggleBtn.setAttribute('aria-expanded', 'false');
            UI.DOM.fabToggleBtn.classList.remove('rotate-45'); 
        } else {
            UI.DOM.fabActions.classList.remove('hidden');
            UI.DOM.fabToggleBtn.setAttribute('aria-expanded', 'true');
            UI.DOM.fabToggleBtn.classList.add('rotate-45'); 
        }
    });

    document.addEventListener('click', (e) => {
        if (UI.DOM.fabContainer && !UI.DOM.fabContainer.contains(e.target)) {
            UI.DOM.fabActions.classList.add('hidden');
            UI.DOM.fabToggleBtn.setAttribute('aria-expanded', 'false');
            UI.DOM.fabToggleBtn.classList.remove('rotate-45');
        }
    });
}

export function initializeFinanceListeners(UI, deps) {
    // [CORREÇÃO]: Injetando 'userCompanyName' para o PDF puxar o nome real da estamparia
    const { services, getConfig, setConfig, userCompanyName } = deps;

    initializeFabListeners(UI);

    // --- DELEGAÇÃO GLOBAL DE CLIQUES ---
    document.addEventListener('click', async (e) => {
        
        // [CORREÇÃO BUG 2]: Capturamos a Receita/Despesa ANTES da restrição de <button>
        if (e.target.closest('#addIncomeBtn') || e.target.closest('#fabAddIncomeBtn')) {
            e.preventDefault();
            
            // Oculta visualmente o menu FAB se ele estiver aberto
            const fabMenu = document.getElementById('fabMenu');
            if (fabMenu && !fabMenu.classList.contains('hidden')) {
                document.getElementById('fabMainBtn').click(); // Reaproveita a animação nativa
            }
            
            UI.DOM.transactionForm.reset(); 
            UI.DOM.transactionId.value = ''; 
            UI.DOM.transactionType.value = 'income'; 
            UI.DOM.transactionModalTitle.textContent = 'Nova Entrada'; 
            UI.DOM.transactionDate.value = new Date().toISOString().split('T')[0]; 
            UI.DOM.transactionStatusContainer.classList.remove('hidden'); 
            // [NOVO] Limpa a interface de parcelamento
            const recurringBlock = document.getElementById('isRecurringCb')?.closest('div.mt-2');
            if (recurringBlock) recurringBlock.classList.remove('hidden');
            if (document.getElementById('recurringDetailsContainer')) document.getElementById('recurringDetailsContainer').classList.add('hidden');
            document.getElementById('labelStatusPago').textContent = 'Recebido (Pago)';
            document.getElementById('labelStatusPendente').textContent = 'A Receber';
            UI.DOM.pago.checked = true; 
            UI.updateSourceSelectionUI(UI.DOM.transactionSourceContainer, 'banco'); 
            UI.showTransactionModal();
            return; // Encerra a execução aqui
        } 
        
        if (e.target.closest('#addExpenseBtn') || e.target.closest('#fabAddExpenseBtn')) {
            e.preventDefault();
            
            // Oculta visualmente o menu FAB se ele estiver aberto
            const fabMenu = document.getElementById('fabMenu');
            if (fabMenu && !fabMenu.classList.contains('hidden')) {
                document.getElementById('fabMainBtn').click(); // Reaproveita a animação nativa
            }
            
            UI.DOM.transactionForm.reset(); 
            UI.DOM.transactionId.value = ''; 
            UI.DOM.transactionType.value = 'expense'; 
            UI.DOM.transactionModalTitle.textContent = 'Nova Despesa'; 
            UI.DOM.transactionDate.value = new Date().toISOString().split('T')[0]; 
            UI.DOM.transactionStatusContainer.classList.remove('hidden'); // DESBLOQUEADO
            // [NOVO] Limpa a interface de parcelamento
            const recurringBlock = document.getElementById('isRecurringCb')?.closest('div.mt-2');
            if (recurringBlock) recurringBlock.classList.remove('hidden');
            if (document.getElementById('recurringDetailsContainer')) document.getElementById('recurringDetailsContainer').classList.add('hidden');
            document.getElementById('labelStatusPago').textContent = 'Pago';
            document.getElementById('labelStatusPendente').textContent = 'A Pagar';
            UI.DOM.pago.checked = true; // Por padrão já vem como Pago, mas agora o usuário pode mudar
            UI.updateSourceSelectionUI(UI.DOM.transactionSourceContainer, 'banco'); 
            UI.showTransactionModal();
            return; // Encerra a execução aqui
        }

        // --- Para os demais itens (Ajuste de Saldo, Edição), mantemos a restrição de <button>
        const targetBtn = e.target.closest('button');
        if (!targetBtn) return;
        
        // ==========================================================
        // GATILHOS DE RELATÓRIOS PDF
        // ==========================================================
        if (targetBtn.id === 'printObrigacoesBtn') {
            e.preventDefault();
            const allTransactions = services.getAllTransactions();
            const companyName = userCompanyName ? userCompanyName() : (getConfig().companyName || 'Empresa');
            generateContasAPagarPdf(allTransactions, companyName, UI.showInfoModal);
            return;
        }

        if (targetBtn.id === 'printInadimplenciaBtn') {
            e.preventDefault();
            const allTransactions = services.getAllTransactions();
            const allOrders = services.getAllOrders ? services.getAllOrders() : [];
            const companyName = userCompanyName ? userCompanyName() : (getConfig().companyName || 'Empresa');
            generateInadimplenciaPdf(allTransactions, allOrders, companyName, UI.showInfoModal);
            return;
        }
        
        // AJUSTE DE SALDO
        if (targetBtn.id === 'adjustBalanceBtn') {
            const currentBalance = getConfig().initialBalance || 0;
            UI.DOM.initialBalanceInput.value = currentBalance.toFixed(2);
            UI.DOM.initialBalanceModal.classList.remove('hidden');
            setTimeout(() => UI.DOM.initialBalanceInput.focus(), 50);
        }
        
        // CANCELAR AJUSTE DE SALDO
        else if (targetBtn.id === 'cancelBalanceBtn') {
            UI.DOM.initialBalanceModal.classList.add('hidden');
        }

        // SALVAR AJUSTE DE SALDO
        else if (targetBtn.id === 'saveBalanceBtn') {
            const btn = UI.DOM.saveBalanceBtn;
            const originalText = btn.textContent; 
            const inputValue = UI.DOM.initialBalanceInput.value.replace(',', '.');
            const newBalance = parseFloat(inputValue);

            if (isNaN(newBalance)) {
                UI.showInfoModal("Por favor, insira um valor numérico válido.");
                return;
            }

            try {
                btn.textContent = "Salvando...";
                btn.disabled = true;
                await services.saveInitialBalance(newBalance);
                setConfig({ initialBalance: newBalance }); 
                renderFullDashboard(); 
                UI.DOM.initialBalanceModal.classList.add('hidden');
            } catch (error) {
                console.error(error);
                UI.showInfoModal("Erro ao atualizar o saldo.");
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        // AÇÕES DA LISTA DE TRANSAÇÕES
        const isTransactionListClick = e.target.closest('#transactionsList');
        if (isTransactionListClick && targetBtn.dataset.id) {
            const id = targetBtn.dataset.id;
            const transaction = services.getAllTransactions().find(t => t.id === id);

            if (targetBtn.classList.contains('edit-transaction-btn')) {
                handleEditTransaction(UI, id, services.getAllTransactions);
            } else if (targetBtn.classList.contains('delete-transaction-btn')) {
                if (transaction && transaction.orderId) {
                    UI.showInfoModal("🔒 Esta transação está vinculada a um Pedido.\n\nRemova pelo Painel de Pedidos.");
                    return;
                }
                UI.showConfirmModal("Excluir este lançamento?", "Excluir", "Cancelar")
                  .then(ok => { if(ok) services.deleteTransaction(id); });
            } else if (targetBtn.classList.contains('mark-as-paid-btn')) {
                // Reaproveitamos o Modal de Quitação para perguntar a Data e a Origem (Banco/Caixa)
                const settlementData = await UI.showSettlementModal(id, transaction.amount);
                
                if (settlementData) {
                    // [NOVO] 1. Salva a transação com o valor FINAL exato (com juros/descontos)
                    const updatedTransaction = {
                        ...transaction,
                        date: settlementData.date,
                        source: settlementData.source, 
                        status: 'pago', 
                        amount: settlementData.finalAmount !== undefined ? settlementData.finalAmount : transaction.amount
                    };
                    await services.saveTransaction(updatedTransaction, id);

                    // [EFEITO DOMINÓ] 2. Se for o fiado de um Pedido, atualiza a matemática do Pedido também!
                    if (transaction.orderId && services.getAllOrders && services.saveOrder) {
                        const linkedOrder = services.getAllOrders().find(o => o.id === transaction.orderId);
                        
                        if (linkedOrder) {
                            const novoDesconto = settlementData.discountAdded || 0;
                            const novoAcrescimo = settlementData.surchargeAdded || 0;
                            
                            // Abate os juros do desconto (Juros entra como desconto negativo para fechar a conta do PDF)
                            linkedOrder.discount = (linkedOrder.discount || 0) + novoDesconto - novoAcrescimo;
                            await services.saveOrder(linkedOrder, linkedOrder.id);
                        }
                    }
                }
            }
        }
    });

    // --- FORMULÁRIO DE TRANSAÇÃO (Motor Lote / Parcelado Integrado) ---
    UI.DOM.transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedSourceEl = UI.DOM.transactionSourceContainer.querySelector('.source-selector.active');
        if (!selectedSourceEl) return UI.showInfoModal("Selecione a Origem (Banco ou Caixa).");
        
        const baseDate = UI.DOM.transactionDate.value;
        const baseDesc = UI.DOM.transactionDescription.value;
        const amount = parseFloat(UI.DOM.transactionAmount.value);
        const type = UI.DOM.transactionType.value;
        const category = UI.DOM.transactionCategory.value.trim();
        const source = selectedSourceEl.dataset.source;
        const status = document.getElementById('pendente').checked ? (type === 'income' ? 'a_receber' : 'a_pagar') : 'pago';
        
        if (!baseDate || !baseDesc || isNaN(amount) || amount <= 0) {
            return UI.showInfoModal("Preencha todos os campos com valores válidos.");
        }

        const isRecurring = document.getElementById('isRecurringCb')?.checked;
        const installmentsStr = document.getElementById('installmentsCount')?.value;
        const installments = parseInt(installmentsStr) || 1;
        const isEdit = !!UI.DOM.transactionId.value;

        try {
            // [MOTOR SÊNIOR] Geração em Lote se for recorrente e NOVO lançamento
            if (!isEdit && isRecurring && installments > 1) {
                // Trava visual de segurança para cliques duplos rápidos
                const submitBtn = document.getElementById('saveTransactionBtn');
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Gerando...'; }

                const promises = [];
                
                // Calculadora de Calendário Sênior (Impede bug do Dia 31 -> Mês Curto)
                const addExactMonths = (dateStr, monthsToAdd) => {
                    const [y, m, d] = dateStr.split('-').map(Number);
                    const date = new Date(y, m - 1 + monthsToAdd, d);
                    if (date.getMonth() !== ((m - 1 + monthsToAdd) % 12 + 12) % 12) {
                        date.setDate(0); // Volta pro último dia útil correto (Ex: 28 Fev)
                    }
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                };

                // Executa a repetição exata
                for (let i = 0; i < installments; i++) {
                    const parcelData = {
                        date: addExactMonths(baseDate, i),
                        description: `${baseDesc} (${i + 1}/${installments})`,
                        amount: amount,
                        type: type,
                        category: category,
                        source: source,
                        status: status
                    };
                    promises.push(services.saveTransaction(parcelData, null)); // Null força a criação de IDs únicos
                }
                
                await Promise.all(promises);
                
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Salvar'; }
                UI.hideTransactionModal();
                UI.showInfoModal(`${installments} parcelas geradas com sucesso!`);
            } else {
                // [FLUXO NORMAL] Lançamento Único ou Edição (Intacto)
                const data = { date: baseDate, description: baseDesc, amount, type, category, source, status };
                await services.saveTransaction(data, UI.DOM.transactionId.value);
                UI.hideTransactionModal();
            }
        } catch (error) {
            console.error("Erro no processamento:", error);
            UI.showInfoModal("Ocorreu um erro interno. Verifique o console.");
            const submitBtn = document.getElementById('saveTransactionBtn');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Salvar'; }
        }
    });

    UI.DOM.cancelTransactionBtn.addEventListener('click', () => UI.hideTransactionModal());

    // --- FILTROS (DELEGAÇÃO) ---
    let filterDebounceTimeout;

    const renderFullDashboard = () => {
        const periodFilterEl = document.getElementById('periodFilter');
        const startDateInputEl = document.getElementById('startDateInput');
        const endDateInputEl = document.getElementById('endDateInput');

        const filter = periodFilterEl ? periodFilterEl.value : 'thisMonth';
        const now = new Date();
        let startDate = null, endDate = null;

        if (filter === 'custom') {
            if (startDateInputEl && startDateInputEl.value) startDate = new Date(startDateInputEl.value + 'T00:00:00');
            if (endDateInputEl && endDateInputEl.value) endDate = new Date(endDateInputEl.value + 'T23:59:59');
        } else {
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            const startOfThisYear = new Date(now.getFullYear(), 0, 1);
            const endOfThisYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

            switch(filter) {
                case 'thisMonth': startDate = startOfThisMonth; endDate = endOfThisMonth; break;
                case 'lastMonth': startDate = startOfLastMonth; endDate = endOfLastMonth; break;
                case 'thisYear': startDate = startOfThisYear; endDate = endOfThisYear; break;
            }
        }
        
        if (!startDate || !endDate) {
             startDate = new Date(now.getFullYear(), now.getMonth(), 1);
             endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

        const pendingRevenue = services.calculateTotalPendingRevenue ? services.calculateTotalPendingRevenue(startDate, endDate) : 0;
        UI.renderFinanceDashboard(services.getAllTransactions(), getConfig(), pendingRevenue);
    };

    document.addEventListener('change', (e) => {
        if (e.target.id === 'periodFilter') {
            const customContainer = document.getElementById('customPeriodContainer');
            if (customContainer) customContainer.classList.toggle('hidden', e.target.value !== 'custom');
            renderFullDashboard();
        }
        
        // [NOVO] Mostrar/Esconder o campo de "Quantidade de Meses" suavemente
        if (e.target.id === 'isRecurringCb') {
            const container = document.getElementById('recurringDetailsContainer');
            if (container) container.classList.toggle('hidden', !e.target.checked);
        }
    });

    document.addEventListener('input', (e) => {
        if (['startDateInput', 'endDateInput', 'transactionSearchInput'].includes(e.target.id)) {
            clearTimeout(filterDebounceTimeout);
            filterDebounceTimeout = setTimeout(renderFullDashboard, 300);
        }
    });

    // --- ORIGEM BANCO/CAIXA ---
    UI.DOM.transactionSourceContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.source-selector');
        if (target) UI.updateSourceSelectionUI(UI.DOM.transactionSourceContainer, target.dataset.source);
    });
}
