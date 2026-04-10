// js/ui/financeRenderer.js
// ==========================================================
// MÓDULO FINANCE RENDERER (v5.22.2 - SMART SHIELD RESTORED)
// ==========================================================

import { DOM } from './dom.js';

// --- ESTADO INTERNO (MEMÓRIA BLINDADA) ---
// Recuperamos essa variável para evitar o "Zero Fantasma" no carregamento.
let internalPendingRevenueCache = 0;
let lastContextFilter = ''; 

// --- HELPER DE FORMATAÇÃO (BRL) ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const generateTransactionRowHTML = (t) => {
    const isIncome = t.type === 'income';
    const isReceivable = isIncome && (t.status === 'a_receber' || t.status === 'pendente');
    const isPayable = !isIncome && (t.status === 'a_pagar' || t.status === 'pendente');
    
    const amountClass = isIncome ? 'text-green-600' : 'text-red-600';
    const formattedDate = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
    
    // Uso da formatação brasileira
    const transactionAmount = typeof t.amount === 'number' ? formatCurrency(t.amount).replace('R$', '').trim() : '0,00';
    
    let statusBadge = '';
    if (isReceivable) statusBadge = `<span class="ml-2 text-xs font-semibold py-1 px-2 rounded-full bg-yellow-100 text-yellow-800">A Receber</span>`;
    else if (isPayable) statusBadge = `<span class="ml-2 text-xs font-semibold py-1 px-2 rounded-full bg-orange-100 text-orange-800">A Pagar</span>`;

    const sourceBadge = `<span class="text-xs font-semibold py-1 px-2 rounded-full ${t.source === 'caixa' ? 'bg-gray-200 text-gray-800' : 'bg-indigo-100 text-indigo-800'}">${t.source === 'caixa' ? 'Caixa' : 'Banco'}</span>`;
    
    const isLinkedToOrder = !!t.orderId;
    let actionsHtml = '';

    if (isReceivable) { 
        actionsHtml = `<button data-id="${t.id}" class="mark-as-paid-btn text-green-600 hover:underline text-sm font-semibold mr-2">Receber</button> `;
    } else if (isPayable) {
        actionsHtml = `<button data-id="${t.id}" class="mark-as-paid-btn text-green-600 hover:underline text-sm font-semibold mr-2 flex items-center inline-flex gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Dar Baixa</button> `;
    }

    actionsHtml += `
        <button data-id="${t.id}" class="edit-transaction-btn text-blue-500 hover:underline text-sm">Editar</button>
        <button data-id="${t.id}" class="delete-transaction-btn text-red-500 hover:underline text-sm ml-2">Excluir</button>
    `;

    if (isLinkedToOrder) {
        actionsHtml += `<span class="block text-xs text-gray-500 italic mt-1" title="Vinculado ao Pedido ID: ${t.orderId}">Lançado via Pedido</span>`;
    }

    return `
        <td class="py-3 px-4">${formattedDate}</td>
        <td class="py-3 px-4 flex items-center">${t.description} ${statusBadge}</td>
        <td class="py-3 px-4 text-gray-600">${t.category || ''}</td>
        <td class="py-3 px-4">${sourceBadge}</td>
        <td class="py-3 px-4 text-right font-semibold ${amountClass}">
            ${isIncome ? '+' : '-'} R$ ${transactionAmount}
        </td>
        <td class="py-3 px-4 text-right">
            ${actionsHtml}
        </td>
    `;
};

// [PROTEÇÃO SPA] Helper para buscar a lista de lançamentos em tempo real
const getTransactionsList = () => document.getElementById('transactionsList');

export const addTransactionRow = (transaction) => {
    const listEl = getTransactionsList();
    if (!listEl) return;

    const tr = document.createElement('tr');
    const isPendingRow = transaction.status === 'a_receber' || transaction.status === 'a_pagar' || transaction.status === 'pendente';
    tr.className = `border-b hover:bg-gray-50 ${isPendingRow ? 'bg-yellow-50' : ''}`;
    tr.dataset.id = transaction.id;
    tr.dataset.date = transaction.date;
    tr.innerHTML = generateTransactionRowHTML(transaction);

    const allRows = Array.from(listEl.querySelectorAll('tr[data-id]'));
    let inserted = false;
    for (const existingRow of allRows) {
        if (transaction.date > existingRow.dataset.date) {
            listEl.insertBefore(tr, existingRow);
            inserted = true;
            break;
        }
    }
    if (!inserted) {
        listEl.appendChild(tr);
    }
    
    const placeholder = listEl.querySelector('.transactions-placeholder');
    if (placeholder) placeholder.remove();
};

