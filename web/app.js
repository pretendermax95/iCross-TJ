const grid = document.querySelector("#product-grid");
const cartCount = document.querySelector("#cart-count");
const cartItems = document.querySelector("#cart-items");
const cartTotal = document.querySelector("#cart-total");
const drawerCount = document.querySelector("#drawer-count");
const overlay = document.querySelector("#overlay");
const drawer = document.querySelector("#cart-drawer");
const checkoutModal = document.querySelector("#checkout-modal");
const wholesaleModal = document.querySelector("#wholesale-modal");
const wholesaleForm = document.querySelector("#wholesale-form");
const wholesaleFormMessage = document.querySelector("#wholesale-form-message");
const form = document.querySelector("#checkout-form");
const formMessage = document.querySelector("#form-message");
const formatPrice = (price) => `${price.toLocaleString("ru-RU")} смн`;
let products = [];
let activeFilter = "all";
let cart = loadCart();
let staticHosting = location.hostname.endsWith(".github.io");

function loadCart() {
  try {
    const stored = JSON.parse(localStorage.getItem("icross-cart") || "[]");
    return Array.isArray(stored) ? stored.filter((line) =>
      Number.isInteger(line.productId) && Number.isInteger(line.size) &&
      Number.isInteger(line.quantity) && line.quantity > 0) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem("icross-cart", JSON.stringify(cart));
  renderCart();
}

async function loadProducts() {
  try {
    let response = await fetch(staticHosting ? "./products.json?v=3" : "./api/products");
    if (!response.ok && !staticHosting) {
      response = await fetch("./products.json?v=3");
      staticHosting = response.ok && location.hostname.endsWith(".github.io");
    }
    if (!response.ok) throw new Error("Не удалось загрузить каталог");
    products = await response.json();
    renderProducts();
    renderCart();
  } catch (error) {
    grid.innerHTML = `<p class="empty-results">${error.message}. Обновите страницу.</p>`;
  }
}

function renderProducts() {
  const query = document.querySelector("#search-input").value.trim().toLowerCase();
  const brand = document.querySelector("#brand-filter").value;
  const visible = products.filter((product) =>
    (activeFilter === "all" || product.category === activeFilter) &&
    (brand === "all" || product.brand === brand) &&
    `${product.name} ${product.brand}`.toLowerCase().includes(query));

  if (!visible.length) {
    grid.innerHTML = '<p class="empty-results">Ничего не нашлось. Попробуй изменить поиск или фильтры.</p>';
    return;
  }

  grid.innerHTML = visible.map((product) => `
    <article class="product-card">
      <div class="product-image" data-product="${product.id}">
        <img src="${product.image}" alt="${product.brand} ${product.name}" loading="lazy">
        ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ""}
        <button class="quick-add" data-product="${product.id}">Выбрать размер <span>＋</span></button>
      </div>
      <div class="product-meta">
        <span class="product-brand">${product.brand}</span>
        <h3>${product.name}</h3>
        <div class="product-bottom"><div><span class="price">${formatPrice(product.price)}</span>${product.oldPrice ? `<span class="old-price">${formatPrice(product.oldPrice)}</span>` : ""}</div>
          <div class="color-dots" aria-label="Доступные цвета">${product.colors.map((color) => `<i style="background:${color}"></i>`).join("")}</div>
        </div>
      </div>
    </article>`).join("");
}

function renderCart() {
  const lines = cart.map((line) => ({ ...line, product: products.find((item) => item.id === line.productId) }))
    .filter((line) => line.product);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  cartCount.textContent = count;
  drawerCount.textContent = `(${count})`;
  cartTotal.textContent = formatPrice(total);
  document.querySelector("#checkout-total").textContent = formatPrice(total);
  cartItems.innerHTML = lines.map(({ product, size, quantity }) => `
    <div class="cart-line">
      <img src="${product.image}" alt="">
      <div class="cart-line-info"><small>${product.brand}</small><strong>${product.name}</strong><span>Размер: ${size}</span>
        <div class="quantity-control"><button data-action="decrease" data-product="${product.id}" data-size="${size}" aria-label="Уменьшить количество">−</button><span>${quantity}</span><button data-action="increase" data-product="${product.id}" data-size="${size}" aria-label="Увеличить количество">＋</button></div>
      </div>
      <div><span class="cart-line-price">${formatPrice(product.price * quantity)}</span><button class="remove-line" data-action="remove" data-product="${product.id}" data-size="${size}" aria-label="Удалить товар">×</button></div>
    </div>`).join("");
  document.querySelector("#cart-empty").classList.toggle("visible", lines.length === 0);
  document.querySelector("#cart-summary").classList.toggle("hidden", lines.length === 0);
}

function openDrawer() {
  drawer.classList.add("open");
  overlay.classList.add("open");
  document.body.classList.add("no-scroll");
}

function closePanels() {
  drawer.classList.remove("open");
  overlay.classList.remove("open");
  checkoutModal.classList.remove("open");
  wholesaleModal.classList.remove("open");
  document.body.classList.remove("no-scroll");
}

function addProduct(productId, selectedSize) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  if (!product.sizes.includes(selectedSize)) {
    return;
  }
  const existing = cart.find((line) => line.productId === productId && line.size === selectedSize);
  if (existing) existing.quantity += 1;
  else cart.push({ productId, size: selectedSize, quantity: 1 });
  saveCart();
  openDrawer();
}

