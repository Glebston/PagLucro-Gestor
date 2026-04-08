// js/emergencia.js
// ==========================================================
// MOTOR DE SOBREVIVÊNCIA E CONTINGÊNCIA (PLANO A)
// Sistema: PagLucro Gestor (Estamparia/Confecção)
// Isolamento Tático: Sem frameworks externos. Cache seguro.
// Comando Duplo: Impressão Nativa de OS (Chão de Fábrica) e Espelho (Comercial)
// ==========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// 1. Configuração Hardcoded (Ambiente de Produção Oficial)
const firebaseConfig = {
  apiKey: "AIzaSyA8MxD_m6lKrrQKijlxQ0lQUQdC3OpTEv4",
  authDomain: "saas-57e0d.firebaseapp.com",
  projectId: "saas-57e0d",
  storageBucket: "saas-57e0d.appspot.com",
  messagingSenderId: "230026949437",
  appId: "1:230026949437:web:9f19f286aefb96e0330b54"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 2. Mapeamento de Elementos do DOM
const DOM = {
    loginSection: document.getElementById('loginSection'),
    dashboardSection: document.getElementById('dashboardSection'),
    loginForm: document.getElementById('loginForm'),
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    loginError: document.getElementById('loginError'),
    logoutBtn: document.getElementById('logoutBtn'),
    printBtn: document.getElementById('printBtn'), // Botão original da lista
    loadingIndicator: document.getElementById('loadingIndicator'),
    ordersContainer: document.getElementById('ordersContainer'),
    financeSummary: document.getElementById('financeSummary'),
    financeContainer: document.getElementById('financeContainer'),
    downloadBackupBtn: document.getElementById('downloadBackupBtn')
};

// Área de Impressão Dinâmica (Injetada via JS para não sujar o HTML)
const printZone = document.createElement('div');
printZone.id = 'printZone';
document.body.appendChild(printZone);

// Adiciona regras de CSS dinâmicas para gerenciar os Modos de Impressão
const printStyles = document.createElement('style');
printStyles.innerHTML = `
    #printZone { display: none; }
    @media print {
        body.print-mode-batch #dashboardSection { display: none !important; }
        body.print-mode-batch #printZone { display: block !important; width: 100%; }
        .page-break { page-break-after: always; clear: both; }
        .os-header { border-bottom: 2px solid #000; margin-bottom: 15px; padding-bottom: 10px; }
        .os-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12pt; }
        .os-table th, .os-table td { border: 1px solid #000; padding: 6px; text-align: left; }
        .os-obs { border: 1px dashed #000; padding: 10px; margin-top: 10px; font-weight: bold; background-color: #f9f9f9; }
        .text-right { text-align: right !important; }
        .commercial-totals { margin-top: 15px; border-top: 2px solid #000; padding-top: 10px; text-align: right; font-size: 14pt; }
    }
`;
document.head.appendChild(printStyles);

let inMemoryOrders = [];

// 3. Autenticação Segura
onAuthStateChanged(auth, (user) => {
    if (user) {
        DOM.loginSection.classList.add('hidden');
        DOM.dashboardSection.classList.remove('hidden');
        bootSurvivalMode(user);
    } else {
        DOM.dashboardSection.classList.add('hidden');
        DOM.loginSection.classList.remove('hidden');
        clearSensitiveData();
    }
});

DOM.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    try {
        btn.textContent = "Autenticando...";
        btn.disabled = true;
        DOM.loginError.classList.add('hidden');
        await signInWithEmailAndPassword(auth, DOM.emailInput.value.trim(), DOM.passwordInput.value);
    } catch (error) {
        DOM.loginError.textContent = "Erro de acesso. Verifique credenciais ou conexão.";
        DOM.loginError.classList.remove('hidden');
        btn.textContent = "Entrar no Modo de Sobrevivência";
        btn.disabled = false;
    }
});

DOM.logoutBtn.addEventListener('click', () => signOut(auth));

function clearSensitiveData() {
    inMemoryOrders = [];
    DOM.ordersContainer.innerHTML = '';
    DOM.financeSummary.innerHTML = '';
    DOM.financeContainer.innerHTML = '';
}

