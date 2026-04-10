// js/financialCalculator.js
// ==========================================================
// MÓDULO FINANCEIRO CENTRAL (v1.1.0 - Suporte a Custos Terceirizados)
// Responsabilidade: Centralizar TODA a lógica de cálculo de preços.
// Única fonte de verdade para: Admin, Página Pública e PDFs.
// ==========================================================

export const calculateOrderTotals = (order) => {
    let grossTotal = 0;
    let totalOutsourced = 0; // [NOVO] Acumulador do custo terceirizado total

    // 1. Somatória das Peças
    if (order.parts && Array.isArray(order.parts)) {
        order.parts.forEach(part => {
            
            // A. Peças Padrão (Grades P/M/G...)
            let standardQty = 0;
            if (part.sizes && typeof part.sizes === 'object') {
                Object.values(part.sizes).forEach(sizesObj => {
                    if (sizesObj && typeof sizesObj === 'object') {
                        Object.values(sizesObj).forEach(qty => {
                            standardQty += (parseInt(qty) || 0);
                        });
                    }
                });
            }
            const priceStandard = parseFloat(part.unitPriceStandard) !== undefined 
                ? parseFloat(part.unitPriceStandard) 
                : (parseFloat(part.unitPrice) || 0);
            
            grossTotal += (standardQty * priceStandard);

            // B. Peças Específicas (Sob Medida)
            let specificQty = 0;
            if (part.specifics && Array.isArray(part.specifics)) {
                specificQty = part.specifics.length;
            }
            const priceSpecific = parseFloat(part.unitPriceSpecific) !== undefined 
                ? parseFloat(part.unitPriceSpecific) 
                : (parseFloat(part.unitPrice) || 0);
            
            grossTotal += (specificQty * priceSpecific);

            // C. Peças Detalhadas (Lista de Nomes)
            let detailedQty = 0;
            if (part.details && Array.isArray(part.details)) {
                detailedQty = part.details.length;
            }
            const priceDetailed = parseFloat(part.unitPrice) || 0;
            grossTotal += (detailedQty * priceDetailed);

            // [NOVO] D. Cálculo de Custos Terceirizados da Peça
            let partUnitOutsourcedCost = 0;
            if (part.outsourcedCosts && Array.isArray(part.outsourcedCosts)) {
                // Soma todos os custos de terceiros vinculados a UMA unidade desta peça
                partUnitOutsourcedCost = part.outsourcedCosts.reduce((acc, cost) => acc + (parseFloat(cost.unitCost) || 0), 0);
            }
            
            // Multiplica o custo terceirizado unitário pela quantidade total desta peça específica
            const partTotalQty = standardQty + specificQty + detailedQty;
            totalOutsourced += (partTotalQty * partUnitOutsourcedCost);
        });
    }

    // 2. Aplicação de Descontos e Pagamentos
    const discount = parseFloat(order.discount) || 0;
    const total = grossTotal - discount; 
    const paid = parseFloat(order.downPayment) || 0;
    
    // 3. Resultado Final
    const remaining = total - paid;

    return {
        grossTotal: grossTotal, 
        discount: discount,     
        total: total,           
        paid: paid,             
        remaining: remaining,
        totalOutsourced: totalOutsourced // [NOVO] Retornado para o Raio-X e Dashboards
    };
};
