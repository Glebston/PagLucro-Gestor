// js/listeners/settingsLogic.js
// ========================================================
// LÓGICA DE CONFIGURAÇÕES & UPLOAD (v2.0 - RBAC & Flow SaaS)
// Responsabilidade: Gerenciar modal, Uploads, Salvar dados e Etapas
// ========================================================

import { getCompanySettings, saveCompanySettings } from "../services/settingsService.js";
import { auth, secondaryAuth } from "../firebaseConfig.js"; 
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { fileToBase64, uploadToImgBB } from "../services/imageService.js";

let DOM = {};
let currentProductionStages = [];
let listenersAttached = false;

// 1. RECONEXÃO DINÂMICA DO DOM (Motor Lazy Load)
const refreshDOMReferences = () => {
    DOM = {
        modal: document.getElementById('settingsModal'), 
        logoInput: document.getElementById('logoInput'),
        idealDailyCapacity: document.getElementById('idealDailyCapacity'), // NOVO: RADAR
        logoPreview: document.getElementById('logoPreview'),
        logoPlaceholder: document.getElementById('logoPlaceholder'),
        uploadLoader: document.getElementById('uploadLoader'),
        uploadStatus: document.getElementById('uploadStatus'),
        logoUrlHidden: document.getElementById('logoUrl'), 
        pixKey: document.getElementById('pixKey'),
        pixBeneficiary: document.getElementById('pixBeneficiary'),
        entryPercent: document.getElementById('entryPercent'),
        whatsapp: document.getElementById('whatsapp'),
        productionEmail: document.getElementById('productionEmail'),
        newStageInput: document.getElementById('newStageInput'),
        addStageBtn: document.getElementById('addStageBtn'),
        productionStagesList: document.getElementById('productionStagesList'),
        saveBtn: document.getElementById('saveSettingsBtn'),
        closeBtn: document.getElementById('closeSettingsModalBtn'),
        cancelBtn: document.getElementById('cancelSettingsBtn')
    };
};

