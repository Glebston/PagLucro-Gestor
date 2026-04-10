// ==========================================================
// MÓDULO DOM (v4.3.1 - Patch v5.8.3 - FAB UPDATE)
// Responsabilidade: Centralizar todos os seletores de 
// elementos do DOM da aplicação.
// ==========================================================

// Constantes de UI
export const CHECK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
export const SIZES_ORDER = [
    'PP', 'P', 'M', 'G', 'GG', 'XG',
    '2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos'
];

// Centraliza todos os seletores estáticos da "Casca" (SPA Shell)
export const DOM = {
    // --- Autenticação ---
    authContainer: document.getElementById('authContainer'),
    loginForm: document.getElementById('loginForm'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    forgotPasswordBtn: document.getElementById('forgotPasswordBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    forgotPasswordModal: document.getElementById('forgotPasswordModal'),
    resetEmailInput: document.getElementById('resetEmailInput'),
    sendResetEmailBtn: document.getElementById('sendResetEmailBtn'),
    cancelResetBtn: document.getElementById('cancelResetBtn'),

    // --- Layout Base (Casca SPA) ---
    app: document.getElementById('app'),
    mainContent: document.getElementById('mainContent'),
    userEmail: document.getElementById('userEmail'),
    userMenuBtn: document.getElementById('userMenuBtn'),
    userDropdown: document.getElementById('userDropdown'),
    requestDeletionBtn: document.getElementById('requestDeletionBtn'),
    cookieBanner: document.getElementById('cookieBanner'),
    cookieAcceptBtn: document.getElementById('cookieAcceptBtn'),
    
    // --- Header e Navegação Fixa ---
    financeDashboardBtn: document.getElementById('financeDashboardBtn'),
    toggleViewBtn: document.getElementById('toggleViewBtn'),
    priceTableBtn: document.getElementById('priceTableBtn'),
    backupBtn: document.getElementById('backupBtn'),
    restoreFileInput: document.getElementById('restoreFile'),
    addOrderBtn: document.getElementById('addOrderBtn'),

    // --- Modais Auxiliares e Globais (Mantidos no index.html) ---
    viewModal: document.getElementById('viewModal'),
    infoModal: document.getElementById('infoModal'),
    infoModalMessage: document.getElementById('infoModalMessage'),
    infoModalCloseBtn: document.getElementById('infoModalCloseBtn'),
    confirmModal: document.getElementById('confirmModal'),
    confirmModalMessage: document.getElementById('confirmModalMessage'),
    confirmOkBtn: document.getElementById('confirmOkBtn'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    idleModal: document.getElementById('idleModal'),
    stayLoggedInBtn: document.getElementById('stayLoggedInBtn'),
    countdownTimer: document.getElementById('countdownTimer'),
    
    // --- Gerenciamento de Opções ---
    optionsModal: document.getElementById('optionsModal'),
    optionsModalTitle: document.getElementById('optionsModalTitle'),
    optionsList: document.getElementById('optionsList'),
    newOptionInput: document.getElementById('newOptionInput'),
    addOptionBtn: document.getElementById('addOptionBtn'),
    closeOptionsModalBtn: document.getElementById('closeOptionsModalBtn'),
    partTypeList: document.getElementById('part-type-list'),
    partMaterialList: document.getElementById('part-material-list'),

    // --- Modal de Tabela de Preços ---
    priceTableModal: document.getElementById('priceTableModal'),
    priceTableModalTitle: document.getElementById('priceTableModalTitle'),
    priceTableContainer: document.getElementById('priceTableContainer'),
    priceTableFooter: document.getElementById('priceTableFooter'),
    priceTableEditMessage: document.getElementById('priceTableEditMessage'),
    editPriceTableBtn: document.getElementById('editPriceTableBtn'),
    addPriceItemBtn: document.getElementById('addPriceItemBtn'),
    savePriceTableBtn: document.getElementById('savePriceTableBtn'),
    cancelPriceTableBtn: document.getElementById('cancelPriceTableBtn'),
    closePriceTableBtn: document.getElementById('closePriceTableBtn'),

    // --- Modais Financeiros Globais (Mantidos no index.html) ---
    initialBalanceModal: document.getElementById('initialBalanceModal'),
    initialBalanceInput: document.getElementById('initialBalanceInput'),
    saveBalanceBtn: document.getElementById('saveBalanceBtn'),
    cancelBalanceBtn: document.getElementById('cancelBalanceBtn'),

    transactionModal: document.getElementById('transactionModal'),
    transactionModalTitle: document.getElementById('transactionModalTitle'),
    transactionForm: document.getElementById('transactionForm'),
    transactionId: document.getElementById('transactionId'),
    transactionDate: document.getElementById('transactionDate'),
    transactionDescription: document.getElementById('transactionDescription'),
    transactionCategory: document.getElementById('transactionCategory'),
    transactionSourceContainer: document.getElementById('transactionSourceContainer'),
    transactionAmount: document.getElementById('transactionAmount'),
    transactionType: document.getElementById('transactionType'),
    cancelTransactionBtn: document.getElementById('cancelTransactionBtn'),
    transactionStatusContainer: document.getElementById('transactionStatusContainer'),
    pago: document.querySelector('input[name="transactionStatus"][value="pago"]'),
    a_receber: document.querySelector('input[name="transactionStatus"][value="a_receber"]'),

    settlementModal: document.getElementById('settlementModal'),
    settlementOrderId: document.getElementById('settlementOrderId'),
    settlementAmountDisplay: document.getElementById('settlementAmountDisplay'),
    settlementDate: document.getElementById('settlementDate'),
    settlementSourceContainer: document.getElementById('settlementSourceContainer'),
    settlementCancelBtn: document.getElementById('settlementCancelBtn'),
    settlementConfirmBtn: document.getElementById('settlementConfirmBtn'),

    // --- Banner de Backup ---
    backupReminderBanner: document.getElementById('backupReminderBanner'),
    backupNowBtn: document.getElementById('backupNowBtn'),
    dismissBackupReminderBtn: document.getElementById('dismissBackupReminderBtn'),

    // --- Ações Rápidas (FAB) ---
    fabBackdrop: document.getElementById('fabBackdrop'), 
    fabBtn: document.getElementById('fabMainBtn'),     
    fabMenu: document.getElementById('fabMenu'),       
};
