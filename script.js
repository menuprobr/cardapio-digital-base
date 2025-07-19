/*
=================================================================
==           ARQUIVO PRINCIPAL DE SCRIPT (UNIFICADO)           ==
==                                                             ==
== Este arquivo contém TODO o código de funcionalidade do      ==
== cardápio. Ele está dividido em blocos para facilitar a      ==
== leitura e a manutenção.                                     ==
=================================================================
*/


/*
=================================================================
==      BLOCO 1: CONFIGURAÇÕES PRINCIPAIS DO PROJETO           ==
==                                                             ==
==    ATENÇÃO: Este é o local mais importante para editar.     ==
==    Cole aqui os links da sua planilha do Google Sheets      ==
==    publicada como CSV. Cada link corresponde a uma aba      ==
==    da sua planilha.                                         ==
=================================================================
*/

const SHEET_CONFIG_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlDQsL1sExsPDYbAmFgljevXrfZlYYemjlV1lWHEJRHzTFEmUat4P3sh5WU621VsGvLCSftvwHCu1r/pub?gid=0&single=true&output=csv';
const SHEET_MENU_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlDQsL1sExsPDYbAmFgljevXrfZlYYemjlV1lWHEJRHzTFEmUat4P3sh5WU621VsGvLCSftvwHCu1r/pub?gid=1455705413&single=true&output=csv';
const SHEET_EXTRAS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlDQsL1sExsPDYbAmFgljevXrfZlYYemjlV1lWHEJRHzTFEmUat4P3sh5WU621VsGvLCSftvwHCu1r/pub?gid=1860047161&single=true&output=csv';
const SHEET_COUPONS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlDQsL1sExsPDYbAmFgljevXrfZlYYemjlV1lWHEJRHzTFEmUat4P3sh5WU621VsGvLCSftvwHCu1r/pub?gid=135311346&single=true&output=csv';
const SHEET_TAXAS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlDQsL1sExsPDYbAmFgljevXrfZlYYemjlV1lWHEJRHzTFEmUat4P3sh5WU621VsGvLCSftvwHCu1r/pub?gid=1421593979&single=true&output=csv';
const SHEET_BANNERS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlDQsL1sExsPDYbAmFgljevXrfZlYYemjlV1lWHEJRHzTFEmUat4P3sh5WU621VsGvLCSftvwHCu1r/pub?gid=1253680415&single=true&output=csv';


/*
=================================================================
==       BLOCO 2: FUNÇÕES UTILITÁRIAS (HELPERS)                ==
=================================================================
*/

function parsePrice(priceString) {
    if (!priceString) return 0;
    return parseFloat(String(priceString).replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
}

function getEffectivePrice(item) {
    const price = parsePrice(item.VALOR);
    const promoPrice = parsePrice(item.PROMO);
    return (promoPrice > 0 && promoPrice < price) ? promoPrice : price;
}

function formatCurrency(value) {
    if (isNaN(value)) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function shuffleArray(array) {
    let newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function formatPhoneNumber(phone) {
    if (!phone) return '';
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{1})(\d{4})(\d{4})$/);
    if (match) {
        return `(${match[1]}) ${match[2]} ${match[3]}-${match[4]}`;
    }
    return phone;
}

function formatCurrencyInput(event) {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    if (value === '') {
        input.value = '';
        return;
    }
    const numberValue = parseFloat(value) / 100;
    input.value = formatCurrency(numberValue);
}


/*
=================================================================
==   BLOCO 3: COMUNICAÇÃO COM GOOGLE SHEETS (API)              ==
=================================================================
*/

async function fetchData(url) {
    if (!url || url.includes('COLE_A_URL')) return null;
    try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
        return await response.text();
    } catch (error) {
        console.error(`Falha ao buscar dados de ${url}:`, error);
        alert('Não foi possível carregar os dados. Verifique sua conexão e os links da planilha.');
        return null;
    }
}

function parseCSV(text) {
    if (!text) return [];
    const lines = text.trim().split(/\r?\n/);
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const headers = lines[0].split(regex).map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        const values = lines[i].split(regex).map(field => field.trim().replace(/^"(.+(?="$))"$/, '$1'));
        if (values.length > 0 && values[0]) {
            let obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index];
            });
            data.push(obj);
        }
    }
    return data;
}


/*
=================================================================
==           BLOCO 4: LÓGICA DO CHECKOUT                       ==
=================================================================
*/

let appliedCoupon = null;
let currentCartForCheckout = [];
let currentConfigForCheckout = {};
let currentDeliveryFeesForCheckout = [];
let currentCouponsForCheckout = [];

function openCheckoutModal(cart, configData, deliveryFees, coupons, isStoreOpen) {
    const checkoutModal = document.getElementById('checkout-modal');
    if (!isStoreOpen) {
        alert('Desculpe, estamos fechados para pedidos no momento.');
        return;
    }
    if (cart.length === 0) return;

    currentCartForCheckout = cart;
    currentConfigForCheckout = configData;
    currentDeliveryFeesForCheckout = deliveryFees;
    currentCouponsForCheckout = coupons;
    appliedCoupon = null;

    document.getElementById('coupon-input').value = '';
    document.getElementById('coupon-feedback').textContent = '';
    document.getElementById('cart-sidebar').classList.remove('open');

    setupCheckoutOptions();
    updateCheckoutSummary();

    checkoutModal.classList.remove('is-closing');
    checkoutModal.classList.add('is-visible', 'is-opening');
    setTimeout(() => checkoutModal.classList.remove('is-opening'), 300);
}

function closeCheckoutModal() {
    const checkoutModal = document.getElementById('checkout-modal');
    if (!checkoutModal.classList.contains('is-visible')) return;
    checkoutModal.classList.add('is-closing');
    setTimeout(() => {
        checkoutModal.classList.remove('is-visible', 'is-closing');
    }, 300);
}

function setupCheckoutOptions() {
    const deliveryContainer = document.getElementById('delivery-options-container');
    deliveryContainer.innerHTML = '<h4>1. Como você quer receber?</h4>';
    
    if (currentConfigForCheckout.entrega_retirada?.toUpperCase() === 'SIM') {
        deliveryContainer.innerHTML += `<div class="radio-option"><input type="radio" id="retirada" name="delivery_type" value="Retirada" onchange="updateCheckoutView()" checked><label for="retirada">Retirada no local</label></div>`;
    }
    if (currentConfigForCheckout.entrega_delivery?.toUpperCase() === 'SIM') {
        deliveryContainer.innerHTML += `<div class="radio-option"><input type="radio" id="delivery" name="delivery_type" value="Delivery" onchange="updateCheckoutView()"><label for="delivery">Delivery (Entrega)</label></div>`;
    }
    if (currentConfigForCheckout.pedido_mesa?.toUpperCase() === 'SIM') {
        deliveryContainer.innerHTML += `<div class="radio-option"><input type="radio" id="mesa" name="delivery_type" value="Mesa" onchange="updateCheckoutView()"><label for="mesa">Pedido na Mesa</label></div>`;
    }

    const neighborhoodSelect = document.getElementById('customer-neighborhood');
    neighborhoodSelect.innerHTML = '<option value="">Selecione seu bairro...</option>';
    currentDeliveryFeesForCheckout.forEach(fee => {
        const option = document.createElement('option');
        option.value = fee.BAIRRO;
        option.textContent = `${fee.BAIRRO} - ${formatCurrency(parsePrice(fee.VALOR))}`;
        neighborhoodSelect.appendChild(option);
    });

    const paymentContainer = document.getElementById('payment-options-container');
    paymentContainer.innerHTML = '<h4>4. Forma de Pagamento</h4>';
    if (currentConfigForCheckout.forma_pagamento_dinheiro?.toUpperCase() === 'SIM') paymentContainer.innerHTML += `<div class="radio-option"><input type="radio" id="dinheiro" name="payment_method" value="Dinheiro"><label for="dinheiro">Dinheiro</label></div>`;
    if (currentConfigForCheckout.forma_pagamento_pix?.toUpperCase() === 'SIM') paymentContainer.innerHTML += `<div class="radio-option"><input type="radio" id="pix" name="payment_method" value="PIX"><label for="pix">PIX</label></div>`;
    if (currentConfigForCheckout.forma_pagamento_cartao?.toUpperCase() === 'SIM') paymentContainer.innerHTML += `<div class="radio-option"><input type="radio" id="cartao" name="payment_method" value="Cartão"><label for="cartao">Cartão</label></div>`;
    
    paymentContainer.querySelectorAll('input[name="payment_method"]').forEach(radio => {
        radio.addEventListener('change', updateCheckoutView);
    });

    document.getElementById('pix-key-display').textContent = currentConfigForCheckout.pix_estabelecimento || '';
    document.getElementById('pix-info-display').textContent = currentConfigForCheckout.informacao_pix || '';

    updateCheckoutView();
}

