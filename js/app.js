"use strict";

const STORAGE_KEYS = {
  products: "stockquick.products.v1",
  orders: "stockquick.orders.v1"
};

const starterProducts = [
  { id: "p-1", name: "Papas clásicas 115g", category: "Snacks", price: 3500, stock: 48, emoji: "🥔", description: "Crujientes, perfectas para compartir." },
  { id: "p-2", name: "Gaseosa cola 1.5L", category: "Bebidas", price: 6200, stock: 24, emoji: "🥤", description: "Bien fría para acompañar tus comidas." },
  { id: "p-3", name: "Arroz blanco 1kg", category: "Abarrotes", price: 4200, stock: 6, emoji: "🍚", description: "Un básico que no puede faltar." },
  { id: "p-4", name: "Galletas de chocolate", category: "Snacks", price: 2800, stock: 32, emoji: "🍪", description: "Galletas rellenas con sabor a chocolate." },
  { id: "p-5", name: "Leche entera 1L", category: "Lácteos", price: 4100, stock: 2, emoji: "🥛", description: "Leche fresca para toda la familia." },
  { id: "p-6", name: "Jugo de naranja 1L", category: "Bebidas", price: 5400, stock: 18, emoji: "🧃", description: "Sabor natural, ideal para el desayuno." }
];

const moneyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});
const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const elements = {
  productGrid: document.querySelector("#product-grid"),
  categoryFilters: document.querySelector("#category-filters"),
  search: document.querySelector("#product-search"),
  inventorySearch: document.querySelector("#inventory-search"),
  inventoryBody: document.querySelector("#inventory-body"),
  emptyState: document.querySelector("#empty-state"),
  inventoryEmpty: document.querySelector("#inventory-empty"),
  productModal: document.querySelector("#product-modal"),
  productForm: document.querySelector("#product-form"),
  productModalTitle: document.querySelector("#product-modal-title"),
  productId: document.querySelector("#product-id"),
  productName: document.querySelector("#product-name"),
  productCategory: document.querySelector("#product-category"),
  productPrice: document.querySelector("#product-price"),
  productStock: document.querySelector("#product-stock"),
  productEmoji: document.querySelector("#product-emoji"),
  productDescription: document.querySelector("#product-description"),
  formError: document.querySelector("#form-error"),
  saveProductButton: document.querySelector("#save-product-button"),
  checkoutModal: document.querySelector("#checkout-modal"),
  checkoutForm: document.querySelector("#checkout-form"),
  checkoutItems: document.querySelector("#checkout-items"),
  checkoutTotal: document.querySelector("#checkout-total"),
  checkoutError: document.querySelector("#checkout-error"),
  cartBar: document.querySelector("#cart-bar"),
  cartCount: document.querySelector("#cart-count"),
  cartSummary: document.querySelector("#cart-summary"),
  toast: document.querySelector("#toast"),
  ordersList: document.querySelector("#orders-list"),
  ordersTotal: document.querySelector("#orders-total"),
  navOrderCount: document.querySelector("#nav-order-count"),
  sidebar: document.querySelector(".sidebar")
};

let products = loadCollection(STORAGE_KEYS.products, starterProducts);
let orders = loadCollection(STORAGE_KEYS.orders, []);
let activeCategory = "Todos";
let cart = new Map();
let toastTimeout;

function loadCollection(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return structuredClone(fallback);
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Los datos guardados no tienen el formato esperado.");
    return parsed;
  } catch (error) {
    console.error(`No se pudieron cargar los datos (${key}).`, error);
    return structuredClone(fallback);
  }
}