// 4. O Coração da Contingência
async function bootSurvivalMode(user) {
    DOM.loadingIndicator.classList.remove('hidden');
    try {
        const mappingSnap = await getDoc(doc(db, "user_mappings", user.uid));
        const companyId = mappingSnap.exists() ? mappingSnap.data().companyId : user.uid;
        
        await Promise.all([
            fetchAndRenderOrdersOnline(companyId),
            fetchAndRenderFinanceOnline(companyId)
        ]);
    } catch (error) {
        console.warn("Modo Offline ativado.", error);
        DOM.financeSummary.innerHTML = `<span class="text-red">Financeiro indisponível (Offline)</span>`;
        DOM.financeContainer.innerHTML = `<p class="error-msg">Dados financeiros não cacheados por segurança.</p>`;
        loadOrdersFromSafeCache();
    } finally {
        DOM.loadingIndicator.classList.add('hidden');
    }
}

// ==========================================
// MÓDULO DE PEDIDOS E MOTOR DE IMPRESSÃO
// ==========================================
async function fetchAndRenderOrdersOnline(companyId) {
    const snapshot = await getDocs(collection(db, `companies/${companyId}/orders`));
    const allOrders = [];
    snapshot.forEach(doc => allOrders.push({ id: doc.id, ...doc.data() }));

    const activeOrders = allOrders.filter(o => {
        const status = o.orderStatus || 'Pendente';
        return !['Entregue', 'Finalizado', 'Aguardando Retirada', 'Pronto para Entrega'].includes(status);
    });

    activeOrders.sort((a, b) => (a.deliveryDate || '9999-12-31').localeCompare(b.deliveryDate || '9999-12-31'));
    inMemoryOrders = activeOrders;
    localStorage.setItem('paglucro_survival_orders_cache', JSON.stringify(activeOrders));
    renderOrdersTable(activeOrders);
}

function loadOrdersFromSafeCache() {
    const cachedData = localStorage.getItem('paglucro_survival_orders_cache');
    if (cachedData) {
        inMemoryOrders = JSON.parse(cachedData);
        renderOrdersTable(inMemoryOrders);
        const alertDiv = document.createElement('div');
        alertDiv.className = 'error-msg no-print';
        alertDiv.textContent = '⚠️ Exibindo dados de produção do cache (Offline).';
        DOM.ordersContainer.prepend(alertDiv);
    } else {
        DOM.ordersContainer.innerHTML = '<p class="error-msg">Nenhum dado no cache.</p>';
    }
}