function updateCheckoutView() {
    const deliveryTypeInput = document.querySelector('input[name="delivery_type"]:checked');
    const paymentMethodInput = document.querySelector('input[name="payment_method"]:checked');
    const type = deliveryTypeInput ? deliveryTypeInput.value : 'Retirada';

    const isCash = paymentMethodInput && paymentMethodInput.value === 'Dinheiro';
    const isPix = paymentMethodInput && paymentMethodInput.value === 'PIX';

    const whatsappContainer = document.getElementById('whatsapp-container');
    const mesaContainer = document.getElementById('mesa-container');
    const addressContainer = document.getElementById('address-container');
    const paymentContainer = document.getElementById('payment-options-container');
    const changeContainer = document.getElementById('change-container');
    const pixContainer = document.getElementById('pix-details-container');
    const couponContainer = document.getElementById('coupon-container');
    const summaryDiscountRow = document.getElementById('summary-discount-row');
    const summaryDeliveryRow = document.getElementById('summary-delivery-row');

    whatsappContainer.style.display = 'none';
    mesaContainer.style.display = 'none';
    addressContainer.style.display = 'none';
    paymentContainer.style.display = 'none';
    changeContainer.style.display = 'none';
    pixContainer.style.display = 'none';
    couponContainer.style.display = 'none';
    summaryDeliveryRow.style.display = 'none';
    summaryDiscountRow.style.display = 'none';

    if (type === 'Mesa') {
        mesaContainer.style.display = 'block';
    } else {
        whatsappContainer.style.display = 'block';
        paymentContainer.style.display = 'block';
        couponContainer.style.display = 'block';
        
        if (appliedCoupon) {
            summaryDiscountRow.style.display = 'flex';
        }

        if (type === 'Delivery') {
            addressContainer.style.display = 'block';
            summaryDeliveryRow.style.display = 'flex';
        }
        
        changeContainer.style.display = isCash ? 'block' : 'none';
        pixContainer.style.display = isPix && currentConfigForCheckout.pix_estabelecimento ? 'block' : 'none';
    }
    
    updateCheckoutSummary();
}

function applyCoupon() {
    const couponInput = document.getElementById('coupon-input');
    const feedbackEl = document.getElementById('coupon-feedback');
    const couponCode = couponInput.value.trim().toUpperCase();

    if (!couponCode) {
        appliedCoupon = null;
        updateCheckoutSummary();
        feedbackEl.textContent = '';
        return;
    }

    const foundCoupon = currentCouponsForCheckout.find(c => c.CUPON.toUpperCase() === couponCode && c.STATUS.toUpperCase() === 'ATIVO');
    if (foundCoupon) {
        appliedCoupon = foundCoupon;
        feedbackEl.textContent = `Cupom "${foundCoupon.CUPON}" aplicado!`;
        feedbackEl.className = 'coupon-feedback success';
    } else {
        appliedCoupon = null;
        feedbackEl.textContent = 'Cupom inválido ou expirado.';
        feedbackEl.className = 'coupon-feedback error';
    }
    updateCheckoutSummary();
    updateCheckoutView();
}

function getCartSubtotal() {
    return currentCartForCheckout.reduce((acc, item) => {
        const addonsTotal = item.addons.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
        const basePriceTotal = item.basePrice * item.quantity;
        return acc + basePriceTotal + addonsTotal;
    }, 0);
}

