// ==========================================================
// MÓDULO: RADAR DE PRODUÇÃO (Delivery Radar)
// Responsabilidade: Analisar carga de pedidos na memória, 
// renderizar o Popover visual e prever a capacidade diária.
// Custo de Leitura de Banco: ZERO (Lê direto da SPA/Cache)
// ==========================================================

/**
 * Retorna a capacidade ideal de entregas por dia definida pelo dono.
 * (Puxa do cache local. O padrão de segurança é 10 caso não configurado ainda).
 */
const getDailyCapacity = () => {
    return parseInt(localStorage.getItem('idealDailyCapacity')) || 10;
};

/**
 * Conta os pedidos "Em Aberto" já renderizados no navegador.
 */
const getOrderCountsByDate = () => {
    const counts = {};
    
    // ESTRATÉGIA DE CUSTO ZERO:
    // Ele procura elementos na tela ou na memória que contenham a data.
    // Nota: Adapte o 'data-delivery-date' para o atributo que seus cartões 
    // do Kanban ou tabela usam para guardar a data de entrega.
    const cards = document.querySelectorAll('[data-delivery-date], .order-card');
    
    cards.forEach(card => {
        // Tenta pegar do atributo ou do texto interno dependendo de como seu Kanban é feito
        const date = card.getAttribute('data-delivery-date') || card.dataset.date;
        if (date) {
            counts[date] = (counts[date] || 0) + 1;
        }
    });

    // Se o seu sistema armazena os pedidos em uma variável global (ex: window.ordersCache),
    // você também pode somar aqui:
    // if (window.ordersCache) { window.ordersCache.forEach(o => counts[o.deliveryDate] = (counts[o.deliveryDate] || 0) + 1); }

    return counts;
};

/**
 * Determina o status visual de um dia baseado na capacidade.
 */
const getDayStatus = (count, capacity) => {
    if (count >= capacity) return { color: 'bg-red-100 text-red-700 border-red-300', icon: '🔴', label: 'Lotado' };
    if (count >= capacity * 0.7) return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🟡', label: 'Quase Cheio' };
    return { color: 'bg-green-100 text-green-700 border-green-300', icon: '🟢', label: 'Tranquilo' };
};

/**
 * Renderiza ou Exibe o Popover do Radar na Tela
 */
export const initializeRadar = () => {
    let popover = document.getElementById('radarPopover');
    
    // Se o Popover ainda não existir na tela, nós o criamos
    if (!popover) {
        popover = document.createElement('div');
        popover.id = 'radarPopover';
        // Z-index alto para ficar sobre o Modal, posição absoluta
        // Ajustado: w-[90vw] para celular e sm:w-96 (maior) para PC
        popover.className = 'absolute z-[60] bg-white rounded-xl shadow-2xl border border-gray-200 p-5 w-[90vw] sm:w-96 transition-all transform opacity-0 scale-95 pointer-events-none';
        document.body.appendChild(popover);

        // Lógica para fechar se clicar fora do radar
        document.addEventListener('mousedown', (e) => {
            const radarBtn = document.getElementById('radarBtn');
            if (popover && !popover.contains(e.target) && radarBtn && !radarBtn.contains(e.target)) {
                closeRadar();
            }
        });
    }

    // Posicionar o Popover perto do botão (ou centralizado se em telas pequenas)
    const btn = document.getElementById('radarBtn');
    if (btn) {
        const rect = btn.getBoundingClientRect();
        popover.style.top = `${rect.bottom + window.scrollY + 10}px`;
        // Ajusta para não sair da tela à direita
        const leftPos = rect.left - 200; 
        popover.style.left = `${Math.max(10, leftPos)}px`;
    }

    renderCalendar(popover);
    
    // Animação de entrada
    popover.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
    popover.classList.add('opacity-100', 'scale-100');
};

/**
 * Fecha o Popover
 */
const closeRadar = () => {
    const popover = document.getElementById('radarPopover');
    if (popover) {
        popover.classList.remove('opacity-100', 'scale-100');
        popover.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
    }
};

/**
 * Constrói o HTML dos próximos 21 dias e injeta no Popover
 */