grid.addEventListener("click", (event) => {
  const sizeButton = event.target.closest(".size-option");
  if (sizeButton) {
    addProduct(Number(sizeButton.dataset.product), Number(sizeButton.dataset.size));
    sizeButton.closest(".size-picker").remove();
    return;
  }
  const button = event.target.closest(".quick-add");
  if (!button) return;
  grid.querySelectorAll(".size-picker").forEach((picker) => picker.remove());
  const product = products.find((item) => item.id === Number(button.dataset.product));
  if (!product) return;
  const picker = document.createElement("div");
  picker.className = "size-picker";
  picker.setAttribute("aria-label", "Выберите размер");
  picker.innerHTML = `<span>Размер</span>${product.sizes.map((size) =>
    `<button class="size-option" data-product="${product.id}" data-size="${size}">${size}</button>`).join("")}`;
  button.closest(".product-image").append(picker);
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const productId = Number(button.dataset.product);
  const size = Number(button.dataset.size);
  const line = cart.find((item) => item.productId === productId && item.size === size);
  if (!line) return;
  if (button.dataset.action === "increase") line.quantity += 1;
  if (button.dataset.action === "decrease") line.quantity -= 1;
  if (button.dataset.action === "remove" || line.quantity < 1) {
    cart = cart.filter((item) => item !== line);
  }
  saveCart();
});

document.querySelectorAll(".filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelector(".filter-tab.active").classList.remove("active");
    tab.classList.add("active");
    activeFilter = tab.dataset.filter;
    renderProducts();
  });
});
document.querySelector("#search-input").addEventListener("input", renderProducts);
document.querySelector("#brand-filter").addEventListener("change", renderProducts);
document.querySelector(".search-toggle").addEventListener("click", () => {
  document.querySelector("#search-input").focus();
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
});
document.querySelector("#cart-open").addEventListener("click", openDrawer);
document.querySelector("#cart-close").addEventListener("click", closePanels);
document.querySelector("#continue-shopping").addEventListener("click", () => {
  closePanels();
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
});
overlay.addEventListener("click", closePanels);
document.querySelector(".modal-close").addEventListener("click", closePanels);
document.querySelector("#wholesale-open").addEventListener("click", () => {
  wholesaleModal.classList.add("open");
  document.body.classList.add("no-scroll");
});
document.querySelector("#wholesale-close").addEventListener("click", closePanels);
wholesaleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!wholesaleForm.reportValidity()) return;
  const values = new FormData(wholesaleForm);
  const fields = [
    ["Имя", values.get("name")],
    ["Телефон", values.get("phone")],
    ["Магазин или компания", values.get("company") || "Не указано"],
    ["Модели и бренды", values.get("products")],
    ["Количество пар", values.get("quantity")],
    ["Комментарий", values.get("comment") || "Нет"],
  ];
  const body = ["Оптовая заявка iCross TJ", "", ...fields.map(([label, value]) => `${label}: ${value}`)].join("\n");
  const email = document.createElement("a");
  email.href = `mailto:pretendermax@gmail.com?subject=${encodeURIComponent("Оптовая заявка iCross TJ")}&body=${encodeURIComponent(body)}`;
  email.hidden = true;
  document.body.append(email);
  email.click();
  email.remove();
  wholesaleFormMessage.textContent = "Проверьте подготовленное письмо и нажмите «Отправить» в своём почтовом приложении.";
});
document.querySelector("#menu-toggle").addEventListener("click", () =>
  document.querySelector(".main-nav").classList.toggle("open"));
document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", () =>
  document.querySelector(".main-nav").classList.remove("open")));
document.querySelector(".checkout-open").addEventListener("click", () => {
  drawer.classList.remove("open");
  checkoutModal.classList.add("open");
  if (staticHosting) {
    document.querySelector("#static-hosting-note").hidden = false;
    form.querySelector(".submit-order").disabled = true;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (staticHosting) return;
  if (!cart.length) return;
  const submitButton = form.querySelector(".submit-order");
  const formData = new FormData(form);
  const order = Object.fromEntries(formData.entries());
  order.items = cart.map(({ productId, size, quantity }) => ({ productId, size, quantity }));
  submitButton.disabled = true;
  formMessage.className = "form-message";
  formMessage.textContent = "Отправляем заказ...";
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось оформить заказ");
    cart = [];
    saveCart();
    form.reset();
    formMessage.className = "form-message success";
    formMessage.textContent = `${result.message} Номер заказа: ${result.orderId}. Итого: ${formatPrice(result.total)}.`;
  } catch (error) {
    formMessage.className = "form-message error";
    formMessage.textContent = error.message || "Ошибка соединения. Попробуйте ещё раз.";
  } finally {
    submitButton.disabled = false;
  }
});

loadProducts();
