// js/listeners/catalogListeners.js
// ========================================================
// OUVINTES DO CATÁLOGO (SPA SEGURO COM FILTRO DE NULL)
// ========================================================

import { auth } from "../firebaseConfig.js";
import { renderCatalogUI } from "../ui/catalogRenderer.js"; 
import { 
    getCatalogItems, 
    addCatalogItem, 
    updateCatalogItem, 
    deleteCatalogItem, 
    toggleItemStatus, 
    uploadCatalogImage,
    getRealCompanyId 
} from "../services/catalogService.js";

let DOM = {};
let tempImageUrl = ""; 
let catalogListenersAttached = false;

const refreshDOMReferences = () => {
    DOM = {
        menuBtn: document.getElementById('catalogDashboardBtn'),
        financeMenuBtn: document.getElementById('financeDashboardBtn'),
        modal: document.getElementById('catalogModal'),
        form: document.getElementById('catalogForm'),
        saveBtn: document.getElementById('saveCatalogBtn'),
        cancelBtn: document.getElementById('cancelCatalogBtn'),
        closeXBtn: document.getElementById('closeCatalogModalBtn'),
        itemId: document.getElementById('catalogItemId'),
        title: document.getElementById('catalogTitle'),
        category: document.getElementById('catalogCategory'),
        price: document.getElementById('catalogPrice'),
        description: document.getElementById('catalogDescription'),
        imageInput: document.getElementById('catalogImageInput'),
        imagePreview: document.getElementById('catalogImagePreview'),
        imagePlaceholder: document.getElementById('catalogImagePlaceholder'),
        uploadLoader: document.getElementById('catalogUploadLoader')
    };
};

const attachCatalogModalListenersOnce = () => {
    if (catalogListenersAttached) return;
    if (DOM.cancelBtn) DOM.cancelBtn.addEventListener('click', closeModal);
    if (DOM.closeXBtn) DOM.closeXBtn.addEventListener('click', closeModal);
    if (DOM.imageInput) DOM.imageInput.addEventListener('change', handleImageSelect);
    if (DOM.saveBtn) DOM.saveBtn.addEventListener('click', handleSave);
    catalogListenersAttached = true;
}; 

export function initCatalogListeners() {
    refreshDOMReferences();

    if (DOM.menuBtn) {
        DOM.menuBtn.classList.remove('hidden');
        DOM.menuBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await openCatalogDashboard();
        });
    }

    if (DOM.financeMenuBtn) {
        DOM.financeMenuBtn.addEventListener('click', () => {
            const catView = document.getElementById('catalogDashboard');
            if(catView) catView.classList.add('hidden');
        });
    }

    // DELEGAÇÃO GLOBAL SPA
    document.addEventListener('click', async (e) => {
        if (e.target.closest('#exitCatalogBtn') || e.target.id === 'backToOrdersBtn') {
            e.preventDefault();
            window.location.reload(); // Recarregamento seguro para voltar aos Pedidos
        }
        
        if (e.target.closest('#copyLinkBtn')) {
            copyStoreLink();
        }
        
        if (e.target.closest('#publicStoreLink')) {
            e.preventDefault(); 
            await handleOpenStoreSafe(); 
        }

        if (e.target.closest('#addCatalogItemBtn')) {
            try {
                const { ensureCatalogModalLoaded } = await import(`../ui/modalHandler.js`);
                await ensureCatalogModalLoaded();
                refreshDOMReferences(); 
                attachCatalogModalListenersOnce();
                openModal();
            } catch (err) {
                console.error(err);
            }
        }

        if (e.target.closest('#catalogList')) {
            handleListActions(e);
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target.closest('#catalogList')) {
            handleListChanges(e);
        }
    });
}

async function handleOpenStoreSafe() {
    const publicStoreBtn = document.getElementById('publicStoreLink');
    const originalText = publicStoreBtn ? publicStoreBtn.innerHTML : '';
    
    try {
        if(publicStoreBtn) publicStoreBtn.innerHTML = `<svg class="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        
        let realId = await getRealCompanyId();
        const user = auth.currentUser;

        // [CORREÇÃO CRÍTICA] Impede que a string literal 'null' passe
        if (!realId || String(realId) === 'null' || String(realId) === 'undefined') {
            realId = user ? user.uid : null;
        }

        if (!realId) {
            alert("Erro: Não foi possível identificar sua conta. Recarregue a página.");
            return;
        }

        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '').replace('dashboard', '') + 'catalogo.html';
        const fullUrl = `${baseUrl}?uid=${realId}`;
        window.open(fullUrl, '_blank');

    } catch (error) {
        console.error("Erro ao abrir loja:", error);
        alert("Erro ao abrir loja: " + error.message);
    } finally {
        if(publicStoreBtn) publicStoreBtn.innerHTML = originalText;
    }
}

async function openCatalogDashboard() {
    const container = document.getElementById('mainViewContainer');
    if (!container) return;

    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) userDropdown.classList.add('hidden');

    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg class="animate-spin h-10 w-10 mb-4 text-purple-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p>Construindo Catálogo Premium...</p>
        </div>`;

    try {
        const response = await fetch(`views/catalogView.html?v=${Date.now()}`);
        if (!response.ok) throw new Error('Falha ao carregar a tela do catálogo');
        container.innerHTML = await response.text();

        refreshDOMReferences();

        let realId = await getRealCompanyId();
        const user = auth.currentUser;
        
        // [CORREÇÃO CRÍTICA] Tratamento anti-null para o Input de Link
        if (!realId || String(realId) === 'null' || String(realId) === 'undefined') {
             realId = user ? user.uid : '';
        }

        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '').replace('dashboard', '') + 'catalogo.html';
        
        const storeLinkInput = document.getElementById('storeLinkInput');
        if (storeLinkInput) storeLinkInput.value = `${baseUrl}?uid=${realId}`;

        const publicStoreBtn = document.getElementById('publicStoreLink');
        if (publicStoreBtn) publicStoreBtn.classList.remove('hidden');

        await loadCatalogData();

    } catch (error) {
        console.error("Erro fatal:", error);
        container.innerHTML = `<p class="text-red-500 text-center p-4">Erro ao carregar: ${error.message}</p>`;
    }
}