function updateCheckoutSummary() {
    const subtotal = getCartSubtotal();
    let discount = 0;
    let deliveryFee = 0;

    if (appliedCoupon) {
        const couponValue = parsePrice(appliedCoupon.VALOR);
        if (appliedCoupon.TIPO.toUpperCase() === 'PERCENTUAL') {
            discount = subtotal * (couponValue / 100);
        } else {
            discount = couponValue;
        }
    }

    const deliveryTypeInput = document.querySelector('input[name="delivery_type"]:checked');
    if (deliveryTypeInput && deliveryTypeInput.value === 'Delivery') {
        const selectedBairro = document.getElementById('customer-neighborhood').value;
        const feeInfo = currentDeliveryFeesForCheckout.find(f => f.BAIRRO === selectedBairro);
        if (feeInfo) deliveryFee = parsePrice(feeInfo.VALOR);
    }

    let total = subtotal - discount + deliveryFee;
    if (total < 0) total = 0;

    document.getElementById('summary-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('summary-delivery-fee').textContent = formatCurrency(deliveryFee);
    document.getElementById('summary-discount').textContent = `- ${formatCurrency(discount)}`;
    document.getElementById('summary-total').textContent = formatCurrency(total);
}

function finalizeOrder() {
    const deliveryTypeInput = document.querySelector('input[name="delivery_type"]:checked');
    if (!deliveryTypeInput) {
        alert("Por favor, selecione como você quer receber o pedido.");
        return;
    }
    const orderType = deliveryTypeInput.value;
    const name = document.getElementById('customer-name').value.trim();
    if (!name) {
        alert("Por favor, preencha seu nome.");
        return;
    }

    let message = '';
    let whatsappNumber = '';
    const subtotal = getCartSubtotal();
    const itemsMessage = currentCartForCheckout.map(item => {
        let itemText = `*${item.quantity}x ${item.name}* (${formatCurrency(item.basePrice)})`;
        if (item.addons.length > 0) {
            itemText += item.addons.map(addon => `\n  + _${addon.quantity}x ${addon.name}_ (${formatCurrency(addon.price)})`).join('');
        }
        if (item.observation) {
            itemText += `\n  Obs: _${item.observation}_`;
        }
        return itemText;
    }).join('\n\n');

    if (orderType === 'Mesa') {
        const tableNumber = document.getElementById('customer-mesa-number').value.trim();
        if (!tableNumber) {
            alert("Por favor, informe o número da mesa.");
            return;
        }
        
        whatsappNumber = currentConfigForCheckout.whatsapp_pedido_mesa || currentConfigForCheckout.whatsapp_negocio;
        message = `*🚨 NOVO PEDIDO NA MESA 🚨*\n- - - - - - - - - - - - - - - -\n`;
        message += `*Cliente:* ${name}\n*Mesa:* *${tableNumber}*\n- - - - - - - - - - - - - - - -\n`;
        message += `*📝 ITENS DO PEDIDO*\n\n${itemsMessage}\n\n`;
        message += `- - - - - - - - - - - - - - - -\n*Total do Pedido:* *${formatCurrency(subtotal)}*`;

    } else {
        const whatsapp = document.getElementById('customer-whatsapp').value.trim();
        const paymentMethodInput = document.querySelector('input[name="payment_method"]:checked');

        if (!paymentMethodInput) {
            alert("Por favor, selecione a forma de pagamento.");
            return;
        }

        let discount = 0;
        if (appliedCoupon) {
            const couponValue = parsePrice(appliedCoupon.VALOR);
            discount = (appliedCoupon.TIPO.toUpperCase() === 'PERCENTUAL') ? subtotal * (couponValue / 100) : couponValue;
        }

        let deliveryFee = 0;
        let address = '', reference = '', neighborhood = '';
        if (orderType === 'Delivery') {
            neighborhood = document.getElementById('customer-neighborhood').value;
            const street = document.getElementById('customer-street-address').value.trim();
            if (!neighborhood || !street) { alert("Por favor, preencha seu bairro e endereço."); return; }
            address = `${street}, ${neighborhood}`;
            reference = document.getElementById('customer-reference').value.trim();
            const feeInfo = currentDeliveryFeesForCheckout.find(f => f.BAIRRO === neighborhood);
            if (feeInfo) deliveryFee = parsePrice(feeInfo.VALOR);
        }
        
        const finalTotal = subtotal - discount + deliveryFee > 0 ? subtotal - discount + deliveryFee : 0;
        
        whatsappNumber = currentConfigForCheckout.whatsapp_negocio;
        message = `Olá, *${currentConfigForCheckout.nome_negocio}*! Você recebeu um novo pedido:\n- - - - - - - - - - - - - - - -\n`;
        message += `*🚨 NOVO PEDIDO 🚨*\n- - - - - - - - - - - - - - - -\n`;
        message += `*👤 DADOS DO CLIENTE*\n*Nome:* ${name}\n*WhatsApp:* ${whatsapp}\n- - - - - - - - - - - - - - - -\n`;
        message += `*📝 ITENS DO PEDIDO*\n\n${itemsMessage}\n\n`;
        message += `- - - - - - - - - - - - - - - -\n*💰 VALORES*\n*Subtotal:* ${formatCurrency(subtotal)}\n`;
        if(discount > 0) message += `*Desconto (${appliedCoupon.CUPON}):* -${formatCurrency(discount)}\n`;
        if(orderType === 'Delivery') message += `*Taxa de Entrega (${neighborhood}):* ${formatCurrency(deliveryFee)}\n`;
        message += `*Total a Pagar:* *${formatCurrency(finalTotal)}*\n- - - - - - - - - - - - - - - -\n`;
        message += `*🚚 ENTREGA*\n*Método:* ${orderType}\n`;
        if (orderType === 'Delivery') {
            message += `*Endereço:* ${address}\n`;
            if(reference) message += `*Referência:* ${reference}\n`;
        }
        message += `- - - - - - - - - - - - - - - -\n*💳 PAGAMENTO*\n*Forma:* ${paymentMethodInput.value}\n`;
        if (paymentMethodInput.value === 'Dinheiro') {
            const changeNeeded = !document.getElementById('no-change-needed').checked;
            const changeAmount = document.getElementById('change-for-amount').value;
            message += changeNeeded && changeAmount ? `*Troco para:* ${changeAmount}\n` : `*Não precisa de troco.*\n`;
        }
        message += `- - - - - - - - - - - - - - - -\n_Aguardando confirmação do pedido._`;
    }

    if (!whatsappNumber) {
        alert("O número de WhatsApp para receber o pedido não está configurado.");
        return;
    }

    const whatsappURL = `https://wa.me/55${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappURL, '_blank');
    
    closeCheckoutModal();
    resetAppAfterOrder();
    openSuccessModal();
}

function openSuccessModal() {
    const successModal = document.getElementById('order-success-modal');
    successModal.classList.remove('is-closing');
    successModal.classList.add('is-visible', 'is-opening');
    setTimeout(() => successModal.classList.remove('is-opening'), 300);
}

function closeSuccessModal() {
    const successModal = document.getElementById('order-success-modal');
    if (!successModal.classList.contains('is-visible')) return;
    successModal.classList.add('is-closing');
    setTimeout(() => {
        successModal.classList.remove('is-visible', 'is-closing');
    }, 300);
}

function resetAppAfterOrder() {
    cart = [];
    updateCart(); 
}


/*
=================================================================
==           BLOCO 5: LÓGICA DO CARRINHO E FAVORITOS           ==
=================================================================
*/

let cart = [];
let favoriteItems = [];

function saveCart() {
    localStorage.setItem('meuCarrinho', JSON.stringify(cart));
}

function loadCart() {
    const savedCart = localStorage.getItem('meuCarrinho');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

function saveFavorites() {
    localStorage.setItem('meusFavoritos', JSON.stringify(favoriteItems));
}

function loadFavorites() {
    const savedFavorites = localStorage.getItem('meusFavoritos');
    if (savedFavorites) {
        favoriteItems = JSON.parse(savedFavorites);
    }
}

function addToCart(item, quantity, selectedAddons, observation) {
    const addonNames = selectedAddons.map(a => `${a.quantity}x${a.name}`).sort().join('_');
    const cartItemId = `${item.NOME}_${addonNames}_${observation}`;
    const existingItemIndex = cart.findIndex(cartItem => cartItem.id === cartItemId);

    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity += quantity;
    } else {
        cart.push({
            id: cartItemId,
            name: item.NOME,
            basePrice: item.effectivePrice,
            addons: selectedAddons,
            image: item.IMAGEM,
            quantity: quantity,
            observation: observation
        });
    }
    updateCart();
}

function updateCartItemQuantity(index, change) {
    if (!cart[index]) return;
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    updateCart();
    if (document.getElementById('checkout-modal').classList.contains('is-visible')) {
        currentCartForCheckout = cart;
        updateCheckoutSummary();
    }
}

function removeCartItem(index) {
    if (!cart[index]) return;
    if (confirm(`Deseja remover "${cart[index].name}" do carrinho?`)) {
        cart.splice(index, 1);
        updateCart();
        if (document.getElementById('checkout-modal').classList.contains('is-visible')) {
            currentCartForCheckout = cart;
            updateCheckoutSummary();
        }
    }
}

function clearCart() {
    if (cart.length > 0 && confirm('Tem certeza que deseja esvaziar o carrinho?')) {
        cart = [];
        updateCart();
    }
}

function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('open');
}

function updateCart() {
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalPriceEl = document.getElementById('cart-total-price');
    const cartCounterElements = document.querySelectorAll('.cart-counter-span');
    const checkoutBtn = document.getElementById('checkout-btn');

    cartItemsContainer.innerHTML = '';
    let total = 0;
    let itemCount = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p>Seu carrinho está vazio.</p>';
    } else {
        cart.forEach((item, index) => {
            const addonsTotal = item.addons.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
            const basePriceTotal = item.basePrice * item.quantity;
            const subtotal = basePriceTotal + addonsTotal;
            total += subtotal;
            itemCount += item.quantity;

            let addonsHTML = item.addons.length > 0 ? `<ul class="cart-item-addons">${item.addons.map(addon => `<li class="cart-item-addon-entry"><span>+ ${addon.quantity}x ${addon.name}</span> <span>${formatCurrency(addon.price * addon.quantity)}</span></li>`).join('')}</ul>` : '';
            let observationHTML = item.observation ? `<p class="cart-item-obs">Obs: ${item.observation}</p>` : '';

            const cartItemEl = document.createElement('div');
            cartItemEl.className = 'cart-item';
            cartItemEl.innerHTML = `<img src="${item.image}" alt="${item.name}"><div class="cart-item-details"><div class="cart-item-info"><div class="cart-item-line"><span class="cart-item-name">${item.name}</span><span class="cart-item-base-price">${formatCurrency(item.basePrice)}</span></div>${addonsHTML}${observationHTML}</div><div class="cart-item-footer"><p class="cart-item-subtotal">Subtotal: <b>${formatCurrency(subtotal)}</b></p><div class="cart-item-actions"><button class="cart-quantity-btn" data-index="${index}" data-change="-1">-</button><span>${item.quantity}</span><button class="cart-quantity-btn" data-index="${index}" data-change="1">+</button><button class="cart-delete-btn" data-index="${index}" title="Remover item"><i class="fas fa-trash"></i></button></div></div></div>`;
            cartItemsContainer.appendChild(cartItemEl);
        });
    }

    cartTotalPriceEl.textContent = formatCurrency(total);
    cartCounterElements.forEach(el => el.textContent = itemCount);
    checkoutBtn.disabled = cart.length === 0;
    document.getElementById('clear-cart-btn').style.display = cart.length > 0 ? 'block' : 'none';
    
    saveCart();
}

function setupCartEventListeners() {
    const cartItemsContainer = document.getElementById('cart-items-container');
    cartItemsContainer.addEventListener('click', function(event) {
        event.stopPropagation();
        const targetElement = event.target;
        const quantityBtn = targetElement.closest('.cart-quantity-btn');
        const deleteBtn = targetElement.closest('.cart-delete-btn');

        if (quantityBtn) {
            const index = parseInt(quantityBtn.dataset.index);
            const change = parseInt(quantityBtn.dataset.change);
            updateCartItemQuantity(index, change);
        } else if (deleteBtn) {
            const index = parseInt(deleteBtn.dataset.index);
            removeCartItem(index);
        }
    });
}


/*
=================================================================
==       BLOCO 6: LÓGICA DOS MODAIS (DETALHES E POPUP)         ==
=================================================================
*/

let currentItemForModal = null; 

function updateAddonAvailability() {
    if (!currentItemForModal || !currentItemForModal.QTD_EXTRAS) return;

    const maxExtras = parseInt(currentItemForModal.QTD_EXTRAS);
    if (isNaN(maxExtras) || maxExtras <= 0) return;

    const selectedCount = document.querySelectorAll('#item-detail-modal .addon-item.selected').length;
    const allAddonItems = document.querySelectorAll('#item-detail-modal .addon-item');

    if (selectedCount >= maxExtras) {
        allAddonItems.forEach(item => {
            if (!item.classList.contains('selected')) {
                const addBtn = item.querySelector('.add-addon-btn');
                if (addBtn) addBtn.disabled = true;
            }
        });
    } else {
        allAddonItems.forEach(item => {
            const addBtn = item.querySelector('.add-addon-btn');
            if (addBtn) addBtn.disabled = false;
        });
    }
}

function openItemDetailModal(item, extrasData, isStoreOpen) {
    const itemDetailModal = document.getElementById('item-detail-modal');
    const itemDetailContent = document.getElementById('item-detail-content');

    currentItemForModal = item;
    currentItemForModal.effectivePrice = getEffectivePrice(item);

    const isAvailable = item.STATUS?.trim().toUpperCase() === 'ATIVO' || item.STATUS?.trim().toUpperCase() === 'SIM';
    if (!isAvailable) return;

    if (!isStoreOpen) {
        alert('Desculpe, estamos fechados para pedidos no momento.');
        return;
    }
    
    const isFavorited = favoriteItems.includes(item.NOME);
    const originalPrice = parsePrice(item.VALOR);
    const isPromo = currentItemForModal.effectivePrice < originalPrice;
    const isDestaque = item.DSTQ?.toUpperCase() === 'SIM';
    
    const modalTitleText = isDestaque ? `<span class="destaque-title-icon"><i class="fas fa-star"></i></span> ${item.NOME}` : item.NOME;

    let priceDisplayHTML = '';
    if (isPromo) {
        const discountPercentage = Math.round(((originalPrice - currentItemForModal.effectivePrice) / originalPrice) * 100);
        priceDisplayHTML = `<div id="modal-item-price" class="modal-price-display" data-base-price="${currentItemForModal.effectivePrice}">
                              <span class="item-price"><b>${formatCurrency(currentItemForModal.effectivePrice)}</b></span>
                              <span class="original-price">${formatCurrency(originalPrice)}</span>
                              <span class="discount-badge">-${discountPercentage}%</span>
                            </div>`;
    } else {
        priceDisplayHTML = `<div id="modal-item-price" class="modal-price-display" data-base-price="${currentItemForModal.effectivePrice}">
                              <span class="item-price"><b>${formatCurrency(currentItemForModal.effectivePrice)}</b></span>
                            </div>`;
    }

    let addonsHTML = '';
    const extraCategory = item.EXTRAS?.trim();
    if (extraCategory && extrasData && extrasData.length > 0) {
        const relevantExtras = extrasData.filter(extra => extra.CATEGORIA?.trim().toUpperCase() === extraCategory.toUpperCase());
        
        if (relevantExtras.length > 0) {
            const maxExtras = parseInt(item.QTD_EXTRAS);
            let limitMessage = '';
            if (!isNaN(maxExtras) && maxExtras > 0) {
                limitMessage = `<p class="addons-limit-message">Escolha até ${maxExtras} opcionais.</p>`;
            }

            let addonListHTML = relevantExtras.map((addon, index) => {
                const addonPrice = parsePrice(addon.VALOR);
                const addonImageHTML = addon.IMAGEM ? `<img src="${addon.IMAGEM}" alt="${addon.NOME}" class="addon-item-img">` : '';
                return `<div class="addon-item" data-name="${addon.NOME}" data-price="${addonPrice}">
                            ${addonImageHTML}
                            <div class="addon-info">
                                <span class="addon-name">${addon.NOME}</span>
                                <span class="addon-price">+ ${formatCurrency(addonPrice)}</span>
                            </div>
                            <div class="addon-controls">
                                <div class="addon-quantity-control" style="display: none;">
                                    <button class="addon-quantity-btn" data-action="decrease">-</button>
                                    <span class="addon-quantity">1</span>
                                    <button class="addon-quantity-btn" data-action="increase">+</button>
                                </div>
                                <button class="add-addon-btn" data-action="add">Adicionar</button>
                            </div>
                        </div>`;
            }).join('');
            addonsHTML = `<div class="item-detail-addons">${limitMessage}<button type="button" class="addons-toggle-btn" onclick="toggleAddons(this)">ADICIONAR OPCIONAIS?<i class="fas fa-chevron-down"></i></button><div class="addon-list-container" style="display: none;">${addonListHTML}</div></div>`;
        }
    }

    let metaInfoHTML = '';
    if (item.QTD || item.SERVE) {
        metaInfoHTML += '<div class="item-meta-info">';
        if(item.QTD) metaInfoHTML += `<span class="meta-item"><i class="fas fa-box-open"></i> ${item.QTD}</span>`;
        if(item.SERVE) metaInfoHTML += `<span class="meta-item"><i class="fas fa-users"></i> Serve ${item.SERVE}</span>`;
        metaInfoHTML += '</div>';
    }

    let allTagsHTML = item.TAGS ? item.TAGS.split(',').map(tag => {
        const trimmedTag = tag.trim().toUpperCase();
        switch (trimmedTag) {
            case 'MAIS_PEDIDO': return '<div class="special-tag tag-mais-pedido"><i class="fas fa-fire"></i> Mais Pedido</div>';
            case 'BEBIDA_GELADA': return '<div class="special-tag tag-bebida-gelada"><i class="fas fa-snowflake"></i> Bebida Gelada</div>';
            case 'NOVIDADE': return '<div class="special-tag tag-novidade"><i class="fas fa-star"></i> Novidade</div>';
            case 'VEGETARIANO': return '<div class="special-tag tag-vegetariano"><i class="fas fa-leaf"></i> Vegetariano</div>';
            case 'LEVE': return '<div class="special-tag tag-leve"><i class="fas fa-feather-alt"></i> Leve</div>';
            default: return tag.trim() ? `<span class="tag"><i class="fas fa-tag"></i> ${tag.trim()}</span>` : '';
        }
    }).join('') : '';

    let promoBadgeHTML = isPromo ? `<div class="promo-badge"><i class="fas fa-tags"></i> PROMOÇÃO</div>` : '';
    
    const modalHTML = `<button class="modal-back-btn" onclick="closeItemDetailModal()"><i class="fas fa-chevron-left"></i> Voltar</button><button class="modal-close-btn" onclick="closeItemDetailModal()">&times;</button><div class="item-detail-actions"><button class="share-btn" title="Compartilhar" onclick="shareItem('${item.NOME}')"><i class="fas fa-share-alt"></i></button><button class="favorite-btn-modal ${isFavorited ? 'is-favorite' : ''}" data-item-name="${item.NOME}" title="Favoritar" onclick="toggleFavorite(this, '${item.NOME}')"><i class="fas fa-heart"></i></button></div><div class="item-detail-modal-body"><div class="item-detail-img-container"><img src="${item.IMAGEM}" alt="${item.NOME}" class="item-detail-img"></div><div class="item-detail-info"><div class="item-detail-name-wrapper"><h3 class="item-detail-name">${modalTitleText}</h3></div><div class="tags-wrapper">${allTagsHTML}</div><p class="item-detail-description">${item.DESCRICAO || ''}</p>${metaInfoHTML}</div></div>${addonsHTML}<div class="item-detail-footer"><div class="item-detail-price-row"><div class="card-quantity-control"><button onclick="changeModalQuantity(-1)">-</button><span id="modal-quantity">1</span><button onclick="changeModalQuantity(1)">+</button></div>${priceDisplayHTML}</div><div class="item-detail-obs"><label for="modal-observation-input">Observações (Opcional):</label><textarea id="modal-observation-input" rows="3" placeholder="Ex: tirar a cebola, ponto da carne, etc."></textarea></div><button class="btn-primary" onclick="addToCartFromModal(this)">Adicionar ao Carrinho</button></div>`;
    
    itemDetailContent.innerHTML = modalHTML;
    const imgContainer = itemDetailContent.querySelector('.item-detail-img-container');
    if(imgContainer) {
        imgContainer.insertAdjacentHTML('beforeend', promoBadgeHTML);
    }
    
    itemDetailModal.classList.remove('is-closing');
    itemDetailModal.classList.add('is-visible', 'is-opening');
    setTimeout(() => itemDetailModal.classList.remove('is-opening'), 300);

    const addonListContainer = itemDetailContent.querySelector('.addon-list-container');
    if (addonListContainer) {
        addonListContainer.addEventListener('click', handleAddonInteraction);
    }
    updateAddonAvailability();
}

function closeItemDetailModal() {
    const itemDetailModal = document.getElementById('item-detail-modal');
    if (!itemDetailModal.classList.contains('is-visible')) return;
    itemDetailModal.classList.add('is-closing');
    setTimeout(() => {
        itemDetailModal.classList.remove('is-visible', 'is-closing');
        document.getElementById('item-detail-content').innerHTML = '';
        currentItemForModal = null; 
    }, 300);
}

function toggleAddons(button) {
    const container = button.nextElementSibling;
    const icon = button.querySelector('i');
    const isVisible = container.style.display === 'block';
    container.style.display = isVisible ? 'none' : 'block';
    icon.classList.toggle('fa-chevron-up', !isVisible);
    icon.classList.toggle('fa-chevron-down', isVisible);
}

function handleAddonInteraction(event) {
    const button = event.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    const addonItem = button.closest('.addon-item');
    const quantityControl = addonItem.querySelector('.addon-quantity-control');
    const addBtn = addonItem.querySelector('.add-addon-btn');
    const quantitySpan = addonItem.querySelector('.addon-quantity');

    let quantity = parseInt(quantitySpan.textContent);

    if (action === 'add') {
        quantity = 1;
        addBtn.style.display = 'none';
        quantityControl.style.display = 'flex';
        addonItem.classList.add('selected');
    } else if (action === 'increase') {
        quantity++;
    } else if (action === 'decrease') {
        quantity--;
    }

    if (quantity <= 0) {
        quantitySpan.textContent = '1';
        addBtn.style.display = 'flex';
        quantityControl.style.display = 'none';
        addonItem.classList.remove('selected');
    } else {
        quantitySpan.textContent = quantity;
    }

    updateModalPrice();
    updateAddonAvailability();
}

function updateModalPrice() {
    const priceEl = document.getElementById('modal-item-price');
    if (!priceEl || !currentItemForModal) return;

    const quantityEl = document.getElementById('modal-quantity');
    const mainQuantity = quantityEl ? parseInt(quantityEl.textContent) : 1;

    let addonsTotal = 0;
    document.querySelectorAll('.addon-item').forEach(addonEl => {
        if (addonEl.classList.contains('selected')) {
            const price = parseFloat(addonEl.dataset.price);
            const addonQuantity = parseInt(addonEl.querySelector('.addon-quantity').textContent);
            addonsTotal += price * addonQuantity;
        }
    });

    const basePriceTotal = currentItemForModal.effectivePrice * mainQuantity;
    const newPrice = basePriceTotal + addonsTotal;
    
    const priceSpan = priceEl.querySelector('.item-price b');
    if (priceSpan) {
        priceSpan.textContent = formatCurrency(newPrice);
    }
}

function changeModalQuantity(change) {
    const quantityEl = document.getElementById('modal-quantity');
    let quantity = parseInt(quantityEl.textContent) + change;
    if (quantity < 1) quantity = 1;
    quantityEl.textContent = quantity;
    updateModalPrice();
}

function addToCartFromModal(buttonElement) {
    if (!currentItemForModal) return;

    const quantity = parseInt(document.getElementById('modal-quantity').textContent);
    const observation = document.getElementById('modal-observation-input').value.trim();
    const selectedAddons = [];
    
    document.querySelectorAll('.addon-item.selected').forEach(addonEl => {
        selectedAddons.push({
            name: addonEl.dataset.name,
            price: parseFloat(addonEl.dataset.price),
            quantity: parseInt(addonEl.querySelector('.addon-quantity').textContent)
        });
    });

    addToCart(currentItemForModal, quantity, selectedAddons, observation);

    const cartFloatButton = document.getElementById('cart-float-button');
    cartFloatButton.classList.add('is-bouncing');
    setTimeout(() => cartFloatButton.classList.remove('is-bouncing'), 400);

    buttonElement.disabled = true;
    buttonElement.classList.add('btn-success');
    buttonElement.innerHTML = `<i class="fas fa-check"></i> Adicionado`;

    setTimeout(closeItemDetailModal, 1500);
}

function shareItem(itemName) {
    const shareData = {
        title: configData.nome_negocio,
        text: `Olha que legal este item que encontrei no cardápio de ${configData.nome_negocio}: ${itemName}`,
        url: window.location.href,
    };
    if (navigator.share) {
        navigator.share(shareData).catch(console.error);
    } else {
        navigator.clipboard.writeText(shareData.url);
        alert('Link do cardápio copiado para a área de transferência!');
    }
}

function toggleFavorite(buttonElement, itemName) {
    const index = favoriteItems.indexOf(itemName);
    if (index > -1) {
        favoriteItems.splice(index, 1);
    } else {
        favoriteItems.push(itemName);
    }
    saveFavorites();

    const isFavoritedNow = favoriteItems.includes(itemName);

    document.querySelectorAll(`[data-item-name="${itemName}"]`).forEach(btn => {
        btn.classList.toggle('is-favorite', isFavoritedNow);
    });

    renderFavorites(regularMenuData);
}


function openPopupNoticeModal() {
    const noticeModal = document.getElementById('popup-notice-modal');
    const noticeContentWrapper = document.getElementById('popup-notice-content-wrapper');
    const bannerImg = configData.aviso_popup_banner;
    const bannerLink = configData.aviso_popup_link;
    const bannerText = configData.aviso_popup_texto;

    let contentHTML = '';

    if (bannerImg) {
        if (bannerLink) {
            contentHTML = `<a href="${bannerLink}" target="_blank"><img src="${bannerImg}" alt="Aviso"></a>`;
        } else {
            contentHTML = `<img src="${bannerImg}" alt="Aviso">`;
        }
    } else if (bannerText) {
        contentHTML = `<div class="popup-text">${bannerText}</div>`;
    }

    if (contentHTML) {
        noticeContentWrapper.innerHTML = contentHTML;
        noticeModal.classList.add('is-visible');
    }
}

function closePopupNoticeModal() {
    const noticeModal = document.getElementById('popup-notice-modal');
    noticeModal.classList.remove('is-visible');
}

/*
=================================================================
==           BLOCO 7: ORQUESTRADOR PRINCIPAL (MAIN)            ==
=================================================================
*/

// --- 7.1. Elementos do DOM ---
const menuContainer = document.getElementById('menu-container');
const searchInput = document.getElementById('search-input');
const categoryButtonsContainer = document.getElementById('category-buttons');
const sortOptions = document.getElementById('sort-options');
const loadingIndicator = document.getElementById('loading-indicator');
const destaquesContainer = document.getElementById('destaques-container');
const destaquesGrid = document.getElementById('destaques-grid');
const favoritosContainer = document.getElementById('favoritos-container');
const favoritosGrid = document.getElementById('favoritos-grid');
const menuTitle = document.getElementById('menu-title');


// --- 7.2. Estado Global da Aplicação ---
let regularMenuData = [], destaquesData = [], extrasData = [], coupons = [], deliveryFees = [];
let configData = {};
let isStoreOpen = false;
let currentItemsView = [];


// --- 7.3. Funções de Renderização e Lógica Principal ---

function applyBusinessConfig() {
    document.title = configData.nome_negocio || "Cardápio Online";
    document.getElementById('nome-negocio').textContent = configData.nome_negocio || "Nome do Negócio";
    document.getElementById('descricao-negocio').textContent = configData.descricao_negocio || "Descrição";
    document.getElementById('endereco-negocio').innerHTML = configData.endereco_estabelecimento ? `<i class="fas fa-map-marker-alt"></i> ${configData.endereco_estabelecimento}` : '';
    document.getElementById('logo-negocio').src = configData.logo_negocio || "";
    
    const bannerContainer = document.querySelector('.top-banner-container');
    if (configData.banner_topo && configData.banner_topo.trim() !== '') {
        bannerContainer.classList.remove('is-hidden');
        document.getElementById('banner-topo-img').src = configData.banner_topo;
    } else {
        bannerContainer.classList.add('is-hidden');
    }

    const phone = configData.whatsapp_negocio;
    if (phone) {
        document.getElementById('contato-negocio').innerHTML = `<a href="https://wa.me/55${phone.replace(/\D/g, '')}" target="_blank"><i class="fab fa-whatsapp"></i> ${formatPhoneNumber(phone)}</a>`;
    }
    const socialContainer = document.getElementById('social-media-container');
    let socialHTML = '';
    if (configData.instagram_estabelecimento) socialHTML += `<a href="${configData.instagram_estabelecimento}" target="_blank" title="Instagram"><i class="fab fa-instagram"></i></a>`;
    if (configData.facebook_estabelecimento) socialHTML += `<a href="${configData.facebook_estabelecimento}" target="_blank" title="Facebook"><i class="fab fa-facebook"></i></a>`;
    if (configData.youtube_estabelecimento) socialHTML += `<a href="${configData.youtube_estabelecimento}" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>`;
    if (configData.tiktok_estabelecimento) socialHTML += `<a href="${configData.tiktok_estabelecimento}" target="_blank" title="TikTok"><i class="fab fa-tiktok"></i></a>`;
    socialContainer.innerHTML = socialHTML;
    document.getElementById('footer-business-name').textContent = configData.nome_negocio || "";
    document.getElementById('footer-year').textContent = new Date().getFullYear();
    
    checkBusinessStatus();

    if (configData.aviso_popup_status?.toUpperCase() === 'ATIVO') {
        openPopupNoticeModal();
    }
}

function checkBusinessStatus() {
    const statusContainer = document.getElementById('store-status-container');
    const statusDetailsContainer = document.getElementById('store-status-details');
    const manualStatus = configData.status_manual?.toUpperCase();

    statusDetailsContainer.innerHTML = '';

    if (manualStatus === 'ABERTO') {
        isStoreOpen = true;
    } else if (manualStatus === 'FECHADO') {
        isStoreOpen = false;
    } else {
        try {
            const now = new Date(new Date().toLocaleString("en-US", { timeZone: configData.fuso_horario || 'America/Sao_Paulo' }));
            const dayOfWeek = now.getDay();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            let schedule = (dayOfWeek === 0) ? configData.horario_domingo : (dayOfWeek === 6) ? configData.horario_sabado : configData.horario_semana;
            if (!schedule || schedule.toUpperCase() === 'FECHADO') {
                isStoreOpen = false;
            } else {
                const [start, end] = schedule.split('-').map(time => {
                    const [hours, minutes] = time.split(':').map(Number);
                    return hours * 60 + minutes;
                });
                isStoreOpen = currentTime >= start && currentTime <= end;
            }
        } catch (e) { isStoreOpen = false; }
    }

    if (isStoreOpen) {
        statusContainer.innerHTML = `<span class="status-badge status-open">Aberto para pedidos</span>`;
        if (configData.pedido_minimo && parsePrice(configData.pedido_minimo) > 0) {
            // AQUI ESTÁ A ALTERAÇÃO com o ícone adicionado
            statusDetailsContainer.innerHTML = `<i class="fas fa-dollar-sign"></i> Pedido mínimo: <b>${formatCurrency(parsePrice(configData.pedido_minimo))}</b>`;
        }
        document.body.classList.remove('store-closed');
    } else {
        statusContainer.innerHTML = `<span class="status-badge status-closed">Fechado no momento</span>`;
        document.body.classList.add('store-closed');
    }
}

function createMenuItemCard(item) {
    const isAvailable = item.STATUS?.trim().toUpperCase() === 'ATIVO' || item.STATUS?.trim().toUpperCase() === 'SIM';
    const card = document.createElement('div');
    card.className = `menu-item-card ${!isAvailable ? 'item-unavailable' : ''}`;
    
    card.addEventListener('click', (event) => {
        if (event.target.closest('.favorite-btn')) {
            return; 
        }
        if (isAvailable) {
            openItemDetailModal(item, extrasData, isStoreOpen);
        }
    });
    
    const isFavorited = favoriteItems.includes(item.NOME);
    const isDestaque = item.DSTQ?.toUpperCase() === 'SIM';
    const itemNameText = isDestaque ? `<span class="destaque-title-icon"><i class="fas fa-star"></i></span>${item.NOME}` : item.NOME;
    
    const price = parsePrice(item.VALOR);
    const promoPrice = parsePrice(item.PROMO);
    const isPromo = promoPrice > 0 && promoPrice < price;

    let priceHTML = isPromo ? `<div class="price-display"><span class="item-price">${formatCurrency(promoPrice)}</span><span class="original-price">${formatCurrency(price)}</span><span class="discount-badge">-${Math.round(((price - promoPrice) / price) * 100)}%</span></div>` : `<div class="price-display"><p class="item-price">${formatCurrency(price)}</p></div>`;
    let allTagsHTML = item.TAGS ? item.TAGS.split(',').map(tag => {
        const trimmedTag = tag.trim().toUpperCase();
        switch (trimmedTag) {
            case 'MAIS_PEDIDO': return '<div class="special-tag tag-mais-pedido"><i class="fas fa-fire"></i> Mais Pedido</div>';
            case 'BEBIDA_GELADA': return '<div class="special-tag tag-bebida-gelada"><i class="fas fa-snowflake"></i> Bebida Gelada</div>';
            case 'NOVIDADE': return '<div class="special-tag tag-novidade"><i class="fas fa-star"></i> Novidade</div>';
            case 'VEGETARIANO': return '<div class="special-tag tag-vegetariano"><i class="fas fa-leaf"></i> Vegetariano</div>';
            case 'LEVE': return '<div class="special-tag tag-leve"><i class="fas fa-feather-alt"></i> Leve</div>';
            default: return tag.trim() ? `<span class="tag"><i class="fas fa-tag"></i> ${tag.trim()}</span>` : '';
        }
    }).join('') : '';
    let metaInfoHTML = '';
    if (item.QTD || item.SERVE) {
        metaInfoHTML += '<div class="item-meta-info">';
        if(item.QTD) metaInfoHTML += `<span class="meta-item"><i class="fas fa-box-open"></i> ${item.QTD}</span>`;
        if(item.SERVE) metaInfoHTML += `<span class="meta-item"><i class="fas fa-users"></i> Serve ${item.SERVE}</span>`;
        metaInfoHTML += '</div>';
    }
    
    let favoriteHTML = `<button class="favorite-btn ${isFavorited ? 'is-favorite' : ''}" data-item-name="${item.NOME}" onclick="toggleFavorite(this, '${item.NOME}')"><i class="fas fa-heart"></i></button>`;
    let promoBadgeHTML = isPromo ? `<div class="promo-badge"><i class="fas fa-tags"></i> PROMOÇÃO</div>` : '';
    
    card.innerHTML = `
        <div class="menu-item-card-info">
            <p class="item-name">${itemNameText}</p>
            <div class="tags-wrapper">${allTagsHTML}</div>
            <p class="item-description">${item.DESCRICAO || ''}</p>
            ${metaInfoHTML}
            ${priceHTML}
        </div>
        <div class="menu-item-card-image-wrapper">
            ${favoriteHTML}
            <img src="${item.IMAGEM}" alt="${item.NOME}" class="item-image" loading="lazy">
            ${promoBadgeHTML}
        </div>`;

    return card;
}

function renderMenu(items, targetContainer = menuContainer) {
    targetContainer.innerHTML = '';
    
    if (items.length === 0) {
        if(targetContainer === menuContainer) {
            targetContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Nenhum item encontrado para esta seleção.</p>';
        }
        return;
    }
    
    items.forEach((item) => {
        const card = createMenuItemCard(item);
        targetContainer.appendChild(card);
    });
}

function renderDestaques(items) {
    const availableItems = items.filter(item => item.STATUS?.trim().toUpperCase() === 'ATIVO' || item.STATUS?.trim().toUpperCase() === 'SIM');
    if (availableItems.length === 0) {
        destaquesContainer.style.display = 'none';
        return;
    }
    destaquesContainer.style.display = 'block';
    renderMenu(availableItems, destaquesGrid);
}

function renderFavorites(fullMenu) {
    const itemsToRender = fullMenu.filter(item => favoriteItems.includes(item.NOME));
    
    if (favoriteItems.length > 0) {
        favoritosContainer.style.display = 'block';
        if (itemsToRender.length > 0) {
            renderMenu(itemsToRender, favoritosGrid);
        } else {
            favoritosGrid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Seus itens favoritos não estão disponíveis no momento.</p>';
        }
    } else {
        favoritosContainer.style.display = 'none';
    }

    const favCategoryBtn = document.querySelector('.favorite-category-btn');
    if (favCategoryBtn && favCategoryBtn.classList.contains('active') && favoriteItems.length === 0) {
        favoritosContainer.style.display = 'block';
        favoritosGrid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Você ainda não marcou nenhum item como favorito.</p>';
    }
}


function renderCategories(items) {
    const categories = ['Todos', ...new Set(items.map(item => item.CATEGORIA).filter(Boolean))];
    categoryButtonsContainer.innerHTML = '';

    const favButton = document.createElement('button');
    favButton.className = 'category-btn favorite-category-btn';
    favButton.innerHTML = '<i class="fas fa-heart"></i> Favoritos';
    favButton.onclick = (event) => filterByCategory('Favoritos', event);
    categoryButtonsContainer.appendChild(favButton);

    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.textContent = category;
        if (category === 'Todos') button.classList.add('active');
        button.onclick = (event) => filterByCategory(category, event);
        categoryButtonsContainer.appendChild(button);
    });
}

function filterByCategory(category, event) {
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    searchInput.value = '';
    
    destaquesContainer.style.display = 'none';
    favoritosContainer.style.display = 'none';
    menuContainer.style.display = 'grid';
    menuTitle.style.display = 'block';

    const nonDestaquesData = regularMenuData.filter(item => item.DSTQ?.toUpperCase() !== 'SIM');

    if (category === 'Todos') {
        currentItemsView = shuffleArray(nonDestaquesData);
        sortOptions.value = 'padrao';
        renderDestaques(shuffleArray(destaquesData));
        renderFavorites(regularMenuData);
        menuTitle.textContent = 'Nosso Cardápio';
    } else if (category === 'Favoritos') {
        currentItemsView = [];
        menuContainer.style.display = 'none';
        menuTitle.style.display = 'none';
        renderFavorites(regularMenuData);
    } else {
        currentItemsView = nonDestaquesData.filter(item => item.CATEGORIA === category);
        sortOptions.value = 'nome-asc';
        const categoryDestaques = destaquesData.filter(item => item.CATEGORIA === category);
        renderDestaques(categoryDestaques);
        menuTitle.textContent = category;
    }
    sortAndRender();
}

function searchItems() {
    const searchTerm = searchInput.value.toLowerCase();

    if (!searchTerm) {
        filterByCategory('Todos', { target: document.querySelector('.category-btn:not(.favorite-category-btn)') });
        return;
    }

    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    
    destaquesContainer.style.display = 'none';
    favoritosContainer.style.display = 'none';
    menuContainer.style.display = 'grid';
    menuTitle.style.display = 'block';
    menuTitle.textContent = 'Resultados da Busca';

    const nonDestaquesData = regularMenuData.filter(item => item.DSTQ?.toUpperCase() !== 'SIM');
    currentItemsView = nonDestaquesData.filter(item => item.NOME && item.NOME.toLowerCase().includes(searchTerm));
    
    sortAndRender();
}

function sortAndRender() {
    const sortValue = sortOptions.value;
    let itemsToRender = [...currentItemsView];
    switch (sortValue) {
        case 'nome-asc': itemsToRender.sort((a, b) => a.NOME.localeCompare(b.NOME)); break;
        case 'nome-desc': itemsToRender.sort((a, b) => b.NOME.localeCompare(a.NOME)); break;
        case 'preco-asc': itemsToRender.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b)); break;
        case 'preco-desc': itemsToRender.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a)); break;
        case 'padrao': break;
    }
    renderMenu(itemsToRender, menuContainer);
}

function renderBanners(bannersData) {
    if (!bannersData || bannersData.length === 0) return;

    const bannerSection = document.getElementById('banner-carousel-section');
    const bannerContainer = document.getElementById('banner-carousel-container');
    const track = document.createElement('div');
    track.className = 'banner-track';

    // Duplicar banners para criar o efeito de loop infinito
    const allBanners = [...bannersData, ...bannersData];

    allBanners.forEach(banner => {
        if (!banner.IMAGEM) return;

        const bannerItem = document.createElement('div');
        bannerItem.className = 'banner-item';

        const link = document.createElement('a');
        link.href = banner.LINK || '#';
        if (banner.LINK) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }

        const img = document.createElement('img');
        img.src = banner.IMAGEM;
        img.alt = banner.NOME || 'Banner';
        img.loading = 'lazy';

        link.appendChild(img);
        bannerItem.appendChild(link);
        track.appendChild(bannerItem);
    });

    bannerContainer.appendChild(track);
    bannerSection.style.display = 'block';
}

function setupBannerCarousel() {
    const container = document.getElementById('banner-carousel-container');
    if (!container) return;
    const track = container.querySelector('.banner-track');
    if (!track || track.children.length <= 1) return;

    // --- Configurações ---
    const PAUSE_INTERVAL = 3000; // Pausa de 3 segundos entre os slides
    const TRANSITION_STYLE = 'transform 0.6s ease-in-out';

    // --- Variáveis de Estado ---
    let currentIndex = 0;
    let slideInterval;
    let isDragging = false;
    let startPos = 0;
    let startTranslate = 0;
    let currentTranslate = 0;
    
    const originalBannerCount = track.children.length / 2;

    function getItemWidth() {
        // Pega a largura do primeiro item, que define o passo do carrossel
        return track.children[0].offsetWidth;
    }
    
    function goToSlide(slideIndex, withTransition = true) {
        if (withTransition) {
            track.style.transition = TRANSITION_STYLE;
        } else {
            track.style.transition = 'none';
        }
        currentTranslate = -slideIndex * getItemWidth();
        track.style.transform = `translateX(${currentTranslate}px)`;
        currentIndex = slideIndex;
    }

    function startAutoplay() {
        stopAutoplay(); // Garante que não haja múltiplos intervalos rodando
        slideInterval = setInterval(() => {
            goToSlide(currentIndex + 1);
        }, PAUSE_INTERVAL);
    }

    function stopAutoplay() {
        clearInterval(slideInterval);
    }
    
    // --- Lógica do Loop Infinito ---
    track.addEventListener('transitionend', () => {
        // Quando a transição para um slide "clone" termina...
        if (currentIndex >= originalBannerCount) {
            // ...pula de volta para o slide original correspondente, sem animação.
            goToSlide(currentIndex % originalBannerCount, false);
        }
    });

    // --- Lógica de Arrastar (Drag/Swipe) ---
    function getPositionX(event) {
        return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
    }

    function dragStart(event) {
        stopAutoplay();
        isDragging = true;
        startPos = getPositionX(event);
        startTranslate = currentTranslate;
        track.style.transition = 'none'; // Remove a transição para o arrastar ser instantâneo
    }

    function dragMove(event) {
        if (isDragging) {
            const currentPosition = getPositionX(event);
            const move = currentPosition - startPos;
            currentTranslate = startTranslate + move;
            track.style.transform = `translateX(${currentTranslate}px)`;
        }
    }

    function dragEnd() {
        if (!isDragging) return;
        isDragging = false;
        
        const movedBy = currentTranslate - startTranslate;
        const itemWidth = getItemWidth();
        
        // Lógica de "snap": se moveu mais de 1/4 do banner, avança/retrocede. Senão, volta.
        if (movedBy < -itemWidth / 4 && currentIndex < (originalBannerCount * 2) - 1) {
            goToSlide(currentIndex + 1);
        } else if (movedBy > itemWidth / 4 && currentIndex > 0) {
            goToSlide(currentIndex - 1);
        } else {
            goToSlide(currentIndex);
        }
        
        startAutoplay(); // Reinicia o autoplay após o usuário soltar
    }

    // --- Event Listeners ---
    container.addEventListener('mousedown', dragStart);
    container.addEventListener('touchstart', dragStart, { passive: true });

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, { passive: true });

    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);

    // Pausa o autoplay ao colocar o mouse sobre o carrossel
    container.addEventListener('mouseenter', stopAutoplay);
    container.addEventListener('mouseleave', startAutoplay);

    // Inicia o carrossel
    startAutoplay();
}

function setupEventListeners() {
    searchInput.addEventListener('keyup', searchItems);
    sortOptions.addEventListener('change', sortAndRender);
    document.getElementById('clear-cart-btn').addEventListener('click', clearCart);
    document.getElementById('checkout-btn').addEventListener('click', () => {
        const cartData = JSON.parse(localStorage.getItem('meuCarrinho')) || [];
        openCheckoutModal(cartData, configData, deliveryFees, coupons, isStoreOpen);
    });
    document.getElementById('apply-coupon-btn').addEventListener('click', applyCoupon);
    document.getElementById('finalize-order-btn').addEventListener('click', finalizeOrder);
    document.getElementById('close-success-modal-btn').addEventListener('click', closeSuccessModal);

    document.body.addEventListener('click', function(event) {
        const overlay = event.target;
        if (overlay.classList.contains('modal-overlay')) {
            if (overlay.id === 'item-detail-modal') closeItemDetailModal();
            if (overlay.id === 'checkout-modal') closeCheckoutModal();
            if (overlay.id === 'order-success-modal') closeSuccessModal();
            if (overlay.id === 'popup-notice-modal') closePopupNoticeModal();
        }
        const cartSidebar = document.getElementById('cart-sidebar');
        if (cartSidebar.classList.contains('open') && !event.target.closest('#cart-sidebar') && !event.target.closest('#cart-float-button') && !event.target.closest('.header-cart-button')) {
            toggleCart();
        }
    });

    setupCartEventListeners();
    document.getElementById('customer-whatsapp').addEventListener('input', (event) => {
        let input = event.target;
        let value = input.value.replace(/\D/g, '').substring(0, 11);
        if (value.length > 7) { value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7, 11)}`; }
        else if (value.length > 2) { value = `(${value.substring(0, 2)}) ${value.substring(2)}`; }
        else if (value.length > 0) { value = `(${value.substring(0)}`; }
        input.value = value;
    });
    document.getElementById('change-for-amount').addEventListener('input', formatCurrencyInput);
    document.getElementById('no-change-needed').addEventListener('change', (event) => {
        document.getElementById('change-for-amount').disabled = event.target.checked;
        if (event.target.checked) document.getElementById('change-for-amount').value = '';
    });
    document.getElementById('pix-key-display').addEventListener('click', (event) => {
        const pixKey = event.target.textContent;
        const feedbackEl = document.getElementById('pix-copy-feedback');
        navigator.clipboard.writeText(pixKey).then(() => {
            event.target.classList.add('copied');
            feedbackEl.textContent = 'Copiado!';
            setTimeout(() => {
                event.target.classList.remove('copied');
                feedbackEl.textContent = 'Clique na chave para copiar';
            }, 2000);
        });
    });
}