export const updateTransactionRow = (transaction) => {
    const listEl = getTransactionsList();
    if (!listEl) return;

    const row = listEl.querySelector(`tr[data-id="${transaction.id}"]`);
    if (row) {
        const isPendingRow = transaction.status === 'a_receber' || transaction.status === 'a_pagar' || transaction.status === 'pendente';
        row.className = `border-b hover:bg-gray-50 ${isPendingRow ? 'bg-yellow-50' : ''}`;
        row.innerHTML = generateTransactionRowHTML(transaction);
        const oldDate = row.dataset.date;
        if (transaction.date !== oldDate) {
            row.remove();
            addTransactionRow(transaction);
        }
    }
};

export const removeTransactionRow = (transactionId) => {
    const listEl = getTransactionsList();
    if (!listEl) return;

    const row = listEl.querySelector(`tr[data-id="${transactionId}"]`);
    if (row) {
        row.remove();
    }
    if (listEl.children.length === 0) {
        showTransactionsPlaceholder(false);
    }
};

const showTransactionsPlaceholder = (isSearch) => {
    const listEl = getTransactionsList();
    if (!listEl) return;

    const message = isSearch ? 'Nenhum lançamento encontrado para a busca.' : 'Nenhum lançamento encontrado para este período.';
    listEl.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500 transactions-placeholder">${message}</td></tr>`;
};