const renderProductionStages = () => {
    if (!DOM.productionStagesList) return;
    DOM.productionStagesList.innerHTML = '';
    
    if (currentProductionStages.length === 0) {
        DOM.productionStagesList.innerHTML = '<div class="text-center py-4 text-xs text-emerald-600 italic">Nenhuma etapa configurada no fluxo.</div>';
        return;
    }

    currentProductionStages.forEach((stage, index) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between bg-white border border-emerald-100 rounded p-2 shadow-sm mb-2 transition-all';
        
        const controlsHtml = `
            <div class="flex flex-col gap-1 mr-3 bg-gray-50 rounded px-1 border border-gray-100">
                <button type="button" class="move-up-btn text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-gray-400 p-0 leading-none text-xs" data-index="${index}" ${index === 0 ? 'disabled' : ''}>▲</button>
                <button type="button" class="move-down-btn text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-gray-400 p-0 leading-none text-xs" data-index="${index}" ${index === currentProductionStages.length - 1 ? 'disabled' : ''}>▼</button>
            </div>
        `;

        item.innerHTML = `
            <div class="flex items-center flex-1">
                ${controlsHtml}
                <span class="font-semibold text-sm text-gray-700">${stage}</span>
            </div>
            <button type="button" class="delete-stage-btn text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition" data-index="${index}" title="Excluir Etapa">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        DOM.productionStagesList.appendChild(item);
    });

    document.querySelectorAll('.move-up-btn').forEach(btn => btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        if (idx > 0) {
            [currentProductionStages[idx - 1], currentProductionStages[idx]] = [currentProductionStages[idx], currentProductionStages[idx - 1]];
            renderProductionStages();
        }
    }));

    document.querySelectorAll('.move-down-btn').forEach(btn => btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        if (idx < currentProductionStages.length - 1) {
            [currentProductionStages[idx], currentProductionStages[idx + 1]] = [currentProductionStages[idx + 1], currentProductionStages[idx]];
            renderProductionStages();
        }
    }));

    document.querySelectorAll('.delete-stage-btn').forEach(btn => btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const stageName = currentProductionStages[idx];
        if (confirm(`Excluir a etapa "${stageName}"?\nCertifique-se de que não há pedidos parados nesta coluna da fábrica antes de salvar.`)) {
            currentProductionStages.splice(idx, 1);
            renderProductionStages();
        }
    }));
};

// 2. BLINDAGEM DE LISTENERS (Anexa eventos apenas 1 vez)
const attachSettingsListenersOnce = () => {
    if (listenersAttached) return;

    if (DOM.addStageBtn && DOM.newStageInput) {
        DOM.addStageBtn.addEventListener('click', () => {
            const newStage = DOM.newStageInput.value.trim();
            if (newStage) {
                const exists = currentProductionStages.some(s => s.toLowerCase() === newStage.toLowerCase());
                if (exists) {
                    alert("Esta etapa já existe no fluxo!");
                    return;
                }
                currentProductionStages.push(newStage);
                DOM.newStageInput.value = '';
                renderProductionStages();
                setTimeout(() => DOM.productionStagesList.scrollTop = DOM.productionStagesList.scrollHeight, 50);
            }
        });

        DOM.newStageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                DOM.addStageBtn.click();
            }
        });
    }

    if (DOM.logoInput) {
        DOM.logoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                if(DOM.logoPreview) {
                    DOM.logoPreview.src = ev.target.result;
                    DOM.logoPreview.classList.remove('hidden');
                }
                if(DOM.logoPlaceholder) DOM.logoPlaceholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);

            try {
                if(DOM.uploadLoader) DOM.uploadLoader.classList.remove('hidden');
                if(DOM.uploadStatus) {
                    DOM.uploadStatus.textContent = "Enviando imagem...";
                    DOM.uploadStatus.className = "text-[10px] text-blue-600 font-bold mt-1 h-3";
                }
                if(DOM.saveBtn) DOM.saveBtn.disabled = true; 

                const base64 = await fileToBase64(file);
                const imageUrl = await uploadToImgBB(base64);

                if (imageUrl) {
                    if(DOM.logoUrlHidden) DOM.logoUrlHidden.value = imageUrl; 
                    if(DOM.uploadStatus) {
                        DOM.uploadStatus.textContent = "Imagem carregada com sucesso!";
                        DOM.uploadStatus.className = "text-[10px] text-green-600 font-bold mt-1 h-3";
                    }
                } else {
                    throw new Error("O serviço não retornou uma URL válida.");
                }

            } catch (error) {
                console.error(error);
                if(DOM.uploadStatus) {
                    DOM.uploadStatus.textContent = "Erro ao enviar: " + error.message;
                    DOM.uploadStatus.className = "text-[10px] text-red-600 font-bold mt-1 h-3";
                }
                if(DOM.logoUrlHidden) DOM.logoUrlHidden.value = ""; 
            } finally {
                if(DOM.uploadLoader) DOM.uploadLoader.classList.add('hidden');
                if(DOM.saveBtn) DOM.saveBtn.disabled = false; 
            }
        });
    }

    if (DOM.saveBtn) {
        DOM.saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const user = auth.currentUser;
            if (!user) return;

            const originalText = DOM.saveBtn.innerHTML;
            DOM.saveBtn.textContent = "Salvando...";
            DOM.saveBtn.disabled = true;

            // Busca o input do radar diretamente no momento de salvar (À prova de falhas)
        const radarInput = document.getElementById('idealDailyCapacity');
        const capacityValue = (radarInput && radarInput.value) ? radarInput.value : "10";

        const settingsData = {
            pixKey: DOM.pixKey ? DOM.pixKey.value : "",
            pixBeneficiary: DOM.pixBeneficiary ? DOM.pixBeneficiary.value : "",
            entryPercent: DOM.entryPercent ? DOM.entryPercent.value : "50",
            whatsapp: DOM.whatsapp ? DOM.whatsapp.value : "",
            logoUrl: DOM.logoUrlHidden ? DOM.logoUrlHidden.value : "",
            etapas_producao: currentProductionStages,
            idealDailyCapacity: capacityValue // Salva no Firebase
        };

        // Salva no cache do navegador para o Radar não precisar ler do banco
        localStorage.setItem('idealDailyCapacity', capacityValue);

            const companyId = (DOM.modal && DOM.modal.dataset.companyId) || user.uid;

            let emailInput = "";
            if (DOM.productionEmail) {
                emailInput = DOM.productionEmail.value.trim().toLowerCase();
                if (emailInput !== "") {
                    settingsData.team = {
                        [emailInput]: {
                            role: 'production',
                            addedAt: new Date().toISOString().split('T')[0],
                            active: true
                        }
                    };
                } else {
                    settingsData.team = {}; 
                }
            }

            try {
                await saveCompanySettings(companyId, settingsData);
            } catch (error) {
                alert("Erro ao salvar dados: " + error.message);
                DOM.saveBtn.innerHTML = originalText;
                DOM.saveBtn.disabled = false;
                return; 
            }

            if (emailInput !== "") {
                DOM.saveBtn.textContent = "Verificando acesso...";
                try {
                    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailInput, "123456");
                    await updateProfile(userCredential.user, { displayName: companyId });
                    console.log("✅ Conta de produção criada no Auth!");
                } catch (authError) {
                    console.warn("⚠️ Bypass ativado: O e-mail já existe, mas o banco já foi atualizado com sucesso no passo 1.");
                }
            }
            
            DOM.saveBtn.textContent = "Salvo!";
            setTimeout(() => {
                if(DOM.modal) DOM.modal.classList.add('hidden');
                DOM.saveBtn.disabled = false;
                window.location.reload(); 
            }, 800);
        });
    }

    if (DOM.closeBtn) DOM.closeBtn.addEventListener('click', () => DOM.modal.classList.add('hidden'));
    if (DOM.cancelBtn) DOM.cancelBtn.addEventListener('click', () => DOM.modal.classList.add('hidden'));

    listenersAttached = true;
};

// 3. ABRIR E CARREGAR DADOS (Agora seguro para o Lazy Load)
export async function openSettingsModal() {
    refreshDOMReferences(); // Busca os elementos novos no HTML recém-injetado
    attachSettingsListenersOnce(); // Prende os cliques (sem duplicar)

    const user = auth.currentUser;
    if (!user) return;

    if(DOM.saveBtn) {
        DOM.saveBtn.innerHTML = `Salvar Alterações`;
        DOM.saveBtn.disabled = false;
    }
    if(DOM.uploadStatus) DOM.uploadStatus.textContent = "";
    
    const companyId = (DOM.modal && DOM.modal.dataset.companyId) || user.uid;

    try {
        const data = await getCompanySettings(companyId);
        
        if (data) {
            if(DOM.pixKey) DOM.pixKey.value = data.pixKey || "";
            if(DOM.pixBeneficiary) DOM.pixBeneficiary.value = data.pixBeneficiary || "";
            if(DOM.entryPercent) DOM.entryPercent.value = data.entryPercent || "50";
            if(DOM.whatsapp) DOM.whatsapp.value = data.whatsapp || "";
            
            // Injeta o dado no input do radar caçando-o diretamente
            const radarInput = document.getElementById('idealDailyCapacity');
            if (radarInput) radarInput.value = data.idealDailyCapacity || "10";
            localStorage.setItem('idealDailyCapacity', data.idealDailyCapacity || "10");
            
            if (DOM.productionEmail) {
                DOM.productionEmail.value = ""; 
                if (data.team) {
                    const prodEmail = Object.keys(data.team).find(email => data.team[email].role === 'production');
                    if (prodEmail) DOM.productionEmail.value = prodEmail;
                }
            }
            
            if (data.logoUrl) {
                if(DOM.logoUrlHidden) DOM.logoUrlHidden.value = data.logoUrl;
                if(DOM.logoPreview) {
                    DOM.logoPreview.src = data.logoUrl;
                    DOM.logoPreview.classList.remove('hidden');
                }
                if(DOM.logoPlaceholder) DOM.logoPlaceholder.classList.add('hidden');
            } else {
                if(DOM.logoPreview) {
                    DOM.logoPreview.src = "";
                    DOM.logoPreview.classList.add('hidden');
                }
                if(DOM.logoPlaceholder) DOM.logoPlaceholder.classList.remove('hidden');
            }

            if (data.etapas_producao && Array.isArray(data.etapas_producao)) {
                currentProductionStages = [...data.etapas_producao];
            } else {
                currentProductionStages = ["Corte", "Estampa/Bordado", "Sublimação", "Costura", "Terceirizado", "Revisão", "Embalagem", "Finalizado"];
            }
            renderProductionStages();
        }
    } catch (error) {
        console.error("Erro ao carregar configs:", error);
    }
}
