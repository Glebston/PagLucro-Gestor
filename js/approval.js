// js/approval.js
// ===========================================================
// ==========================================================
// MÓDULO PÚBLICO DE APROVAÇÃO (v2.0.5 - DETAILED SPECIFICS)
// Correção 1: Leitura híbrida de whatsapp/whatsappNumber (Branding)
// Correção 2: Exibição inteligente de Nº vs Cargo/Detalhe
// Correção 3: Ordenação estrita de tamanhos (PP -> XGG -> Anos)
// Correção 4: Detalhamento visual de itens sob medida (L x A)
// ==========================================================

// 1. Configurações Dinâmicas (Inicia com padrões seguros)
let companyConfig = {
    pixKey: "",           
    pixBeneficiary: "",   
    entryPercentage: 0.50, 
    whatsappNumber: "",   // Armazena o telefone final
    logoUrl: ""           
};

// 2. Importações
import { db } from './firebaseConfig.js'; 
import { calculateOrderTotals } from './financialCalculator.js'; 
import { 
    collectionGroup, 
    query, 
    where, 
    getDocs, 
    getDoc, 
    doc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Referências DOM ---
const DOM = {
    loading: document.getElementById('loadingState'),
    error: document.getElementById('errorState'),
    content: document.getElementById('orderContent'),
    footer: document.getElementById('actionFooter'),
    headerStatus: document.getElementById('headerStatus'),
    brandingHeader: document.getElementById('brandingHeader'),
    clientName: document.getElementById('clientName'),
    deliveryDate: document.getElementById('deliveryDate'),
    mockupGallery: document.getElementById('mockupGallery'),
    itemsTable: document.getElementById('itemsTableBody'),
    obs: document.getElementById('generalObservation'),
    btnApprove: document.getElementById('btnApprove'),
    btnRequest: document.getElementById('btnRequestChanges'),
    modal: document.getElementById('feedbackModal'),
    modalContent: document.getElementById('modalContent')
};

// Variáveis Globais
let currentOrderDoc = null;
let currentOrderData = null;

// --- Utilitários ---
const formatMoney = (value) => {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateStr) => {
    if(!dateStr) return '--';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const formatPhoneVisual = (phone) => {
    if (!phone) return "";
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('55') && clean.length > 11) clean = clean.substring(2);
    if (clean.length === 11) return `(${clean.substring(0,2)}) ${clean.substring(2,7)}-${clean.substring(7)}`;
    if (clean.length === 10) return `(${clean.substring(0,2)}) ${clean.substring(2,6)}-${clean.substring(6)}`;
    return phone; 
};

const showModal = (htmlContent, autoClose = false) => {
    DOM.modalContent.innerHTML = htmlContent;
    DOM.modal.classList.remove('hidden');
    if (autoClose) setTimeout(() => DOM.modal.classList.add('hidden'), 3000);
};

const closeModal = () => DOM.modal.classList.add('hidden');

// --- Lógica Principal ---

const loadCompanySettings = async (companyId) => {
    if (!companyId) return;
    try {
        const configRef = doc(db, `companies/${companyId}/config/payment`);
        const snap = await getDoc(configRef);
        
        if (snap.exists()) {
            const data = snap.data();
            if (data.pixKey) companyConfig.pixKey = data.pixKey;
            if (data.pixBeneficiary) companyConfig.pixBeneficiary = data.pixBeneficiary;
            if (data.entryPercentage !== undefined) companyConfig.entryPercentage = parseFloat(data.entryPercentage);
            
            // [Fix Branding] Aceita 'whatsapp' (novo) OU 'whatsappNumber' (legado)
            companyConfig.whatsappNumber = data.whatsapp || data.whatsappNumber || "";
            
            if (data.logoUrl) companyConfig.logoUrl = data.logoUrl;
        }

        // Fallback Legado
        if (!companyConfig.pixKey) {
            const companyRef = doc(db, `companies/${companyId}`);
            const companySnap = await getDoc(companyRef);
            if (companySnap.exists()) {
                const data = companySnap.data();
                if (data.pixKey) companyConfig.pixKey = data.pixKey;
                if (data.chavePix) companyConfig.pixKey = data.chavePix;
                if (data.pixBeneficiary) companyConfig.pixBeneficiary = data.pixBeneficiary;
            }
        }
    } catch (error) {
        console.warn("Erro ao carregar configurações:", error);
    }
};

const applyBranding = () => {
    if (!companyConfig.logoUrl) return; 

    const displayPhone = formatPhoneVisual(companyConfig.whatsappNumber);

    const brandingHtml = `
        <img src="${companyConfig.logoUrl}" class="w-12 h-12 rounded-full object-contain bg-white border border-gray-200 shadow-sm" alt="Logo">
        <div class="flex flex-col">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Nosso whatsapp</span>
            ${displayPhone ? `
                <div class="flex items-center gap-1 text-gray-700 font-bold text-sm">
                    <i class="fa-brands fa-whatsapp text-green-500"></i>
                    <span>${displayPhone}</span>
                </div>
            ` : '<span class="text-gray-700 font-bold text-sm">Confira seu pedido</span>'}
        </div>
    `;

    DOM.brandingHeader.innerHTML = brandingHtml;
};

// --- INÍCIO: MOTOR DE CARREGAMENTO BLINDADO ---
const loadOrder = async () => {
    try {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('id');
        const companyId = params.get('cid'); // [NOVO] Lê a empresa da URL

        if (!orderId) throw new Error("ID não fornecido");

        if (companyId) {
            // [ROTA BLINDADA - DIRETA] Não precisa de permissão "list", apenas "get"
            const docRef = doc(db, `companies/${companyId}/orders/${orderId}`);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                throw new Error("Pedido não encontrado");
            }
            
            currentOrderDoc = docRef;
            currentOrderData = docSnap.data();
        } else {
            // [ROTA LEGADA - BUSCA GLOBAL] (Mantida para links antigos)
            const q = query(collectionGroup(db, 'orders'), where('id', '==', orderId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error("Pedido não encontrado na busca global");
            }

            const docRef = querySnapshot.docs[0];
            currentOrderDoc = docRef.ref;
            currentOrderData = docRef.data();
        }
        
        // [CIRURGIA DE BLINDAGEM] Garante que pedidos antigos tenham um status válido
        if (!currentOrderData.orderStatus) {
            currentOrderData.orderStatus = 'Pendente';
        }

        // Pega o ID da empresa a partir do caminho do documento para carregar configs
        const resolvedCompanyId = currentOrderDoc.parent.parent.id;
        
        await loadCompanySettings(resolvedCompanyId);
        applyBranding();
        renderOrder(currentOrderData);

    } catch (error) {
        console.error("Erro ao carregar:", error);
        DOM.loading.classList.add('hidden');
        DOM.error.classList.remove('hidden');
        DOM.error.querySelector('p').textContent = "O link pode estar incorreto, expirado ou você não tem permissão de acesso.";
    }
};
// --- FIM: MOTOR DE CARREGAMENTO BLINDADO ---

const renderOrder = (order) => {
    DOM.clientName.textContent = order.clientName;
    DOM.deliveryDate.textContent = formatDate(order.deliveryDate);
    
    const statusMap = {
        'Pendente': { color: 'bg-yellow-100 text-yellow-800', label: 'Novo / Pendente' },
        'Aguardando Aprovação': { color: 'bg-cyan-100 text-cyan-800', label: 'Aguardando Sua Aprovação' },
        'Aprovado pelo Cliente': { color: 'bg-green-100 text-green-800', label: 'Aprovado' },
        'Alteração Solicitada': { color: 'bg-red-100 text-red-800', label: 'Alteração Solicitada' },
        'Em Produção': { color: 'bg-blue-100 text-blue-800', label: 'Em Produção' },
        'Entregue': { color: 'bg-gray-100 text-gray-800', label: 'Entregue' }
    };
    
    const statusConfig = statusMap[order.orderStatus] || { color: 'bg-gray-100 text-gray-800', label: order.orderStatus };
    DOM.headerStatus.className = `text-xs font-bold uppercase px-2 py-1 rounded ${statusConfig.color}`;
    DOM.headerStatus.textContent = statusConfig.label;

    // --- INÍCIO: CONTROLE HÍBRIDO DA GALERIA GLOBAL ---
    const globalSection = document.getElementById('globalMockupSection');
    DOM.mockupGallery.innerHTML = '';
    
    if (order.mockupUrls && order.mockupUrls.length > 0) {
        if (globalSection) globalSection.classList.remove('hidden'); // Mostra a caixa
        order.mockupUrls.forEach(url => {
            const imgContainer = document.createElement('div');
            imgContainer.className = "relative group rounded-lg overflow-hidden shadow-sm border border-gray-100";
            imgContainer.innerHTML = `
                <img src="${url}" class="w-full h-auto object-cover max-h-[500px]" alt="Arte">
                <a href="${url}" target="_blank" class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <span class="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-700 text-xs px-3 py-1 rounded-full shadow-lg font-bold">
                        <i class="fa-solid fa-expand mr-1"></i> Ver Original
                    </span>
                </a>
            `;
            DOM.mockupGallery.appendChild(imgContainer);
        });
    } else {
        if (globalSection) globalSection.classList.add('hidden'); // Esconde a caixa inteira
    }
    // --- FIM: CONTROLE HÍBRIDO ---

    DOM.itemsTable.innerHTML = '';
    (order.parts || []).forEach(p => {
        // --- INÍCIO: ZONA DO MOCKUP INDIVIDUAL NO LINK DO CLIENTE (Multi-Imagens) ---
        let mockupIndividualHtml = '';
        
        // Unifica a nova estrutura (array) com o legado (string isolada)
        let urlsParaCliente = [];
        if (p.mockupPecas && p.mockupPecas.length > 0) {
            urlsParaCliente = p.mockupPecas;
        } else if (p.mockupPeca) {
            urlsParaCliente = [p.mockupPeca];
        }

        if (urlsParaCliente.length > 0) {
            // Cria os links individuais para cada imagem
            const imagensHtml = urlsParaCliente.map(url => `
                <a href="${url}" target="_blank" class="shrink-0 relative group rounded border border-gray-200 shadow-sm overflow-hidden bg-white">
                    <img src="${url}" class="w-24 h-24 object-cover object-top group-hover:opacity-90 transition-opacity" alt="Arte da Peça">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <span class="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-700 text-[10px] px-2 py-0.5 rounded-full shadow font-bold"><i class="fa-solid fa-expand"></i></span>
                    </div>
                </a>
            `).join('');

            // Envelopa tudo em um container de rolagem horizontal nativo do Tailwind (swipe no celular)
            mockupIndividualHtml = `
                <div class="mt-2 mb-2 flex gap-2 overflow-x-auto snap-x scrollbar-hide pb-1 w-full max-w-full">
                    ${imagensHtml}
                </div>
            `;
        }
        // --- FIM: ZONA DO MOCKUP INDIVIDUAL ---

        let detailsHtml = `<span class="font-bold text-gray-700 text-base">${p.type}</span>`;
        detailsHtml += `<div class="text-xs text-gray-500 mt-0.5">${p.material} | ${p.colorMain}</div>`;
        detailsHtml += mockupIndividualHtml; // Injeta a arte logo abaixo do nome/tecido
        
        if (p.partInputType === 'comum') {
            if (p.sizes) {
                // ORDEM DE EXIBIÇÃO: Lista exata da regra de negócio
                const sizeOrder = [
                    "PP", "P", "M", "G", "GG", "XGG",
                    "2 anos", "4 anos", "6 anos", "8 anos", "10 anos", "12 anos"
                ];

                const sizesStr = Object.entries(p.sizes).map(([cat, sizesObj]) => {
                    // Ordena os tamanhos dentro da categoria antes de gerar o HTML
                    const sortedSizes = Object.entries(sizesObj)
                        .filter(([,q]) => q > 0)
                        .sort(([keyA], [keyB]) => {
                            let idxA = sizeOrder.indexOf(keyA);
                            let idxB = sizeOrder.indexOf(keyB);
                            // Se não estiver na lista, joga pro final
                            if (idxA === -1) idxA = 999;
                            if (idxB === -1) idxB = 999;
                            return idxA - idxB;
                        });

                    const s = sortedSizes.map(([k,v]) => `${k}(${v})`).join(', ');
                    return s ? `<div class="mt-1"><span class="font-semibold text-gray-600 text-[10px] uppercase">${cat}:</span> ${s}</div>` : '';
                }).join('');
                detailsHtml += sizesStr;
            }
            // --- NOVA LÓGICA: Detalhamento de Itens Sob Medida (v2.0.5) ---
            if(p.specifics && p.specifics.length) {
                detailsHtml += `<div class="mt-1 text-xs bg-blue-50 p-2 rounded border border-blue-100">
                    <div class="font-semibold text-blue-600 mb-1"><i class="fa-solid fa-ruler-combined mr-1"></i>Sob Medida (${p.specifics.length}):</div>
                    <div class="flex flex-wrap gap-1">
                        ${p.specifics.map(s => {
                             // Fallback seguro para propriedades
                             const w = s.width || s.largura || '?';
                             const h = s.height || s.altura || '?';
                             const obs = s.observation || s.obs ? ` <span class="text-gray-500 italic">(${s.observation || s.obs})</span>` : '';
                             
                             return `<span class="bg-white border border-blue-200 px-2 py-1 rounded shadow-sm text-blue-800 font-bold">
                                L: ${w} x A: ${h}${obs}
                             </span>`;
                        }).join('')}
                    </div>
                </div>`;
            }

        } else if (p.details && p.details.length) {
            detailsHtml += `<div class="mt-1 text-xs bg-slate-50 p-1 rounded border border-slate-100">
                <div class="font-semibold text-gray-500 mb-1">Lista de Nomes (${p.details.length}):</div>
                ${p.details.map(d => {
                    let extras = [];
                    if(d.number) {
                        const isNumeric = /^\d+$/.test(d.number.toString().trim());
                        if(isNumeric) {
                            extras.push(`Nº ${d.number}`); 
                        } else {
                            extras.push(d.number); 
                        }
                    }
                    if(d.function) extras.push(d.function);
                    if(!d.function && d.cargo) extras.push(d.cargo);
                    const extraHtml = extras.length > 0 ? `<span class="text-gray-500 italic"> - ${extras.join(' - ')}</span>` : '';

                    return `<span class="inline-block bg-white border px-1 rounded mr-1 mb-1 shadow-sm">
                        <span class="font-bold text-gray-700">${d.name}</span> 
                        <span class="text-gray-500">(${d.size})</span>
                        ${extraHtml}
                    </span>`;
                }).join('')}
            </div>`;
        }
        const totalQty = (Object.values(p.sizes || {}).flatMap(x=>Object.values(x)).reduce((a,b)=>a+b,0)) + (p.specifics?.length||0) + (p.details?.length||0);
        const row = document.createElement('tr');
        row.innerHTML = `<td class="p-3 align-top border-b border-gray-50">${detailsHtml}</td><td class="p-3 align-top text-center font-bold text-gray-700 border-b border-gray-50">${totalQty}</td>`;
        DOM.itemsTable.appendChild(row);
    });

    const finance = calculateOrderTotals(order);
    const financeHtml = `
        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 space-y-2 text-sm">
            <div class="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>${formatMoney(finance.grossTotal)}</span>
            </div>
            ${finance.discount > 0 ? `
            <div class="flex justify-between text-green-600">
                <span>Desconto</span>
                <span>- ${formatMoney(finance.discount)}</span>
            </div>` : ''}
            <div class="flex justify-between text-gray-800 font-bold border-t border-slate-200 pt-2 mt-2">
                <span>Total do Pedido</span>
                <span>${formatMoney(finance.total)}</span>
            </div>
            ${finance.paid > 0 ? `
            <div class="flex justify-between text-blue-600 mt-1">
                <span>Já Pago (Sinal)</span>
                <span>- ${formatMoney(finance.paid)}</span>
            </div>` : ''}
            <div class="flex justify-between text-red-600 font-bold text-base mt-2 pt-2 border-t border-slate-200 bg-white p-2 rounded shadow-sm">
                <span>Restante a Pagar</span>
                <span>${formatMoney(finance.remaining)}</span>
            </div>
        </div>
    `;
    const oldFinance = document.getElementById('financeCardDisplay');
    if(oldFinance) oldFinance.remove();
    const financeContainer = document.createElement('div');
    financeContainer.id = 'financeCardDisplay';
    financeContainer.innerHTML = financeHtml;
    DOM.itemsTable.parentElement.parentElement.after(financeContainer); 

    if (order.generalObservation) {
        DOM.obs.textContent = order.generalObservation;
        DOM.obs.className = "text-gray-700 text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-100";
    }

    const isActionable = ['Pendente', 'Aguardando Aprovação', 'Alteração Solicitada'].includes(order.orderStatus);
    
    if (isActionable) {
        DOM.loading.classList.add('hidden');
        DOM.content.classList.remove('hidden');
        DOM.footer.classList.remove('hidden');
    } else {
        DOM.loading.classList.add('hidden');
        DOM.content.classList.remove('hidden');
        DOM.footer.classList.add('hidden');
        const alertDiv = document.createElement('div');
        alertDiv.className = "bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm text-center mb-4";
        alertDiv.innerHTML = `<i class="fa-solid fa-lock mr-2"></i>Este pedido já está em: <strong>${statusConfig.label}</strong>.`;
        const existingAlert = DOM.content.querySelector('.bg-blue-50');
        if (existingAlert) existingAlert.remove();
        DOM.content.prepend(alertDiv);
    }
};

DOM.btnApprove.addEventListener('click', async () => {
    if (!currentOrderDoc || !currentOrderData) return;

    const finance = calculateOrderTotals(currentOrderData);
    const requiredEntry = finance.total * companyConfig.entryPercentage; 
    const pendingEntry = requiredEntry - finance.paid;

    const confirmed = confirm("Tem certeza que deseja APROVAR este layout?");
    if (!confirmed) return;

    DOM.btnApprove.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processando...';
    DOM.btnApprove.disabled = true;

    try {
        await updateDoc(currentOrderDoc, {
            orderStatus: 'Aprovado pelo Cliente',
            approvalDate: new Date().toISOString(),
            approvalMeta: { userAgent: navigator.userAgent, timestamp: Date.now() }
        });

        if (pendingEntry > 0.01) { 
            const percentDisplay = Math.round(companyConfig.entryPercentage * 100);
            const hasPix = !!companyConfig.pixKey;

            const pixHtml = hasPix ? `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-2 text-left">
                    <p class="text-sm text-gray-700 mb-1">Valor do Adiantamento:</p>
                    <p class="text-2xl font-bold text-gray-900 mb-3">${formatMoney(pendingEntry)}</p>
                    <p class="text-xs font-bold text-gray-500 uppercase mb-1">Chave PIX:</p>
                    <div class="flex gap-2">
                        <input type="text" value="${companyConfig.pixKey}" id="pixKeyInput" readonly class="w-full bg-white border p-2 rounded text-sm font-mono text-gray-700">
                        <button id="btnCopyPix" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 rounded font-bold transition">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                    ${companyConfig.pixBeneficiary ? `<p class="text-center text-xs text-gray-400 mt-1">Beneficiário: ${companyConfig.pixBeneficiary}</p>` : ''}
                </div>
            ` : `
                 <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-2 text-center">
                    <p class="text-sm text-gray-700 mb-1">Valor do Adiantamento:</p>
                    <p class="text-2xl font-bold text-gray-900 mb-2">${formatMoney(pendingEntry)}</p>
                    <p class="text-xs text-gray-500">Combine o pagamento com nosso atendimento.</p>
                </div>
            `;

            showModal(`
                <div class="text-center">
                    <div class="text-green-500 text-5xl mb-3"><i class="fa-solid fa-circle-check"></i></div>
                    <h3 class="text-xl font-bold text-gray-800 mb-1">Arte Aprovada!</h3>
                    <p class="text-gray-600 text-sm mb-4">
                        Tudo pronto! Para iniciarmos a produção, é necessário o adiantamento de <strong>${percentDisplay}%</strong>.
                    </p>
                    ${pixHtml}
                    <p class="text-xs text-gray-500 mt-2 mb-6">
                        Prefere outra forma de pagamento? Combine com nosso atendimento.
                    </p>
                    <button onclick="location.reload()" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg transition shadow-sm">
                        Fechar
                    </button>
                </div>
            `);

            if (hasPix) {
                const btnCopy = document.getElementById('btnCopyPix');
                if (btnCopy) {
                    btnCopy.onclick = () => {
                        const input = document.getElementById('pixKeyInput');
                        input.select();
                        input.setSelectionRange(0, 99999);
                        navigator.clipboard.writeText(input.value).then(() => {
                            btnCopy.innerHTML = '<i class="fa-solid fa-check text-green-600"></i>';
                            setTimeout(() => btnCopy.innerHTML = '<i class="fa-regular fa-copy"></i>', 2000);
                        });
                    };
                }
            }

        } else {
            showModal(`
                <div class="text-center">
                    <div class="text-green-500 text-5xl mb-4"><i class="fa-solid fa-circle-check"></i></div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Tudo Certo!</h3>
                    <p class="text-gray-600">O layout foi aprovado e o pagamento está OK.</p>
                    <p class="text-blue-600 font-bold mt-2">A produção será iniciada.</p>
                    <button onclick="location.reload()" class="mt-6 bg-gray-800 text-white px-6 py-2 rounded-lg w-full">OK</button>
                </div>
            `);
        }
        DOM.footer.classList.add('hidden');
    } catch (error) {
        console.error("Erro ao aprovar:", error);
        alert("Ocorreu um erro. Tente novamente.");
        DOM.btnApprove.innerHTML = '<i class="fa-solid fa-check-double"></i> APROVAR ARTE';
        DOM.btnApprove.disabled = false;
    }
});

DOM.btnRequest.addEventListener('click', () => {
    showModal(`
        <h3 class="text-lg font-bold text-gray-800 mb-2 text-left">O que precisa ser ajustado?</h3>
        <textarea id="changeReason" class="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32" placeholder="Ex: O nome 'João' está errado..."></textarea>
        <div class="flex gap-3 mt-4">
            <button id="cancelModal" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold">Cancelar</button>
            <button id="confirmChange" class="flex-1 bg-red-500 text-white py-2 rounded-lg font-bold hover:bg-red-600">Enviar Solicitação</button>
        </div>
    `);

    document.getElementById('cancelModal').onclick = closeModal;
    
    document.getElementById('confirmChange').onclick = async () => {
        const reason = document.getElementById('changeReason').value.trim();
        if (!reason) return alert("Descreva o ajuste.");

        const btn = document.getElementById('confirmChange');
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';
        btn.disabled = true;

        try {
            const newObs = (currentOrderData.generalObservation || '') + `\n\n[Solicitação do Cliente em ${new Date().toLocaleDateString()}]: ${reason}`;

            await updateDoc(currentOrderDoc, {
                orderStatus: 'Alteração Solicitada',
                generalObservation: newObs
            });

            showModal(`
                <div class="text-center">
                    <div class="text-blue-500 text-5xl mb-4"><i class="fa-solid fa-paper-plane"></i></div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Solicitação Enviada</h3>
                    <p class="text-gray-600">Recebemos seu pedido de ajuste.</p>
                    <button onclick="location.reload()" class="mt-6 bg-gray-800 text-white px-6 py-2 rounded-lg w-full">OK</button>
                </div>
            `);

        } catch (error) {
            console.error("Erro ao solicitar:", error);
            alert("Erro ao enviar solicitação.");
            closeModal();
        }
    };
});

loadOrder();