export const renderFinanceKPIs = (allTransactions, userBankBalanceConfig, pendingOrdersValue = 0) => {

    // [TRAVA MESTRA] Aborta 100% dos cálculos financeiros e logs se for Produção
    if (window.USER_ROLE === 'production') return [];
    
    // --- 1. LÓGICA DE FILTRO (SPA SEGURO) ---
    const periodFilterEl = document.getElementById('periodFilter');
    const startDateInputEl = document.getElementById('startDateInput');
    const endDateInputEl = document.getElementById('endDateInput');

    const filterValue = periodFilterEl ? periodFilterEl.value : 'thisMonth';
    
    if (filterValue !== lastContextFilter) {
        lastContextFilter = filterValue;
    }

    const now = new Date();
    let startDate, endDate;

    if (filterValue === 'custom') {
        startDate = (startDateInputEl && startDateInputEl.value) ? new Date(startDateInputEl.value + 'T00:00:00') : null;
        endDate = (endDateInputEl && endDateInputEl.value) ? new Date(endDateInputEl.value + 'T23:59:59') : null;
    } else {
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const startOfThisYear = new Date(now.getFullYear(), 0, 1);
        const endOfThisYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

        switch(filterValue) {
            case 'thisMonth': startDate = startOfThisMonth; endDate = endOfThisMonth; break;
            case 'lastMonth': startDate = startOfLastMonth; endDate = endOfLastMonth; break;
            case 'thisYear': startDate = startOfThisYear; endDate = endOfThisYear; break;
        }
    }
    
    if (!startDate || !endDate) {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const filteredTransactions = allTransactions.filter(t => {
        const transactionDate = new Date(t.date + 'T00:00:00');
        if (startDate && endDate) return transactionDate >= startDate && transactionDate <= endDate;
        return true;
    });

    // --- 2. CÁLCULO DE FLUXO ---
    let faturamentoBruto = 0, despesasTotais = 0, valorRecebidoPeriodo = 0, valorPagoPeriodo = 0;
    // [NOVO] Variáveis exclusivas para a Projeção do Período
    let aReceberPeriodo = 0, aPagarPeriodo = 0; 

    filteredTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const isPending = t.status === 'a_receber' || t.status === 'a_pagar' || t.status === 'pendente';

        if (t.type === 'income') {
            faturamentoBruto += amount;
            if (!isPending) {
                valorRecebidoPeriodo += amount;
            } else {
                aReceberPeriodo += amount;
            }
        } else if (t.type === 'expense') {
            despesasTotais += amount;
            if (!isPending) {
                valorPagoPeriodo += amount;
            } else {
                aPagarPeriodo += amount;
            }
        }
    });

    // O Lucro Líquido agora é o reflexo exato do que movimentou o caixa (Recebido - Pago)
    const lucroLiquido = valorRecebidoPeriodo - valorPagoPeriodo;

    // --- 3. CÁLCULO DE SALDOS ---
    let totalBank = userBankBalanceConfig.initialBalance || 0;
    let totalCash = 0; 
    let totalReceivablesTransaction = 0;
    let totalPayablesTransaction = 0;

    allTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const isPending = t.status === 'a_receber' || t.status === 'a_pagar' || t.status === 'pendente';
        
        if (isPending && t.type === 'income') {
            totalReceivablesTransaction += amount;
            return; 
        }

        if (isPending && t.type === 'expense') {
            totalPayablesTransaction += amount;
            return; // Bloqueia o desconto do saldo em conta/caixa!
        }

        // Se chegou aqui, a transação foi efetivamente PAGA/RECEBIDA
        if (!isPending) {
            if (t.source === 'caixa') {
                if (t.type === 'income') totalCash += amount;
                else if (t.type === 'expense') totalCash -= amount;
            } else {
                if (t.type === 'income') totalBank += amount;
                else if (t.type === 'expense') totalBank -= amount;
            }
        }
    });

    // --- 4. BLINDAGEM VISUAL INTELIGENTE ---
    let incomingOrdersValue = parseFloat(pendingOrdersValue) || 0;
    let finalOrdersValue = incomingOrdersValue;

    if (incomingOrdersValue > 0) {
        if (incomingOrdersValue !== internalPendingRevenueCache) {
            internalPendingRevenueCache = incomingOrdersValue;
        }
    } else if (incomingOrdersValue === 0) {
        if (internalPendingRevenueCache > 0) {
            finalOrdersValue = internalPendingRevenueCache;
        }
    }

    const totalReceivables = totalReceivablesTransaction + finalOrdersValue;

    // --- 5. ATUALIZAÇÃO DO DOM (BUSCA DINÂMICA NA SPA) ---
    const fatBrutoEl = document.getElementById('faturamentoBruto');
    const despTotaisEl = document.getElementById('despesasTotais');
    const contasRecEl = document.getElementById('contasAReceber');
    const lucroLiqEl = document.getElementById('lucroLiquido');
    const saldoContaEl = document.getElementById('saldoEmConta');
    const saldoCaixaEl = document.getElementById('saldoEmCaixa');
    
    // Captura os novos elementos do Raio-X
    const termEntradasValorEl = document.getElementById('termometroEntradasValor');
    const termEntradasBarraEl = document.getElementById('termometroEntradasBarra');
    const termSaidasValorEl = document.getElementById('termometroSaidasValor');
    const termSaidasBarraEl = document.getElementById('termometroSaidasBarra');
    const indInadimplenciaEl = document.getElementById('indicadorInadimplencia');
    const indProjecaoEl = document.getElementById('indicadorProjecao');
    
    if (fatBrutoEl) fatBrutoEl.textContent = formatCurrency(faturamentoBruto);
    if (despTotaisEl) despTotaisEl.textContent = formatCurrency(despesasTotais);
    
    if (contasRecEl) {
        contasRecEl.textContent = formatCurrency(totalReceivables);
        if (contasRecEl.hasAttribute('data-trusted')) contasRecEl.removeAttribute('data-trusted');
    }
    
    if (lucroLiqEl) lucroLiqEl.textContent = formatCurrency(lucroLiquido);
    if (saldoContaEl) saldoContaEl.textContent = formatCurrency(totalBank);
    if (saldoCaixaEl) saldoCaixaEl.textContent = formatCurrency(totalCash);

    // ==========================================
    // INÍCIO: MOTOR DO RAIO-X DA SEMANA
    // ==========================================
    
    // 1. Termômetro do Mês (Proporção visual de Receitas Pagas vs Despesas Pagas)
    if (termEntradasValorEl && termSaidasValorEl) {
        termEntradasValorEl.textContent = formatCurrency(valorRecebidoPeriodo);
        termSaidasValorEl.textContent = formatCurrency(valorPagoPeriodo);
        
        const maxTermometro = Math.max(valorRecebidoPeriodo, valorPagoPeriodo);
        const percEntradas = maxTermometro > 0 ? (valorRecebidoPeriodo / maxTermometro) * 100 : 0;
        const percSaidas = maxTermometro > 0 ? (valorPagoPeriodo / maxTermometro) * 100 : 0;
        
        if (termEntradasBarraEl) termEntradasBarraEl.style.width = `${percEntradas}%`;
        if (termSaidasBarraEl) termSaidasBarraEl.style.width = `${percSaidas}%`;
    }

    // 2. Inadimplência Oculta (APENAS os "Fiados", ignorando o dinheiro futuro dos pedidos em produção)
    if (indInadimplenciaEl) {
        // totalReceivablesTransaction foi isolado na Fase 1 para conter apenas as promessas já vencidas/entregues
        indInadimplenciaEl.textContent = formatCurrency(totalReceivablesTransaction);
    }

    // 3. Projeção de Caixa (A Matemática Mágica)
    if (indProjecaoEl) {
        const saldoRealAtual = totalBank + totalCash;
        // [NOVO CÁLCULO] Projeção do Mês = Saldo no Bolso + (Dinheiro dos Pedidos em Produção + Fiados do Período) - (Contas a Pagar do Período)
        const projecao = saldoRealAtual + finalOrdersValue + aReceberPeriodo - aPagarPeriodo;
        
        indProjecaoEl.textContent = formatCurrency(projecao);
        
        // Alerta visual agressivo: Se a projeção for fechar no vermelho, a cor muda para vermelho
        if (projecao < 0) {
            indProjecaoEl.classList.remove('text-white');
            indProjecaoEl.classList.add('text-red-400');
        } else {
            indProjecaoEl.classList.add('text-white');
            indProjecaoEl.classList.remove('text-red-400');
        }
    }
    // ==========================================
    // FIM: MOTOR DO RAIO-X DA SEMANA
    // ==========================================
    
    // --- 6. CATEGORIAS ---
    const expenseCategories = {}, incomeCategories = {};
    filteredTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const category = t.category || 'Sem Categoria';
        if (t.type === 'expense') {
            if (!expenseCategories[category]) expenseCategories[category] = 0;
            expenseCategories[category] += amount;
        } else if (t.type === 'income') {
            if (!incomeCategories[category]) incomeCategories[category] = 0;
            incomeCategories[category] += amount;
        }
    });

    const formatCategoryList = (categoryData, containerElement) => {
        if (!containerElement) return;
        
        const sortedCategories = Object.entries(categoryData)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        if (sortedCategories.length === 0) {
            containerElement.innerHTML = '<p class="text-sm text-gray-500">Nenhum dado no período.</p>';
            return;
        }

        let html = '<ul class="space-y-2 text-sm">';
        sortedCategories.forEach(([category, total]) => {
            html += `
                <li class="flex justify-between items-center py-1">
                    <span class="text-gray-700 truncate pr-2">${category}</span>
                    <span class="font-semibold text-gray-900 whitespace-nowrap">${formatCurrency(total)}</span>
                </li>
            `;
        });
        html += '</ul>';
        containerElement.innerHTML = html;
    };

    formatCategoryList(expenseCategories, document.getElementById('topExpensesByCategory'));
    formatCategoryList(incomeCategories, document.getElementById('topIncomesByCategory'));
    
    return filteredTransactions;
};