async function loadCatalogData() {
    try {
        const data = await getCatalogItems(); 
        renderCatalogUI(data, null); 
    } catch (error) {
        console.error(error);
        const list = document.getElementById('catalogList');
        if(list) list.innerHTML = `<p class="text-center text-gray-500 py-10">Não foi possível carregar os produtos.</p>`;
    }
}

function copyStoreLink() {
    const storeLinkInput = document.getElementById('storeLinkInput');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    if(!storeLinkInput) return;
    
    storeLinkInput.select();
    document.execCommand('copy');
    
    if(copyLinkBtn) {
        const originalText = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = `<span class="text-green-600 font-bold">Copiado!</span>`;
        setTimeout(() => copyLinkBtn.innerHTML = originalText, 2000);
    }
}

function openModal(item = null) {
    DOM.modal.classList.remove('hidden');
    DOM.saveBtn.disabled = false;
    DOM.saveBtn.textContent = item ? "Salvar Alterações" : "Criar Produto";
    
    if(DOM.uploadLoader) DOM.uploadLoader.classList.add('hidden');

    if (item) {
        DOM.itemId.value = item.id;
        DOM.title.value = item.title;
        DOM.category.value = item.category;
        DOM.price.value = item.price;
        DOM.description.value = item.description;
        tempImageUrl = item.imageUrl;
        
        if(DOM.imagePreview) {
            DOM.imagePreview.src = item.imageUrl;
            DOM.imagePreview.classList.remove('hidden');
        }
        if(DOM.imagePlaceholder) DOM.imagePlaceholder.classList.add('hidden');
    } else {
        DOM.form.reset();
        DOM.itemId.value = "";
        tempImageUrl = "";
        if(DOM.imagePreview) DOM.imagePreview.classList.add('hidden');
        if(DOM.imagePlaceholder) DOM.imagePlaceholder.classList.remove('hidden');
    }
}

function closeModal() {
    DOM.modal.classList.add('hidden');
}

async function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        if(DOM.imagePreview) {
            DOM.imagePreview.src = ev.target.result;
            DOM.imagePreview.classList.remove('hidden');
        }
        if(DOM.imagePlaceholder) DOM.imagePlaceholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

async function handleSave(e) {
    e.preventDefault();
    const title = DOM.title.value.trim();
    if (!title) return alert("O título é obrigatório.");

    const file = DOM.imageInput.files[0];
    const isEditing = !!DOM.itemId.value;

    if (!isEditing && !file && !tempImageUrl) return alert("Selecione uma imagem.");

    const originalText = DOM.saveBtn.textContent;
    DOM.saveBtn.disabled = true;
    DOM.saveBtn.textContent = "Salvando...";
    if(DOM.uploadLoader) DOM.uploadLoader.classList.remove('hidden');

    try {
        let finalImageUrl = tempImageUrl;
        if (file) finalImageUrl = await uploadCatalogImage(file);

        const itemData = {
            title: title,
            category: DOM.category.value.trim(),
            price: DOM.price.value.trim(),
            description: DOM.description.value.trim(),
            imageUrl: finalImageUrl
        };

        if (isEditing) {
            await updateCatalogItem(DOM.itemId.value, itemData);
        } else {
            await addCatalogItem(itemData);
        }

        closeModal();
        await loadCatalogData(); 

    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        DOM.saveBtn.disabled = false;
        DOM.saveBtn.textContent = originalText;
        if(DOM.uploadLoader) DOM.uploadLoader.classList.add('hidden');
    }
}

async function handleListActions(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action || !id) return;

    if (action === 'deleteItem') {
        if (confirm("Excluir este produto?")) {
            try {
                await deleteCatalogItem(id);
                await loadCatalogData();
            } catch (error) {
                alert("Erro: " + error.message);
            }
        }
    }

    if (action === 'editItem') {
        try {
            const { ensureCatalogModalLoaded } = await import(`../ui/modalHandler.js`);
            await ensureCatalogModalLoaded();
            refreshDOMReferences();
            attachCatalogModalListenersOnce();

            const data = await getCatalogItems(); 
            const item = data.items.find(i => i.id === id);
            if (item) openModal(item);
        } catch (err) {
            console.error(err);
        }
    }
}

async function handleListChanges(e) {
    const toggle = e.target;
    if (toggle.type === 'checkbox' && toggle.dataset.action === 'toggleStatus') {
        const id = toggle.dataset.id;
        const newStatus = toggle.checked;
        try {
            await toggleItemStatus(id, newStatus);
            await loadCatalogData();
        } catch (error) {
            alert("Erro: " + error.message);
            toggle.checked = !newStatus; 
        }
    }
}