function saveCollection(key, collection) {
  try {
    localStorage.setItem(key, JSON.stringify(collection));
    return true;
  } catch (error) {
    console.error(`No se pudieron guardar los datos (${key}).`, error);
    showToast("No se pudieron guardar los cambios. Revisa el almacenamiento del navegador.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatPrice(value) {
  return moneyFormatter.format(value);
}

function productMatches(product, query) {
  const searchTerm = query.trim().toLocaleLowerCase("es");
  return (!searchTerm || `${product.name} ${product.category}`.toLocaleLowerCase("es").includes(searchTerm))
    && (activeCategory === "Todos" || product.category === activeCategory);
}

function renderCategories() {
  const categoryNames = ["Todos", ...new Set(products.map((product) => product.category))];
  if (!categoryNames.includes(activeCategory)) activeCategory = "Todos";
  elements.categoryFilters.innerHTML = categoryNames.map((category) => `
    <button class="filter-chip${category === activeCategory ? " is-active" : ""}" type="button"
      data-category="${escapeHTML(category)}" aria-pressed="${category === activeCategory}">
      ${escapeHTML(category)}
    </button>
  `).join("");
}

function renderCatalog() {
  const visibleProducts = products.filter((product) => productMatches(product, elements.search.value));
  elements.productGrid.innerHTML = visibleProducts.map((product, index) => {
    const stockIsLow = Number(product.stock) <= 5;
    return `
      <article class="product-card">
        <div class="product-art tone-${(index % 5) + 1}">
          <span class="stock-badge${stockIsLow ? " low" : ""}">${stockIsLow ? "¡Quedan pocos!" : `${product.stock} en stock`}</span>
          <span class="product-emoji" aria-hidden="true">${escapeHTML(product.emoji || "📦")}</span>
          <button class="card-more" type="button" data-edit-product="${escapeHTML(product.id)}" aria-label="Editar ${escapeHTML(product.name)}">···</button>
        </div>
        <div class="product-info">
          <p class="product-category">${escapeHTML(product.category)}</p>
          <h3 class="product-name" title="${escapeHTML(product.name)}">${escapeHTML(product.name)}</h3>
          <p class="product-description">${escapeHTML(product.description || "Disponible en tu tienda.")}</p>
          <div class="product-bottom">
            <span class="product-price">${formatPrice(Number(product.price))}</span>
            <button class="add-to-cart" type="button" data-add-cart="${escapeHTML(product.id)}"
              aria-label="Agregar ${escapeHTML(product.name)} al pedido" ${Number(product.stock) < 1 ? "disabled" : ""}>＋</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
  elements.emptyState.hidden = visibleProducts.length > 0;
  elements.productGrid.hidden = visibleProducts.length === 0;
}

function renderInventory() {
  const query = elements.inventorySearch.value.trim().toLocaleLowerCase("es");
  const visibleProducts = products.filter((product) => `${product.name} ${product.category}`.toLocaleLowerCase("es").includes(query));
  elements.inventoryBody.innerHTML = visibleProducts.map((product) => {
    const isLow = Number(product.stock) <= 5;
    return `<tr>
      <td class="inventory-product"><span class="inventory-emoji" aria-hidden="true">${escapeHTML(product.emoji || "📦")}</span>${escapeHTML(product.name)}</td>
      <td>${escapeHTML(product.category)}</td>
      <td class="inventory-price">${formatPrice(Number(product.price))}</td>
      <td>${Number(product.stock)} uds.</td>
      <td><span class="stock-pill${isLow ? " low" : ""}">${isLow ? "Stock bajo" : "Disponible"}</span></td>
      <td><div class="row-actions">
        <button class="row-action" type="button" data-edit-product="${escapeHTML(product.id)}" aria-label="Editar ${escapeHTML(product.name)}">✎</button>
        <button class="row-action delete" type="button" data-delete-product="${escapeHTML(product.id)}" aria-label="Eliminar ${escapeHTML(product.name)}">×</button>
      </div></td>
    </tr>`;
  }).join("");
  elements.inventoryEmpty.hidden = visibleProducts.length > 0;
  document.querySelector(".table-wrap").hidden = visibleProducts.length === 0;
}

function renderStats() {
  document.querySelector("#stat-products").textContent = products.length;
  document.querySelector("#stat-units").textContent = products.reduce((sum, product) => sum + Number(product.stock), 0);
  document.querySelector("#stat-low").textContent = products.filter((product) => Number(product.stock) <= 5).length;
  document.querySelector("#stat-orders").textContent = orders.length;
  elements.navOrderCount.textContent = orders.length;
}

function renderOrders() {
  elements.ordersTotal.textContent = `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"}`;
  if (orders.length === 0) {
    elements.ordersList.innerHTML = `<div class="empty-state"><span class="empty-icon" aria-hidden="true">⌑</span><h3>Aún no tienes pedidos</h3><p>Cuando registres un pedido aparecerá aquí.</p><button class="button button-secondary" type="button" data-view="catalog">Ir al catálogo</button></div>`;
    return;
  }
  elements.ordersList.innerHTML = [...orders].reverse().map((order) => {
    const items = order.items.map((item) => `${item.quantity} × ${escapeHTML(item.name)}`).join(", ");
    return `<article class="order-row">
      <div class="order-customer"><strong>${escapeHTML(order.customer)}</strong><small>${escapeHTML(order.contact || "Sin contacto")}</small></div>
      <div class="order-products">${items}</div>
      <strong class="order-price">${formatPrice(Number(order.total))}</strong>
      <span class="order-status">Recibido</span>
      <time class="order-date">${dateFormatter.format(new Date(order.createdAt))}</time>
    </article>`;
  }).join("");
}

function renderAll() {
  renderCategories();
  renderCatalog();
  renderInventory();
  renderStats();
  renderOrders();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2800);
}

function openProductModal(product) {
  elements.productForm.reset();
  elements.formError.hidden = true;
  elements.formError.textContent = "";
  elements.productId.value = product ? product.id : "";
  elements.productModalTitle.textContent = product ? "Editar producto" : "Agregar producto";
  elements.saveProductButton.textContent = product ? "Guardar cambios" : "Guardar producto";
  if (product) {
    elements.productName.value = product.name;
    elements.productCategory.value = product.category;
    elements.productPrice.value = product.price;
    elements.productStock.value = product.stock;
    elements.productEmoji.value = product.emoji || "";
    elements.productDescription.value = product.description || "";
  }
  elements.productModal.showModal();
  elements.productName.focus();
}

function updateCart() {
  const quantity = [...cart.values()].reduce((sum, item) => sum + item.quantity, 0);
  const productLabel = quantity === 1 ? "producto seleccionado" : "productos seleccionados";
  elements.cartCount.textContent = quantity;
  elements.cartSummary.textContent = productLabel;
  elements.cartBar.hidden = quantity === 0;
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const currentQuantity = cart.has(productId) ? cart.get(productId).quantity : 0;
  if (currentQuantity >= Number(product.stock)) {
    showToast("No quedan más unidades disponibles de este producto.");
    return;
  }
  cart.set(productId, { quantity: currentQuantity + 1 });
  updateCart();
  showToast(`${product.name} agregado al pedido.`);
}

function openCheckout() {
  if (cart.size === 0) return;
  const items = [...cart.entries()].map(([id, entry]) => {
    const product = products.find((item) => item.id === id);
    return product ? { product, quantity: entry.quantity } : null;
  }).filter(Boolean);
  const total = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  elements.checkoutItems.innerHTML = items.map(({ product, quantity }) => `
    <div class="checkout-item"><span>${quantity} × ${escapeHTML(product.name)}</span><strong>${formatPrice(Number(product.price) * quantity)}</strong></div>
  `).join("");
  elements.checkoutTotal.textContent = formatPrice(total);
  elements.checkoutError.hidden = true;
  elements.checkoutForm.reset();
  elements.checkoutModal.showModal();
  document.querySelector("#customer-name").focus();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.hasAttribute("data-open-product")) {
    openProductModal(null);
    return;
  }
  if (target.hasAttribute("data-close-modal")) {
    target.closest("dialog").close();
    return;
  }
  if (target.dataset.view) {
    const nextView = target.dataset.view;
    const panelView = nextView === "catalog" ? "dashboard" : nextView;
    document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.toggle("is-visible", panel.id === `${panelView}-view`));
    document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("is-active", link.dataset.view === nextView));
    const activeLink = document.querySelector(`.nav-link[data-view="${nextView}"]`);
    document.querySelector("#breadcrumb-current").textContent = nextView === "catalog" ? "Catálogo" : (activeLink ? activeLink.textContent.trim() : "Resumen");
    elements.sidebar.classList.remove("is-open");
    if (nextView === "catalog") {
      document.querySelector(".catalog-section").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (target.dataset.category) {
    activeCategory = target.dataset.category;
    renderCategories();
    renderCatalog();
    return;
  }
  if (target.dataset.addCart) {
    addToCart(target.dataset.addCart);
    return;
  }
  if (target.dataset.editProduct) {
    const product = products.find((item) => item.id === target.dataset.editProduct);
    if (product) openProductModal(product);
    return;
  }
  if (target.dataset.deleteProduct) {
    const product = products.find((item) => item.id === target.dataset.deleteProduct);
    if (!product || !window.confirm(`¿Eliminar "${product.name}" del inventario?`)) return;
    const updatedProducts = products.filter((item) => item.id !== product.id);
    if (saveCollection(STORAGE_KEYS.products, updatedProducts)) {
      products = updatedProducts;
      cart.delete(product.id);
      renderAll();
      updateCart();
      showToast("Producto eliminado del inventario.");
    }
    return;
  }
  if (target.id === "open-checkout") openCheckout();
  if (target.id === "mobile-menu") elements.sidebar.classList.toggle("is-open");
});

elements.search.addEventListener("input", renderCatalog);
elements.inventorySearch.addEventListener("input", renderInventory);

elements.productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.productName.value.trim();
  const price = Number(elements.productPrice.value);
  const stock = Number(elements.productStock.value);
  if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
    elements.formError.textContent = "Revisa el nombre, precio y cantidad antes de guardar.";
    elements.formError.hidden = false;
    return;
  }
  const existingId = elements.productId.value;
  const updatedProduct = {
    id: existingId || `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    category: elements.productCategory.value,
    price,
    stock,
    emoji: elements.productEmoji.value.trim() || "📦",
    description: elements.productDescription.value.trim()
  };
  const updatedProducts = existingId
    ? products.map((product) => product.id === existingId ? updatedProduct : product)
    : [...products, updatedProduct];
  if (saveCollection(STORAGE_KEYS.products, updatedProducts)) {
    products = updatedProducts;
    elements.productModal.close();
    renderAll();
    showToast(existingId ? "Producto actualizado." : "Producto agregado al catálogo.");
  }
});

elements.checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const customer = document.querySelector("#customer-name").value.trim();
  const items = [...cart.entries()].map(([id, entry]) => {
    const product = products.find((item) => item.id === id);
    return product ? { product, quantity: entry.quantity } : null;
  }).filter(Boolean);
  if (!customer || items.length === 0) {
    elements.checkoutError.textContent = "Agrega productos y escribe el nombre del cliente para continuar.";
    elements.checkoutError.hidden = false;
    return;
  }
  if (items.some(({ product, quantity }) => Number(product.stock) < quantity)) {
    elements.checkoutError.textContent = "El stock cambió. Ajusta el pedido y vuelve a intentarlo.";
    elements.checkoutError.hidden = false;
    return;
  }
  const order = {
    id: `o-${Date.now()}`,
    customer,
    contact: document.querySelector("#customer-contact").value.trim(),
    items: items.map(({ product, quantity }) => ({ name: product.name, quantity })),
    total: items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
    createdAt: new Date().toISOString()
  };
  const updatedProducts = products.map((product) => {
    const item = items.find((entry) => entry.product.id === product.id);
    return item ? { ...product, stock: Number(product.stock) - item.quantity } : product;
  });
  const updatedOrders = [...orders, order];
  if (!saveCollection(STORAGE_KEYS.products, updatedProducts)) return;
  if (!saveCollection(STORAGE_KEYS.orders, updatedOrders)) {
    saveCollection(STORAGE_KEYS.products, products);
    return;
  }
  products = updatedProducts;
  orders = updatedOrders;
  cart.clear();
  updateCart();
  elements.checkoutModal.close();
  renderAll();
  showToast("Pedido registrado y stock actualizado.");
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.search.focus();
  }
});

document.querySelector("#today-date").textContent = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" }).format(new Date()).toLocaleUpperCase("es");
document.querySelector("#current-year").textContent = new Date().getFullYear();
renderAll();