export const renderFinanceDashboard = (allTransactions, userBankBalanceConfig, pendingOrdersValue = 0) => {
    if (window.USER_ROLE === 'production') return;
    
    const periodFilterEl = document.getElementById('periodFilter');
    if (!periodFilterEl) return; // Se o ecrã não estiver montado, aborta a injeção em segurança

    // ==========================================================
    // INÍCIO DA CIRURGIA CORRIGIDA: Sincronização Automática
    // ==========================================================
    if (!periodFilterEl.dataset.syncDone) {
        periodFilterEl.dataset.syncDone = 'true';
        
        // Dá um atraso de 150ms para garantir que o HTML já foi colado no navegador.
        // O evento "change" agora será ouvido globalmente com sucesso!
        setTimeout(() => {
            const filtroCorrigido = document.getElementById('periodFilter');
            if (filtroCorrigido) {
                filtroCorrigido.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, 150); 
    }
    // ==========================================================
    // FIM DA CIRURGIA
    // ==========================================================

    // Continua a renderização normal para não deixar o ecrã em branco
    const filteredTransactions = renderFinanceKPIs(allTransactions, userBankBalanceConfig, pendingOrdersValue);

    const searchInputEl = document.getElementById('transactionSearchInput');
    const searchTerm = searchInputEl ? searchInputEl.value.toLowerCase() : '';
    
    const displayTransactions = searchTerm ?
        filteredTransactions.filter(t => t.description.toLowerCase().includes(searchTerm)) :
        filteredTransactions;
        
    const listEl = getTransactionsList();
    if (listEl) {
        listEl.innerHTML = ''; 
        if (displayTransactions.length === 0) {
            showTransactionsPlaceholder(searchTerm.length > 0);
            return;
        }
        
        displayTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        displayTransactions.forEach(addTransactionRow);
    }
};