const renderCalendar = (container) => {
    const capacity = getDailyCapacity();
    const counts = getOrderCountsByDate();

    // LÓGICA DE AUTO-EXPANSÃO: Descobre a data mais distante nos pedidos atuais
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let maxDaysToRender = 21; // Padrão: 3 semanas

    const datesWithOrders = Object.keys(counts).sort();
    if (datesWithOrders.length > 0) {
        const furthestDateStr = datesWithOrders[datesWithOrders.length - 1];
        const furthestDate = new Date(furthestDateStr + 'T00:00:00'); // Timezone seguro
        const diffTime = furthestDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Se tiver pedido distante, estica o radar (limite de 90 dias por performance)
        if (diffDays > 21 && diffDays <= 90) {
            maxDaysToRender = diffDays + 5; // Dá uma margem de 5 dias após o último pedido
        } else if (diffDays > 90) {
            maxDaysToRender = 90;
        }
    }

    let html = `
        <div class="flex justify-between items-center mb-4 border-b pb-3">
            <h3 class="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">📅 Radar de Produção</h3>
            <button type="button" id="closeRadarBtn" class="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">&times;</button>
        </div>
        <div class="text-xs text-gray-500 mb-3 flex justify-between bg-gray-50 p-2 rounded border border-gray-100">
            <span>Meta de Fabricaçao: <b class="text-gray-700">${capacity} pedidos/dia</b></span>
        </div>
        <div class="max-h-80 overflow-y-auto custom-scrollbar pr-2 space-y-3">
    `;

    // Gerar os dias dinamicamente
    for (let i = 0; i <= maxDaysToRender; i++) {
        const dateObj = new Date(today);
        dateObj.setDate(today.getDate() + i); 

        // Formatação YYYY-MM-DD para o input
        const dateString = dateObj.toISOString().split('T')[0];
        
        // Formatação DD/MM (Dia da Semana) para exibição
        const displayDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();

        const count = counts[dateString] || 0;
        const status = getDayStatus(count, capacity);

        html += `
        <div class="radar-day cursor-pointer flex justify-between items-center p-3 rounded-lg border hover:shadow-md hover:-translate-y-0.5 transition-all ${status.color}" data-date="${dateString}">
            <div class="flex flex-col gap-0.5">
                <span class="text-sm font-bold">${displayDate} <span class="font-medium opacity-80 ml-1">(${weekDay})</span></span>
                <span class="text-xs font-semibold opacity-90">${count} pedido(s) agendados</span>
            </div>
            <div class="text-2xl" title="${status.label}">${status.icon}</div>
        </div>
    `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Listeners de clique nos dias do Radar
    container.querySelectorAll('.radar-day').forEach(dayEl => {
        dayEl.addEventListener('click', (e) => {
            const selectedDate = e.currentTarget.getAttribute('data-date');
            const dateInput = document.getElementById('deliveryDate');
            
            if (dateInput) {
                // Preenche o input magicamente
                dateInput.value = selectedDate;
                // Dispara o evento change para validar e mostrar/esconder o aviso laranja
                dateInput.dispatchEvent(new Event('change'));
            }
            closeRadar();
        });
    });

    // Listener do botão de fechar X
    document.getElementById('closeRadarBtn').addEventListener('click', closeRadar);
};

/**
 * Avalia a data digitada no formulário e exibe um alerta laranja se ultrapassar a capacidade.
 */
export const checkCapacityWarning = (dateString) => {
    const warningEl = document.getElementById('capacityWarning');
    const badgeEl = document.getElementById('radarBadge'); // Aquele "!" no botão
    if (!warningEl || !dateString) return;

    const capacity = getDailyCapacity();
    const counts = getOrderCountsByDate();
    
    // Vê quantos já tem nessa data
    const countForDate = counts[dateString] || 0;

    if (countForDate >= capacity) {
        warningEl.textContent = `⚠️ Atenção: A capacidade de produção (${capacity}) para este dia já foi atingida (${countForDate} pedidos).`;
        warningEl.classList.remove('hidden');
        if (badgeEl) badgeEl.classList.remove('opacity-0');
    } else {
        warningEl.classList.add('hidden');
        if (badgeEl) badgeEl.classList.add('opacity-0');
    }
};

// ==========================================
// RECEPTOR MAGNÉTICO: FECHAMENTO INTELIGENTE (ESC)
// ==========================================
// O "true" garante que o Radar ouça o ESC primeiro.
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const popover = document.getElementById('radarPopover');
        // Verifica se o radar realmente existe e está aberto (visível) na tela
        const isRadarOpen = popover && !popover.classList.contains('opacity-0');

        if (isRadarOpen) {
            closeRadar();
            e.preventDefault();
            e.stopPropagation(); // ESCUDO: Impede que o "ESC" vaze e feche o modal de trás
        }
    }
}, true);

// Garante que o Radar também feche se o usuário clicar em "Cancelar" ou no "X"
document.addEventListener('click', (e) => {
    if (e.target.closest('#cancelBtn') || e.target.closest('#closeOrderModalX')) {
        closeRadar();
    }
}, true);