function renderOrdersTable(orders) {
    if (orders.length === 0) {
        DOM.ordersContainer.innerHTML = '<p>Nenhum pedido pendente.</p>';
        return;
    }

    // Injeção do Comando Duplo (Botões de Lote)
    let html = `
        <div class="flex-between no-print" style="margin-bottom: 15px; background: #f0f0f0; padding: 10px; border: 1px solid #ccc;">
            <strong>Ações em Lote:</strong>
            <div style="display: flex; gap: 10px;">
                <button id="printProductionBatchBtn" class="primary" style="background: #0056b3;">🖨️ OS de Produção (Fábrica)</button>
                <button id="printCommercialBatchBtn" class="primary" style="background: #28a745;">🖨️ Espelho Financeiro (Comercial)</button>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Prazo</th>
                    <th>Cliente</th>
                    <th>Peças (Resumo)</th>
                    <th>Ações Individuais</th>
                </tr>
            </thead>
            <tbody>
    `;

    orders.forEach((order, index) => {
        let totalPieces = 0;
        (order.parts || []).forEach(p => {
            const std = p.sizes ? Object.values(p.sizes).flatMap(c => Object.values(c)).reduce((s, c) => s + c, 0) : 0;
            totalPieces += std + (p.specifics || []).length + (p.details || []).length;
        });

        const delivery = order.deliveryDate ? order.deliveryDate.split('-').reverse().join('/') : 'Sem Data';
        html += `
            <tr>
                <td><strong>${delivery}</strong></td>
                <td><strong>${order.clientName}</strong></td>
                <td>${totalPieces} peças</td>
                <td style="white-space: nowrap;">
                    <button class="print-single-prod" data-index="${index}" style="padding: 5px 10px;">OS</button>
                    <button class="print-single-com" data-index="${index}" style="padding: 5px 10px;">Espelho</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    DOM.ordersContainer.innerHTML = html;

    // Listeners do Comando Duplo (Lote)
    document.getElementById('printProductionBatchBtn').addEventListener('click', () => executePrintBatch('production'));
    document.getElementById('printCommercialBatchBtn').addEventListener('click', () => executePrintBatch('commercial'));

    // Listeners Individuais
    document.querySelectorAll('.print-single-prod').forEach(btn => {
        btn.addEventListener('click', (e) => executePrintBatch('production', e.target.dataset.index));
    });
    document.querySelectorAll('.print-single-com').forEach(btn => {
        btn.addEventListener('click', (e) => executePrintBatch('commercial', e.target.dataset.index));
    });
}

// ==========================================
// A MÁGICA DE IMPRESSÃO (O BRUTALISMO NATIVO)
// ==========================================
function executePrintBatch(type, singleIndex = null) {
    let ordersToPrint = singleIndex !== null ? [inMemoryOrders[singleIndex]] : inMemoryOrders;
    let htmlContent = '';

    ordersToPrint.forEach(order => {
        const isCommercial = type === 'commercial';
        const title = isCommercial ? 'ESPELHO DO PEDIDO (COMERCIAL)' : 'ORDEM DE PRODUÇÃO (FÁBRICA)';
        const delivery = order.deliveryDate ? order.deliveryDate.split('-').reverse().join('/') : 'A definir';
        
        let subtotalOrder = 0;
        let partsHtml = '';

        (order.parts || []).forEach(p => {
            // Cálculos matemáticos precisos baseados no orderRenderer.js
            const stdQty = p.sizes ? Object.values(p.sizes).flatMap(c => Object.values(c)).reduce((s, c) => s + c, 0) : 0;
            const specQty = (p.specifics || []).length;
            const detQty = (p.details || []).length;
            const partTotalQty = stdQty + specQty + detQty;
            
            if (partTotalQty === 0) return; // Ignora peças vazias

            const stdPrice = p.unitPriceStandard !== undefined ? p.unitPriceStandard : (p.unitPrice || 0);
            const specPrice = p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : (p.unitPrice || 0);
            const detPrice = p.unitPrice || 0;
            
            const partSubtotal = (stdQty * stdPrice) + (specQty * specPrice) + (detQty * detPrice);
            subtotalOrder += partSubtotal;

            // Renderização da Grade de Tamanhos
            let sizesDetails = '';
            if (p.partInputType === 'comum') {
                if (p.sizes && Object.keys(p.sizes).length > 0) {
                    sizesDetails += Object.entries(p.sizes).map(([cat, sizes]) => `<strong>${cat}:</strong> ` + Object.entries(sizes).map(([sz, q]) => `${sz}(${q})`).join(', ')).join('<br>');
                }
                if (p.specifics && p.specifics.length > 0) {
                    sizesDetails += `<br><strong>Específicos:</strong><br>` + p.specifics.map(s => `- L: ${s.width||'N/A'} x A: ${s.height||'N/A'} (${s.observation||'Sem obs'})`).join('<br>');
                }
            } else if (p.partInputType === 'detalhado' && p.details && p.details.length > 0) {
                sizesDetails += p.details.map(d => `${d.name||''} - ${d.size||''} - Num: ${d.number||''}`).join('<br>');
            }

            // Alerta de Terceirização
            const outsourcedAlert = (p.outsourcedCosts && p.outsourcedCosts.length > 0) ? `<br><strong style="color: red;">⚠️ REQUER TERCEIRIZADO</strong>` : '';

            // Montagem da Linha da Peça
            partsHtml += `
                <tr>
                    <td><strong>${partTotalQty}x ${p.type}</strong><br><span style="font-size: 10pt;">${p.material} | Cor: ${p.colorMain} ${outsourcedAlert}</span></td>
                    <td>${sizesDetails}</td>
                    ${isCommercial ? `<td class="text-right">R$ ${partSubtotal.toFixed(2)}</td>` : ''}
                </tr>
            `;
        });

        // Montagem do Financeiro Final (Apenas Comercial)
        let commercialFooter = '';
        if (isCommercial) {
            const discount = order.discount || 0;
            const totalFinal = subtotalOrder - discount;
            const downPayment = order.downPayment || 0;
            const remaining = totalFinal - downPayment;
            
            commercialFooter = `
                <div class="commercial-totals">
                    <div>Subtotal: R$ ${subtotalOrder.toFixed(2)}</div>
                    <div>Desconto: R$ ${discount.toFixed(2)}</div>
                    <div><strong>Total do Pedido: R$ ${totalFinal.toFixed(2)}</strong></div>
                    <div style="font-size: 12pt; margin-top: 5px;">Adiantamento Pago: R$ ${downPayment.toFixed(2)}</div>
                    <div style="color: ${remaining > 0 ? '#cc0000' : '#006600'}; margin-top: 5px;">
                        <strong>${remaining > 0 ? 'RESTA PAGAR: R$ ' + remaining.toFixed(2) : 'PEDIDO QUITADO'}</strong>
                    </div>
                </div>
            `;
        }

        const obsHtml = order.generalObservation ? `<div class="os-obs">OBSERVAÇÃO GERAL:<br>${order.generalObservation.replace(/\n/g, '<br>')}</div>` : '';

        // Montagem da Folha A4
        htmlContent += `
            <div class="page-break">
                <div class="os-header">
                    <h2>${title}</h2>
                    <table style="width: 100%; border: none; margin-bottom: 0;">
                        <tr>
                            <td style="border: none; padding: 0;"><strong>Cliente:</strong> ${order.clientName}<br><strong>Telefone:</strong> ${order.clientPhone || 'N/A'}</td>
                            <td style="border: none; padding: 0; text-align: right;"><strong>ID Pedido:</strong> #${order.id.substring(0,6).toUpperCase()}<br><strong style="font-size: 14pt;">Entrega: ${delivery}</strong></td>
                        </tr>
                    </table>
                </div>
                
                <table class="os-table">
                    <thead>
                        <tr>
                            <th>Item e Detalhes</th>
                            <th>Grade de Tamanhos / Especificações</th>
                            ${isCommercial ? `<th class="text-right">Subtotal</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${partsHtml}
                    </tbody>
                </table>
                
                ${obsHtml}
                ${commercialFooter}
            </div>
        `;
    });

    // Injeta na Área de Impressão e dispara a ação do navegador
    printZone.innerHTML = htmlContent;
    document.body.classList.add('print-mode-batch');
    
    // Pequeno delay para garantir que o navegador renderize o DOM antes de chamar a caixa de diálogo
    setTimeout(() => {
        window.print();
        document.body.classList.remove('print-mode-batch');
        printZone.innerHTML = '';
    }, 150);
}

// ==========================================
// MÓDULO FINANCEIRO ONLINE (Dashboard)
// ==========================================
async function fetchAndRenderFinanceOnline(companyId) {
    const transRef = collection(db, `companies/${companyId}/transactions`);
    const snapshot = await getDocs(transRef);
    const thirtyDaysAgoTime = new Date().getTime() - (30 * 24 * 60 * 60 * 1000); 
    
    let totalIncome = 0, totalExpense = 0;
    let recentTransactions = [];

    snapshot.forEach(doc => {
        const t = doc.data();
        if (!t.date) return;
        const tDate = new Date(t.date + 'T12:00:00'); 
        if (tDate.getTime() >= thirtyDaysAgoTime) {
            recentTransactions.push(t);
            const amount = parseFloat(t.amount) || 0;
            if (t.type === 'income') totalIncome += amount;
            if (t.type === 'expense') totalExpense += amount;
        }
    });

    recentTransactions.sort((a, b) => b.date.localeCompare(a.date));
    DOM.financeSummary.innerHTML = `<div class="text-green">Entradas: R$ ${totalIncome.toFixed(2)}</div><div class="text-red">Saídas: R$ ${totalExpense.toFixed(2)}</div><div>Saldo: R$ ${(totalIncome - totalExpense).toFixed(2)}</div>`;

    if (recentTransactions.length === 0) {
        DOM.financeContainer.innerHTML = '<p>Nenhuma movimentação recente.</p>';
        return;
    }

    let html = `<table><thead><tr><th>Data</th><th>Descrição</th><th>Origem/Status</th><th class="text-right">Valor</th></tr></thead><tbody>`;
    recentTransactions.forEach(t => {
        const isIncome = t.type === 'income';
        html += `<tr>
            <td>${t.date.split('-').reverse().join('/')}</td>
            <td>${t.description}</td>
            <td>${t.source === 'caixa' ? 'Caixa' : 'Banco'} | ${t.status === 'a_receber' ? 'A Receber' : 'Pago'}</td>
            <td class="text-right ${isIncome ? 'text-green' : 'text-red'}"><strong>${isIncome ? '+' : '-'} R$ ${parseFloat(t.amount).toFixed(2)}</strong></td>
        </tr>`;
    });
    DOM.financeContainer.innerHTML = html + `</tbody></table>`;
}

// Impressão da Lista Geral (Dashboard)
DOM.printBtn.addEventListener('click', () => {
    document.body.classList.remove('print-mode-batch'); // Garante que a zona especial de lote fique oculta
    window.print();
});
DOM.downloadBackupBtn.addEventListener('click', () => {
    if(inMemoryOrders.length === 0) return alert("Sem dados.");
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(inMemoryOrders, null, 2));
    a.download = `backup_pedidos_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); a.remove();
});