// --- 7.4. Ponto de Entrada da Aplicação ---
async function init() {
    loadingIndicator.style.display = 'flex';
    loadCart();
    loadFavorites();

    const [configCsv, menuCsv, extrasCsv, couponsCsv, taxasCsv, bannersCsv] = await Promise.all([
        fetchData(SHEET_CONFIG_URL),
        fetchData(SHEET_MENU_URL),
        fetchData(SHEET_EXTRAS_URL),
        fetchData(SHEET_COUPONS_URL),
        fetchData(SHEET_TAXAS_URL),
        fetchData(SHEET_BANNERS_URL)
    ]);

    if (!configCsv || !menuCsv) {
        loadingIndicator.innerHTML = '<p>Erro fatal. Não foi possível carregar os dados essenciais. Verifique os links da planilha.</p>';
        return;
    }

    const configRaw = parseCSV(configCsv);
    configData = configRaw.reduce((obj, item) => { if (item.CHAVE) obj[item.CHAVE] = item.VALOR; return obj; }, {});
    
    const menuRaw = parseCSV(menuCsv);
    regularMenuData = menuRaw.map((item, index) => ({ ...item, originalIndex: index }));
    
    destaquesData = regularMenuData.filter(item => item.DSTQ?.toUpperCase() === 'SIM');
    const nonDestaquesData = regularMenuData.filter(item => item.DSTQ?.toUpperCase() !== 'SIM');

    extrasData = extrasCsv ? parseCSV(extrasCsv) : [];
    coupons = couponsCsv ? parseCSV(couponsCsv) : [];
    deliveryFees = taxasCsv ? parseCSV(taxasCsv) : [];
    const bannersData = bannersCsv ? parseCSV(bannersCsv) : [];

    currentItemsView = shuffleArray(nonDestaquesData);

    applyBusinessConfig();
    renderCategories(regularMenuData);
    renderBanners(bannersData);
    renderDestaques(shuffleArray(destaquesData));
    renderMenu(currentItemsView, menuContainer);
    renderFavorites(regularMenuData);
    
    setupEventListeners();
    if (bannersData.length > 0) {
        setupBannerCarousel();
    }

    loadingIndicator.style.display = 'none';
}

document.addEventListener("DOMContentLoaded", init);