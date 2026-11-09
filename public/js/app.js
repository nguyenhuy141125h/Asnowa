(() => {
    "use strict";

    const formatMoney = (value) =>
        new Intl.NumberFormat("vi-VN").format(value) + " ₫";
    let productCategoryFilter = "all";

    function filterProducts() {
        const query =
            document
                .querySelector(".page-products .inline-search input")
                ?.value.trim()
                .toLocaleLowerCase("vi") || "";
        let visible = 0;
        document
            .querySelectorAll(".page-products .product-cards .simple-card")
            .forEach((card) => {
                const matchesCategory =
                    productCategoryFilter === "all" ||
                    card.dataset.categoryId === productCategoryFilter;
                const productName = card.querySelector("h3")?.textContent || "";
                const matchesSearch = productName
                    .toLocaleLowerCase("vi")
                    .includes(query);
                card.hidden = !(matchesCategory && matchesSearch);
                if (!card.hidden) visible += 1;
            });
        const emptyState = document.querySelector(
            ".page-products .product-empty-state",
        );
        if (emptyState) emptyState.hidden = visible > 0;
    }

    function showToast(message) {
        let toast = document.querySelector(".app-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "app-toast";
            toast.setAttribute("role", "status");
            toast.setAttribute("aria-live", "polite");
            document.body.append(toast);
        }
        toast.textContent = message;
        toast.classList.add("visible");
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(
            () => toast.classList.remove("visible"),
            2800,
        );
    }

    function initPos() {
        const grid = document.querySelector(".pos-product-grid");
        const lines = document.querySelector(".pos-cart-lines");
        if (!grid || !lines) return;

        const cards = grid.querySelectorAll(".pos-product");
        const lineTemplate = document.querySelector("#pos-cart-line-template");
        const emptyMessage = document.querySelector(".pos-empty-note");
        const subtotalLabel = document.querySelector(
            ".pos-totals > div:first-child b",
        );
        const discountLabel = document.querySelector(
            ".pos-totals > div:nth-child(2) button",
        );
        const orderContext = document.querySelector("[data-order-context]");
        const orderStatus = document.querySelector("[data-order-status]");
        const orderTitle = document.querySelector("[data-order-title]");
        const orderCode = document.querySelector("[data-order-code]");
        const posScreen = document.querySelector(".pos-screen");
        const checkoutButton = document.querySelector(".pos-checkout");
        const tableDialog = document.querySelector("#pos-table-dialog");
        const serviceModeButtons = [
            ...document.querySelectorAll("[data-service-mode]"),
        ];
        const customerName = document.querySelector(
            ".pos-customer-entry strong",
        );
        const customerNote = document.querySelector(
            ".pos-customer-entry small",
        );
        const modifierDialog = document.querySelector("#pos-modifier-dialog");
        const modifierForm = modifierDialog?.querySelector("form");
        const modifierExtraLabel = modifierDialog?.querySelector(
            "[data-modifier-extra]",
        );
        const modifierProductName = modifierDialog?.querySelector(
            "[data-modifier-product-name]",
        );
        let selectedTable = "";
        let selectedGuests = "2";
        let serviceMode = "dine-in";
        let orderPaid = false;
        let discountRate = 0;
        let editingLine = null;
        const customizableProducts = new Set([
            "matcha-latte",
            "coconut-coffee",
            "peach-tea",
            "matcha-frappe",
            "strawberry-tea",
        ]);
        const toppingPrices = {
            pearl: 8000,
            peach: 7000,
            pudding: 8000,
            cheese: 12000,
        };

        const selectedToppings = (line) => {
            try {
                return JSON.parse(line.dataset.toppings || "[]");
            } catch {
                return [];
            }
        };

        const lineUnitPrice = (line) =>
            Number(line.dataset.price || 0) +
            Number(line.dataset.sizeExtra || 0) +
            selectedToppings(line).reduce(
                (sum, topping) => sum + Number(topping.price || 0),
                0,
            );

        const renderLineOptions = (line) => {
            const small = line.querySelector(".pos-line-name small");
            const button = line.querySelector(".pos-line-customize");
            if (!small || !button) return;
            const toppings = selectedToppings(line);
            const toppingNames = toppings
                .slice(0, 2)
                .map((topping) => topping.name);
            const preparation = line.dataset.preparation
                ? [line.dataset.preparation]
                : [];
            const toppingSummary = toppings.length
                ? [
                      ...toppingNames,
                      ...(toppings.length > 2
                          ? [`+${toppings.length - 2}`]
                          : []),
                  ]
                : [];
            small.textContent = [
                `Size ${line.dataset.size || "M"}`,
                ...toppingSummary,
                ...preparation,
            ].join(" · ");
            button.textContent =
                toppings.length || Number(line.dataset.sizeExtra || 0)
                    ? "Sửa size / topping"
                    : "+ Chọn size / topping";
        };

        const prepareCartLine = (line) => {
            const productId = line.dataset.product || "";
            const small = line.querySelector(".pos-line-name small");
            if (small && !line.dataset.preparation) {
                line.dataset.preparation = small.textContent
                    .replace(/(?:^| · )Size (?:M|L|XL)/g, "")
                    .trim();
            }
            line.dataset.size ||= "M";
            line.dataset.sizeExtra ||= "0";
            line.dataset.toppings ||= "[]";
            if (!customizableProducts.has(productId)) return;
            const name = line.querySelector(".pos-line-name");
            if (!name || name.querySelector(".pos-line-customize")) return;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "pos-line-customize";
            button.dataset.customizeItem = "";
            button.textContent = "+ Chọn size / topping";
            button.setAttribute(
                "aria-label",
                `Chọn size hoặc topping cho ${line.querySelector(".pos-line-name strong")?.textContent || "món này"}`,
            );
            name.append(button);
        };

        const renderServiceMode = () => {
            const takeaway = serviceMode === "takeaway";
            posScreen?.classList.toggle("is-takeaway", takeaway);
            serviceModeButtons.forEach((button) => {
                const active = button.dataset.serviceMode === serviceMode;
                button.classList.toggle("selected", active);
                button.setAttribute("aria-pressed", String(active));
            });
            if (orderStatus)
                orderStatus.textContent = !orderPaid
                    ? "GIỎ HÀNG · CHƯA TẠO ĐƠN"
                    : takeaway || selectedTable
                      ? "HOÀN THÀNH"
                      : "ĐANG CHỌN BÀN";
            if (orderContext) {
                const icon = document.createElement("i");
                icon.className = takeaway
                    ? "fa-solid fa-bag-shopping"
                    : "fa-solid fa-chair";
                icon.setAttribute("aria-hidden", "true");
                const details = takeaway
                    ? " Mang đi"
                    : selectedTable
                      ? ` Bàn ${selectedTable} · ${selectedGuests} khách `
                      : " Chọn bàn sau khi thanh toán";
                orderContext.replaceChildren(
                    icon,
                    document.createTextNode(details),
                );
            }
        };

        const updateCart = () => {
            let subtotal = 0;
            let count = 0;
            lines.querySelectorAll(".pos-cart-line").forEach((line) => {
                const quantity = Number(
                    line.querySelector(".pos-qty b")?.textContent || 0,
                );
                const unitPrice = lineUnitPrice(line);
                const lineTotal = quantity * unitPrice;
                subtotal += lineTotal;
                count += 1;
                const priceLabel = line.querySelector(".pos-line-price");
                if (priceLabel) priceLabel.textContent = formatMoney(lineTotal);
            });
            const total = Math.round(subtotal * (1 - discountRate / 100));
            if (subtotalLabel)
                subtotalLabel.textContent = formatMoney(subtotal);
            if (discountLabel)
                discountLabel.textContent = discountRate
                    ? `-${formatMoney(subtotal - total)} (${discountRate}%)`
                    : "Thêm mã giảm giá";
            document
                .querySelectorAll(
                    ".pos-grand-total strong,.pos-checkout strong",
                )
                .forEach((label) => {
                    label.textContent = formatMoney(total);
                });
            if (emptyMessage) emptyMessage.hidden = count > 0;
        };

        const addProduct = (card) => {
            const name = card
                .querySelector(".pos-product-info strong")
                ?.textContent.trim();
            const price = Number(
                (
                    card.querySelector(".pos-product-info b")?.textContent || ""
                ).replace(/\D/g, ""),
            );
            const productId = card.dataset.product || name;
            if (lineTemplate) {
                const line =
                    lineTemplate.content.firstElementChild.cloneNode(true);
                line.dataset.product = productId;
                line.dataset.price = String(price);
                const miniArt = line.querySelector(".pos-mini-art");
                miniArt.dataset.product = productId;
                miniArt.textContent =
                    card
                        .querySelector(".pos-product-art")
                        ?.textContent.trim() || "☕";
                line.querySelector(".pos-line-name strong").textContent = name;
                line.querySelector(".pos-line-name small").textContent =
                    `Size M`;
                line.querySelector(".pos-line-price").textContent =
                    formatMoney(price);
                line.querySelector("[data-remove-item]").setAttribute(
                    "aria-label",
                    `Xóa ${name}`,
                );
                line.querySelector("[data-qty-minus]").setAttribute(
                    "aria-label",
                    `Giảm ${name}`,
                );
                line.querySelector("[data-qty-plus]").setAttribute(
                    "aria-label",
                    `Tăng ${name}`,
                );
                prepareCartLine(line);
                lines.append(line);
            }
            updateCart();
        };

        grid.addEventListener("click", (event) => {
            const card = event.target.closest(".pos-product");
            if (!card) return;
            event.preventDefault();
            addProduct(card);
        });

        serviceModeButtons.forEach((button) =>
            button.addEventListener("click", () => {
                if (orderPaid) {
                    showToast("Hãy tạo đơn mới nếu muốn đổi hình thức phục vụ.");
                    return;
                }
                serviceMode =
                    button.dataset.serviceMode === "takeaway"
                        ? "takeaway"
                        : "dine-in";
                renderServiceMode();
            }),
        );

        lines.addEventListener("click", (event) => {
            const line = event.target.closest(".pos-cart-line");
            if (!line) return;
            if (event.target.closest("[data-customize-item]")) {
                editingLine = line;
                if (modifierProductName)
                    modifierProductName.textContent =
                        line.querySelector(".pos-line-name strong")
                            ?.textContent || "Tùy chỉnh món";
                if (modifierForm) {
                    modifierForm
                        .querySelectorAll('input[name="size"]')
                        .forEach((input) => {
                            input.checked =
                                input.value === (line.dataset.size || "M");
                        });
                    modifierForm
                        .querySelectorAll('input[name="toppings"]')
                        .forEach((input) => {
                            input.checked = selectedToppings(line).some(
                                (topping) => topping.id === input.value,
                            );
                        });
                    updateModifierExtra();
                }
                modifierDialog?.showModal();
                return;
            }
            const quantity = line.querySelector(".pos-qty b");
            if (event.target.closest("[data-qty-plus]"))
                quantity.textContent = String(Number(quantity.textContent) + 1);
            else if (event.target.closest("[data-qty-minus]")) {
                const next = Number(quantity.textContent) - 1;
                if (next < 1) line.remove();
                else quantity.textContent = String(next);
            } else if (event.target.closest("[data-remove-item]"))
                line.remove();
            else return;
            updateCart();
        });

        const search = document.querySelector(".pos-search input");
        let activeCategory = "Tất cả";
        const filterProducts = () => {
            const query = (search?.value || "").trim().toLocaleLowerCase("vi");
            cards.forEach((card) => {
                const name =
                    card
                        .querySelector(".pos-product-info strong")
                        ?.textContent.toLocaleLowerCase("vi") || "";
                const category =
                    card
                        .querySelector(".pos-product-info small")
                        ?.textContent.split("·")[0]
                        .trim() || "";
                card.hidden =
                    !name.includes(query) ||
                    (activeCategory !== "Tất cả" &&
                        category !== activeCategory);
            });
        };
        search?.addEventListener("input", filterProducts);
        document.querySelectorAll(".pos-categories button").forEach((button) =>
            button.addEventListener("click", () => {
                document
                    .querySelector(".pos-categories .selected")
                    ?.classList.remove("selected");
                button.classList.add("selected");
                activeCategory =
                    button.textContent.replace(/\d+/g, "").trim() || "Tất cả";
                filterProducts();
            }),
        );

        const openDialog = (selector) =>
            document.querySelector(selector)?.showModal();
        const customerDialog = document.querySelector("#pos-customer-dialog");
        const customerSearchForm = customerDialog?.querySelector(".pos-customer-search");
        const customerCreateForm = customerDialog?.querySelector("[data-customer-create-form]");
        const customerResults = customerDialog?.querySelector("[data-customer-results]");
        const customerFeedback = customerDialog?.querySelector("[data-customer-feedback]");
        const openCustomerDialog = () => {
            customerSearchForm?.reset();
            if (customerResults) customerResults.hidden = true;
            if (customerCreateForm) customerCreateForm.hidden = true;
            if (customerFeedback)
                customerFeedback.textContent = "Nhập ít nhất 3 số để bắt đầu tìm.";
            customerDialog?.showModal();
        };
        document
            .querySelector(".pos-customer")
            ?.addEventListener("click", () =>
                openCustomerDialog(),
            );
        document
            .querySelector(".pos-customer-entry button")
            ?.addEventListener("click", () =>
                openCustomerDialog(),
            );
        discountLabel?.addEventListener("click", () => {
            const form = document.querySelector("#pos-discount-dialog form");
            if (form) form.elements.rate.value = String(discountRate || 10);
            openDialog("#pos-discount-dialog");
        });
        document
            .querySelector(".pos-note")
            ?.addEventListener("click", () => openDialog("#pos-note-dialog"));

        document
            .querySelector(".pos-new-order")
            ?.addEventListener("click", () => {
                lines.replaceChildren();
                discountRate = 0;
                const noteLabel = document.querySelector(".pos-note span");
                if (noteLabel)
                    noteLabel.textContent =
                        "Th\u00eam ghi ch\u00fa cho \u0111\u01a1n";
                if (customerName) customerName.textContent = "Khách lẻ";
                if (customerNote)
                    customerNote.textContent =
                        "Thêm số điện thoại để tích điểm";
                selectedTable = "";
                selectedGuests = "2";
                orderPaid = false;
                if (orderTitle) orderTitle.textContent = "Giỏ hàng";
                if (orderCode) orderCode.hidden = true;
                if (checkoutButton) checkoutButton.disabled = false;
                const checkoutLabel = checkoutButton?.querySelector("span");
                if (checkoutLabel)
                    checkoutLabel.innerHTML =
                        '<i class="fa-solid fa-receipt"></i> Thanh toán';
                renderServiceMode();
                updateCart();
                showToast("Đã làm trống đơn hiện tại.");
            });

        checkoutButton?.addEventListener("click", () => {
                if (!lines.querySelector(".pos-cart-line")) {
                    showToast("Hãy chọn ít nhất một món.");
                    return;
                }
                if (orderPaid) {
                    if (serviceMode === "dine-in" && !selectedTable)
                        tableDialog?.showModal();
                    return;
                }
                orderPaid = true;
                renderServiceMode();
                if (serviceMode === "takeaway") {
                    if (orderTitle) orderTitle.textContent = "Đơn hàng";
                    if (orderCode) orderCode.hidden = false;
                    showToast("Đã thanh toán. Đơn mang đi đã hoàn thành.");
                    checkoutButton.disabled = true;
                    const checkoutLabel = checkoutButton.querySelector("span");
                    if (checkoutLabel)
                        checkoutLabel.innerHTML =
                            '<i class="fa-solid fa-check"></i> Đã thanh toán';
                    return;
                }
                const tableForm = tableDialog?.querySelector("form");
                tableForm?.reset();
                const checkoutLabel = checkoutButton?.querySelector("span");
                if (checkoutLabel)
                    checkoutLabel.innerHTML =
                        '<i class="fa-solid fa-chair"></i> Chọn bàn';
                tableDialog?.showModal();
            });

        tableDialog?.addEventListener("cancel", (event) => {
            if (orderPaid && serviceMode === "dine-in" && !selectedTable)
                event.preventDefault();
        });

        const bindTemporaryForm = (selector, callback) => {
            const form = document.querySelector(selector);
            form?.addEventListener("submit", (event) => {
                event.preventDefault();
                callback(new FormData(form));
                form.closest("dialog")?.close();
                form.reset();
            });
        };
        const updateModifierExtra = () => {
            if (!modifierForm || !modifierExtraLabel) return;
            const selectedSize = modifierForm.querySelector(
                'input[name="size"]:checked',
            );
            const sizeExtra = Number(selectedSize?.dataset.extra || 0);
            const toppingsExtra = [
                ...modifierForm.querySelectorAll(
                    'input[name="toppings"]:checked',
                ),
            ].reduce(
                (sum, input) => sum + Number(toppingPrices[input.value] || 0),
                0,
            );
            modifierExtraLabel.textContent = formatMoney(
                sizeExtra + toppingsExtra,
            );
        };
        modifierForm?.addEventListener("change", updateModifierExtra);
        modifierForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!editingLine) return;
            const selectedSize = modifierForm.querySelector(
                'input[name="size"]:checked',
            );
            const toppingLabels = new Map(
                [
                    ...modifierForm.querySelectorAll('input[name="toppings"]'),
                ].map((input) => [
                    input.value,
                    input.dataset.label || input.value,
                ]),
            );
            const toppings = [
                ...modifierForm.querySelectorAll(
                    'input[name="toppings"]:checked',
                ),
            ].map((input) => ({
                id: input.value,
                name: toppingLabels.get(input.value),
                price: toppingPrices[input.value] || 0,
            }));
            editingLine.dataset.size = selectedSize?.value || "M";
            editingLine.dataset.sizeExtra = String(
                Number(selectedSize?.dataset.extra || 0),
            );
            editingLine.dataset.toppings = JSON.stringify(toppings);
            renderLineOptions(editingLine);
            updateCart();
            editingLine = null;
            modifierDialog?.close();
            showToast("Đã cập nhật size và topping cho món.");
        });
        customerSearchForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            const phoneInput = customerSearchForm.querySelector('[name="phone"]');
            const query = String(phoneInput?.value || "").replace(/\D/g, "");
            if (query.length < 3) {
                if (customerFeedback)
                    customerFeedback.textContent = "Vui lòng nhập ít nhất 3 số điện thoại.";
                if (customerResults) customerResults.hidden = true;
                return;
            }
            let matches = 0;
            customerDialog?.querySelectorAll("[data-pick-customer]").forEach((button) => {
                const phone = String(button.dataset.phone || "").replace(/\D/g, "");
                const found = phone.includes(query);
                button.hidden = !found;
                if (found) matches += 1;
            });
            if (customerResults) customerResults.hidden = matches === 0;
            if (customerFeedback)
                customerFeedback.textContent = matches
                    ? `Tìm thấy ${matches} hồ sơ khách hàng.`
                    : "Chưa tìm thấy khách hàng bằng số này. Bạn có thể tạo hồ sơ mới.";
        });
        customerResults?.addEventListener("click", (event) => {
            const result = event.target.closest("[data-pick-customer]");
            if (!result) return;
            if (customerName) customerName.textContent = result.dataset.name || "Khách hàng";
            if (customerNote)
                customerNote.textContent = `${result.dataset.phone || ""} · ${result.dataset.tier || "Thành viên"} · ${result.dataset.points || "0"} điểm`;
            customerDialog?.close();
            showToast(`Đã gắn khách ${result.dataset.name || "hàng"} vào đơn.`);
        });
        customerDialog?.querySelector("[data-new-customer-toggle]")?.addEventListener("click", () => {
            if (!customerCreateForm) return;
            customerCreateForm.hidden = !customerCreateForm.hidden;
            const searchPhone = customerSearchForm?.querySelector('[name="phone"]')?.value || "";
            const createPhone = customerCreateForm.querySelector('[name="phone"]');
            if (createPhone && !customerCreateForm.hidden)
                createPhone.value = searchPhone;
            if (!customerCreateForm.hidden)
                customerCreateForm.querySelector('[name="name"]')?.focus();
        });
        customerCreateForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            const values = new FormData(customerCreateForm);
            const name = String(values.get("name") || "").trim();
            const phone = String(values.get("phone") || "").trim();
            if (!name || !phone) return;
            if (customerName) customerName.textContent = name;
            if (customerNote) customerNote.textContent = `${phone} · Khách mới`;
            customerDialog?.close();
            customerCreateForm.reset();
            customerCreateForm.hidden = true;
            showToast(`Đã gắn ${name} tạm thời vào đơn.`);
        });
        bindTemporaryForm("#pos-table-dialog form", (values) => {
            selectedTable = String(values.get("table") || "");
            selectedGuests = String(values.get("guests") || "2");
            renderServiceMode();
            if (orderTitle) orderTitle.textContent = "Đơn hàng";
            if (orderCode) orderCode.hidden = false;
            if (checkoutButton) checkoutButton.disabled = true;
            const checkoutLabel = checkoutButton?.querySelector("span");
            if (checkoutLabel)
                checkoutLabel.innerHTML =
                    '<i class="fa-solid fa-check"></i> Đã thanh toán';
            showToast(`Đơn hàng đã hoàn thành. Bàn ${selectedTable} đã được chọn.`);
        });
        bindTemporaryForm("#pos-discount-dialog form", (values) => {
            discountRate = Math.max(
                0,
                Math.min(100, Number(values.get("rate")) || 0),
            );
            updateCart();
            showToast("Ưu đãi đã áp dụng tạm thời.");
        });
        bindTemporaryForm("#pos-note-dialog form", (values) => {
            const note = String(values.get("note") || "").trim();
            const noteText = document.querySelector(".pos-note span");
            if (noteText)
                noteText.textContent = note
                    ? "Ghi chú: " + note
                    : "Thêm ghi chú cho đơn";
            showToast(
                note
                    ? "Ghi chú đã được thêm tạm thời."
                    : "Đã xóa ghi chú tạm thời.",
            );
        });

        lines
            .querySelectorAll(".pos-cart-line")
            .forEach((line) => prepareCartLine(line));
        renderServiceMode();
        updateCart();
    }

    function initTables() {
        const page = document.querySelector(".page-tables");
        if (!page) return;
        const statuses = {
            vacant: {
                label: "Trống",
                icon: "fa-solid fa-chair",
                className: "",
            },
            serving: {
                label: "Đang phục vụ",
                icon: "fa-solid fa-utensils",
                className: "busy",
            },
            booked: {
                label: "Đặt trước",
                icon: "fa-regular fa-clock",
                className: "booked",
            },
            cleaning: {
                label: "Cần dọn",
                icon: "fa-solid fa-broom",
                className: "cleaning",
            },
        };
        const tabs = page.querySelector(".table-floor-tabs");
        const floorPanels = page.querySelector(".floor-panels");
        const detailCode = page.querySelector("[data-detail-code]");
        const detailZone = page.querySelector("[data-detail-zone]");
        const detailSeats = page.querySelector("[data-detail-seats]");
        const detailState = page.querySelector("[data-detail-state]");
        const detailStatus = page.querySelector("[data-detail-status]");
        const statusEditor = page.querySelector(".table-status-editor");
        const detailAction = page.querySelector(".table-detail-action");
        const detailHint = page.querySelector(".table-detail-hint");
        const statusSelect = page.querySelector("[data-status-select]");
        const statusPicker = page.querySelector("[data-status-picker]");
        const statusTrigger = page.querySelector("#table-status-trigger");
        const statusTriggerLabel = page.querySelector(
            "[data-status-trigger-label]",
        );
        const statusTriggerIcon = page.querySelector(
            "[data-status-trigger-icon]",
        );
        const statusMenu = page.querySelector("[data-status-menu]");
        const bookingTimeWrap = page.querySelector("[data-booking-time-wrap]");
        const bookingTimeInput = page.querySelector(
            "[data-booking-time-input]",
        );
        const updateButton = page.querySelector("[data-update-table-status]");
        const deleteRule = page.querySelector("[data-delete-rule]");
        const floorDialog = page.querySelector("#table-floor-dialog");
        const tableDialog = page.querySelector("#table-create-dialog");
        const floorForm = floorDialog?.querySelector("[data-table-floor-form]");
        const tableForm = tableDialog?.querySelector(
            "[data-table-create-form]",
        );
        const tableFloorSelect = tableForm?.querySelector(
            "[data-table-floor-select]",
        );
        let selectedTile = null;
        let floorButtons = [];
        let floors = [];
        let tiles = [];

        const refreshElements = () => {
            floorButtons = [
                ...page.querySelectorAll(
                    ".table-floor-tabs [data-floor-target]",
                ),
            ];
            floors = [...page.querySelectorAll(".floor-card[data-floor]")];
            tiles = [...page.querySelectorAll(".table-tile")];
        };

        const getStatus = (tile) =>
            tile.dataset.status ||
            (tile.classList.contains("busy")
                ? "serving"
                : tile.classList.contains("booked")
                  ? "booked"
                  : tile.classList.contains("cleaning")
                    ? "cleaning"
                    : "vacant");

        const syncDeleteAvailability = (tile) => {
            const blocked = !tile || ["serving", "booked"].includes(getStatus(tile));
            if (deleteTableButton) deleteTableButton.disabled = blocked;
            if (deleteRule) {
                deleteRule.textContent = !tile
                    ? "Chọn một bàn để xem thao tác có thể dùng."
                    : blocked
                      ? "Bàn đang phục vụ hoặc đã đặt trước; hãy cập nhật trạng thái trước khi xóa."
                      : "Bàn này có thể xóa khỏi sơ đồ trong phiên hiện tại.";
            }
        };

        const updateTile = (tile, status, bookingTime = "") => {
            const config = statuses[status];
            if (!config) return;
            tile.dataset.status = status;
            tile.dataset.bookingTime = status === "booked" ? bookingTime : "";
            tile.classList.remove("busy", "booked", "cleaning");
            if (config.className) tile.classList.add(config.className);
            const icon = tile.querySelector(".tile-top i");
            if (icon) icon.className = config.icon;
            const label = tile.querySelector("small");
            if (label) label.textContent = config.label;
            const meta = tile.querySelector("em");
            if (meta)
                meta.textContent =
                    status === "booked" && bookingTime
                        ? `${bookingTime} · ${tile.dataset.seats}`
                        : tile.dataset.seats || "";
        };

        const updateFloorCounts = () => {
            floors.forEach((floor) => {
                const count = floor.querySelectorAll(".table-tile").length;
                const tab = floorButtons.find(
                    (button) =>
                        button.dataset.floorTarget === floor.dataset.floor,
                );
                const tabCount = tab?.querySelector("small");
                const panelCount = floor.querySelector(
                    ".floor-card-head > span",
                );
                if (tabCount) tabCount.textContent = `${count} bàn`;
                if (panelCount) panelCount.textContent = `${count} bàn`;
            });
        };

        const deleteFloorButton = page.querySelector("[data-delete-floor]");
        const deleteTableButton = page.querySelector("[data-delete-table]");

        const removeSelectedFloor = () => {
            const activeButton = tabs?.querySelector("[data-floor-target].active");
            const floorId = activeButton?.dataset.floorTarget;
            const floor = floors.find((item) => item.dataset.floor === floorId);
            if (!floor) return;
            if (floors.length <= 1) {
                showToast("Cần giữ lại ít nhất một khu vực.");
                return;
            }
            if ([...floor.querySelectorAll(".table-tile")].some((tile) => ["serving", "booked"].includes(getStatus(tile)))) {
                showToast("Hãy kết thúc đơn hoặc hủy lịch đặt trước trong khu vực này trước khi xóa.");
                return;
            }
            const name = floor.querySelector("h3")?.textContent.trim() || "khu vực này";
            if (!window.confirm(`Xóa ${name} và các bàn thuộc khu vực này?`)) return;
            const nextFloor = floors.find((item) => item !== floor);
            floor.remove();
            activeButton.remove();
            refreshElements();
            updateFloorCounts();
            updateCounts();
            activateFloor(nextFloor.dataset.floor);
            showToast(`Đã xóa ${name} khỏi giao diện hiện tại.`);
        };

        const removeSelectedTable = () => {
            if (!selectedTile) return;
            const status = getStatus(selectedTile);
            if (["serving", "booked"].includes(status)) {
                showToast("Không thể xóa bàn đang phục vụ hoặc đã có lịch đặt trước.");
                return;
            }
            const code = selectedTile.querySelector("strong")?.textContent.trim() || "bàn này";
            if (!window.confirm(`Xóa bàn ${code} khỏi sơ đồ?`)) return;
            const floor = selectedTile.closest(".floor-card");
            selectedTile.remove();
            selectedTile = null;
            refreshElements();
            updateFloorCounts();
            updateCounts();
            activateFloor(floor.dataset.floor);
            showToast(`Đã xóa bàn ${code} khỏi giao diện hiện tại.`);
        };

        const updateCounts = () => {
            const counts = {
                total: tiles.length,
                vacant: 0,
                serving: 0,
                booked: 0,
                cleaning: 0,
            };
            tiles.forEach((tile) => {
                counts[getStatus(tile)] += 1;
            });
            Object.entries(counts).forEach(([status, count]) => {
                const counter = page.querySelector(
                    `[data-table-count="${status}"]`,
                );
                if (counter) counter.textContent = count;
            });
        };

        const syncBookingTime = () => {
            if (bookingTimeWrap && statusSelect)
                bookingTimeWrap.hidden = statusSelect.value !== "booked";
        };

        const renderStatusPicker = (status) => {
            const config = statuses[status] || statuses.vacant;
            if (statusPicker) statusPicker.dataset.status = status;
            if (statusTriggerLabel)
                statusTriggerLabel.textContent = config.label;
            if (statusTriggerIcon) statusTriggerIcon.className = config.icon;
            page.querySelectorAll("[data-status-option]").forEach((option) => {
                const selected = option.dataset.statusOption === status;
                option.classList.toggle("selected", selected);
                option.setAttribute("aria-selected", String(selected));
            });
        };

        const selectTile = (tile) => {
            if (!tile) return;
            selectedTile = tile;
            syncDeleteAvailability(tile);
            if (statusEditor) statusEditor.hidden = false;
            if (detailAction) detailAction.hidden = false;
            if (detailHint) detailHint.hidden = false;
            tiles.forEach((item) => {
                item.classList.toggle("is-selected", item === tile);
                item.setAttribute(
                    "aria-pressed",
                    item === tile ? "true" : "false",
                );
            });
            const floor = tile.closest(".floor-card");
            const state = getStatus(tile);
            const status = statuses[state].label;
            if (detailCode)
                detailCode.textContent =
                    tile.querySelector("strong")?.textContent || "";
            if (detailZone)
                detailZone.textContent =
                    floor?.querySelector("h3")?.textContent || "";
            if (detailSeats) detailSeats.textContent = tile.dataset.seats || "";
            if (detailState) detailState.textContent = status;
            if (detailStatus) {
                detailStatus.className = "detail-status " + state;
                detailStatus.textContent = status;
            }
            if (statusSelect) statusSelect.value = state;
            renderStatusPicker(state);
            if (bookingTimeInput)
                bookingTimeInput.value = tile.dataset.bookingTime || "";
            syncBookingTime();
        };

        const activateFloor = (floorId, preferredTile = null) => {
            floorButtons.forEach((button) => {
                const active = button.dataset.floorTarget === floorId;
                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
            });
            floors.forEach((floor) => {
                floor.hidden = floor.dataset.floor !== floorId;
            });
            const firstTile =
                preferredTile?.closest(".floor-card")?.dataset.floor === floorId
                    ? preferredTile
                    : page.querySelector(
                          `.floor-card[data-floor="${floorId}"] .table-tile`,
                      );
            if (firstTile) {
                selectTile(firstTile);
            } else {
                selectedTile = null;
                syncDeleteAvailability(null);
                if (statusEditor) statusEditor.hidden = true;
                if (detailAction) detailAction.hidden = true;
                if (detailHint) detailHint.hidden = true;
                if (detailCode) detailCode.textContent = "Chưa có bàn";
                if (detailZone)
                    detailZone.textContent =
                        page.querySelector(
                            `.floor-card[data-floor="${floorId}"] h3`,
                        )?.textContent || "";
                if (detailSeats) detailSeats.textContent = "—";
                if (detailState) detailState.textContent = "Chưa có bàn";
                if (detailStatus) {
                    detailStatus.className = "detail-status";
                    detailStatus.textContent = "Chưa có bàn";
                }
                if (statusSelect) statusSelect.value = "vacant";
                renderStatusPicker("vacant");
                syncBookingTime();
            }
        };

        const bindFloorButton = (button) =>
            button.addEventListener("click", () =>
                activateFloor(button.dataset.floorTarget),
            );

        const addFloorToPage = ({ id, name, description }) => {
            if (
                !id ||
                !name ||
                page.querySelector(`.floor-card[data-floor="${id}"]`)
            )
                return null;
            const tab = document.createElement("button");
            tab.type = "button";
            tab.dataset.floorTarget = id;
            tab.append(document.createTextNode(name));
            const tabCount = document.createElement("small");
            tabCount.textContent = "0 bàn";
            tab.append(tabCount);
            tabs.append(tab);

            const floor = document.createElement("section");
            floor.className = "floor-card";
            floor.dataset.floor = id;
            floor.setAttribute("aria-label", `Sơ đồ bàn ${name}`);
            floor.hidden = true;
            const head = document.createElement("div");
            head.className = "floor-card-head";
            const headingCopy = document.createElement("div");
            const heading = document.createElement("h3");
            heading.textContent = name;
            const descriptionText = document.createElement("p");
            descriptionText.textContent = description || "Khu vực mới";
            const count = document.createElement("span");
            count.textContent = "0 bàn";
            headingCopy.append(heading, descriptionText);
            head.append(headingCopy, count);
            const grid = document.createElement("div");
            grid.className = "table-grid";
            floor.append(head, grid);
            floorPanels.append(floor);
            refreshElements();
            return floor;
        };

        const addTableToFloor = ({ floorId, code, seats }) => {
            const floor = floors.find((item) => item.dataset.floor === floorId);
            if (
                !floor ||
                !/^[A-Z0-9-]{2,8}$/.test(code) ||
                tiles.some(
                    (tile) =>
                        tile.querySelector("strong")?.textContent.trim() ===
                        code,
                )
            )
                return null;
            const tile = document.createElement("button");
            tile.type = "button";
            tile.className = "table-tile";
            tile.dataset.seats = `${seats} chỗ`;
            tile.dataset.status = "vacant";
            tile.setAttribute("aria-pressed", "false");
            const top = document.createElement("span");
            top.className = "tile-top";
            const icon = document.createElement("i");
            icon.className = statuses.vacant.icon;
            icon.setAttribute("aria-hidden", "true");
            const dot = document.createElement("span");
            dot.className = "tile-dot";
            top.append(icon, dot);
            const codeLabel = document.createElement("strong");
            codeLabel.textContent = code;
            const stateLabel = document.createElement("small");
            stateLabel.textContent = statuses.vacant.label;
            const seatLabel = document.createElement("em");
            seatLabel.textContent = `${seats} chỗ`;
            tile.append(top, codeLabel, stateLabel, seatLabel);
            floor.querySelector(".table-grid").append(tile);
            refreshElements();
            return tile;
        };

        refreshElements();
        floorButtons.forEach(bindFloorButton);
        tiles.forEach((tile) =>
            tile.addEventListener("click", () => selectTile(tile)),
        );
        updateFloorCounts();
        updateCounts();
        const initialFloorId =
            page.querySelector(".table-floor-tabs .active")?.dataset
                .floorTarget || floors[0]?.dataset.floor;
        activateFloor(
            initialFloorId,
            page.querySelector(".table-tile.is-selected"),
        );

        page.querySelector("[data-add-floor]")?.addEventListener("click", () =>
            floorDialog?.showModal(),
        );
        deleteFloorButton?.addEventListener("click", removeSelectedFloor);
        deleteTableButton?.addEventListener("click", removeSelectedTable);
        page.querySelector("[data-add-table]")?.addEventListener(
            "click",
            () => {
                if (tableFloorSelect) {
                    tableFloorSelect.replaceChildren();
                    floors.forEach((floor) => {
                        const option = document.createElement("option");
                        option.value = floor.dataset.floor;
                        option.textContent =
                            floor.querySelector("h3")?.textContent ||
                            floor.dataset.floor;
                        option.selected = !floor.hidden;
                        tableFloorSelect.append(option);
                    });
                }
                tableDialog?.showModal();
            },
        );
        statusTrigger?.addEventListener("click", () => {
            const isOpen =
                statusTrigger.getAttribute("aria-expanded") === "true";
            statusTrigger.setAttribute("aria-expanded", String(!isOpen));
            if (statusMenu) statusMenu.hidden = isOpen;
            if (statusPicker) statusPicker.classList.toggle("is-open", !isOpen);
        });
        statusMenu?.addEventListener("click", (event) => {
            const option = event.target.closest("[data-status-option]");
            if (!option || !statusSelect) return;
            statusSelect.value = option.dataset.statusOption;
            renderStatusPicker(statusSelect.value);
            statusMenu.hidden = true;
            statusTrigger?.setAttribute("aria-expanded", "false");
            statusPicker?.classList.remove("is-open");
            statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
        });
        statusPicker?.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || statusMenu?.hidden) return;
            statusMenu.hidden = true;
            statusTrigger?.setAttribute("aria-expanded", "false");
            statusPicker.classList.remove("is-open");
            statusTrigger?.focus();
        });
        document.addEventListener("click", (event) => {
            if (!statusPicker?.contains(event.target)) {
                if (statusMenu) statusMenu.hidden = true;
                statusTrigger?.setAttribute("aria-expanded", "false");
                statusPicker?.classList.remove("is-open");
            }
        });
        floorForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            const values = new FormData(floorForm);
            const name = String(values.get("name") || "")
                .trim()
                .slice(0, 40);
            const description =
                String(values.get("description") || "")
                    .trim()
                    .slice(0, 80) || "Khu vực mới";
            if (!name) return;
            if (
                floors.some(
                    (floor) =>
                        floor
                            .querySelector("h3")
                            ?.textContent.toLocaleLowerCase("vi") ===
                        name.toLocaleLowerCase("vi"),
                )
            ) {
                showToast("Tên khu vực này đã tồn tại.");
                return;
            }
            const id = `custom-floor-${Date.now().toString(36)}`;
            const floor = addFloorToPage({ id, name, description });
            if (!floor) return;
            const tab = floorButtons.find(
                (button) => button.dataset.floorTarget === id,
            );
            if (tab) bindFloorButton(tab);
            updateFloorCounts();
            activateFloor(id);
            floorDialog.close();
            floorForm.reset();
            showToast("Đã thêm khu vực cho phiên làm việc này.");
        });
        tableForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            const values = new FormData(tableForm);
            const floorId = String(values.get("floor") || "");
            const code = String(values.get("code") || "")
                .trim()
                .toUpperCase();
            const seats = Math.max(
                1,
                Math.min(20, Number(values.get("seats")) || 4),
            );
            if (!/^[A-Z0-9-]{2,8}$/.test(code)) {
                showToast("Mã bàn gồm 2–8 ký tự chữ hoặc số.");
                return;
            }
            if (
                tiles.some(
                    (tile) =>
                        tile
                            .querySelector("strong")
                            ?.textContent.trim()
                            .toUpperCase() === code,
                )
            ) {
                showToast("Mã bàn này đã được sử dụng.");
                return;
            }
            const tile = addTableToFloor({ floorId, code, seats });
            if (!tile) return;
            tile.addEventListener("click", () => selectTile(tile));
            updateFloorCounts();
            updateCounts();
            activateFloor(floorId);
            selectTile(tile);
            tableDialog.close();
            tableForm.reset();
            const seatsInput = tableForm.querySelector('[name="seats"]');
            if (seatsInput) seatsInput.value = "4";
            showToast(`Đã thêm bàn ${code} cho phiên làm việc này.`);
        });
        statusSelect?.addEventListener("change", syncBookingTime);
        updateButton?.addEventListener("click", () => {
            if (!selectedTile || !statusSelect || !statuses[statusSelect.value])
                return;
            updateTile(
                selectedTile,
                statusSelect.value,
                bookingTimeInput?.value || "",
            );
            updateCounts();
            selectTile(selectedTile);
            showToast(
                `Đã cập nhật bàn ${selectedTile.querySelector("strong")?.textContent.trim()} trong phiên này.`,
            );
        });
    }

    function initProductCategories() {
        const page = document.querySelector(
            ".page-products, .page-product-categories",
        );
        if (!page) return;

        const defaults = [
            {
                id: "coffee",
                name: "Cà phê",
                description: "Cà phê và thức uống matcha",
            },
            { id: "tea", name: "Trà", description: "Trà trái cây và trà tươi" },
            {
                id: "bingsu",
                name: "Bingsu",
                description: "Món đá bào mát lạnh",
            },
            {
                id: "cake",
                name: "Bánh",
                description: "Bánh ngọt dùng tại quán",
            },
        ];
        const icons = {
            coffee: "fa-mug-hot",
            tea: "fa-leaf",
            bingsu: "fa-ice-cream",
            cake: "fa-cake-candles",
        };
        const productCounts = { coffee: 3, tea: 2, bingsu: 1, cake: 2 };
        const cards = [...page.querySelectorAll(".product-cards .simple-card")];
        const grid = page.querySelector("#product-category-grid");
        const tabs = page.querySelector(".product-filters");
        const dialog =
            page.querySelector("#product-category-dialog") ||
            document.querySelector("#product-category-dialog");
        const form = dialog?.querySelector("form");
        let categories = defaults.map((category) => ({ ...category }));

        cards.forEach((card) => {
            const originalName = card
                .querySelector("p")
                ?.textContent.split("·")[0]
                .trim();
            card.dataset.categoryId =
                defaults.find((category) => category.name === originalName)
                    ?.id || "";
        });

        const countFor = (id) =>
            page.classList.contains("page-product-categories")
                ? productCounts[id] || 0
                : cards.filter((card) => card.dataset.categoryId === id).length;
        const render = () => {
            grid?.replaceChildren();
            tabs?.replaceChildren();

            const addTab = (id, label, count) => {
                if (!tabs) return;
                const button = document.createElement("button");
                button.type = "button";
                button.dataset.categoryId = id;
                button.classList.toggle("active", productCategoryFilter === id);
                button.textContent = `${label} · ${count}`;
                tabs.append(button);
            };
            addTab("all", "Tất cả", cards.length);

            categories.forEach((category) => {
                const count = countFor(category.id);
                addTab(category.id, category.name, count);
                if (!grid) return;

                const article = document.createElement("article");
                article.className = "product-category-card";
                article.dataset.categoryId = category.id;
                const icon = document.createElement("span");
                icon.className = "product-category-icon";
                icon.innerHTML = `<i class="fa-solid ${icons[category.id] || "fa-layer-group"}" aria-hidden="true"></i>`;
                const copy = document.createElement("div");
                copy.className = "product-category-copy";
                const name = document.createElement("strong");
                name.textContent = category.name;
                const description = document.createElement("p");
                description.textContent =
                    category.description || "Danh mục sản phẩm";
                const total = document.createElement("span");
                total.className = "product-category-count";
                total.textContent = `${count} sản phẩm`;
                copy.append(name, description, total);
                const actions = document.createElement("div");
                actions.className = "product-category-actions";
                const edit = document.createElement("button");
                edit.type = "button";
                edit.dataset.categoryAction = "edit";
                edit.setAttribute(
                    "aria-label",
                    `Sửa danh mục ${category.name}`,
                );
                edit.innerHTML =
                    '<i class="fa-solid fa-pen" aria-hidden="true"></i>';
                actions.append(edit);
                if (count === 0) {
                    const remove = document.createElement("button");
                    remove.type = "button";
                    remove.dataset.categoryAction = "remove";
                    remove.setAttribute(
                        "aria-label",
                        `Xóa danh mục ${category.name}`,
                    );
                    remove.innerHTML =
                        '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
                    actions.append(remove);
                }
                article.append(icon, copy, actions);
                grid.append(article);
            });

            const categoryTotal = page.querySelector("[data-category-total]");
            const productTotal = page.querySelector("[data-product-total]");
            if (categoryTotal)
                categoryTotal.textContent = String(categories.length);
            if (productTotal)
                productTotal.textContent = String(
                    Object.values(productCounts).reduce(
                        (total, count) => total + count,
                        0,
                    ),
                );

            cards.forEach((card) => {
                const category = categories.find(
                    (item) => item.id === card.dataset.categoryId,
                );
                const description = card.querySelector("p");
                if (category && description)
                    description.textContent = category.name;
            });
            filterProducts();
        };

        tabs?.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-category-id]");
            if (!button) return;
            productCategoryFilter = button.dataset.categoryId;
            tabs.querySelectorAll("button").forEach((item) =>
                item.classList.toggle("active", item === button),
            );
            filterProducts();
        });

        page.querySelector(".product-category-add")?.addEventListener(
            "click",
            () => {
                form?.reset();
                if (form) {
                    form.elements.id.value = "";
                    form.elements.name.setCustomValidity("");
                }
                const title = dialog?.querySelector(
                    "#product-category-dialog-title",
                );
                if (title)
                    title.innerHTML =
                        '<i class="fa-solid fa-layer-group" aria-hidden="true"></i> Thêm danh mục';
            },
        );

        grid?.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-category-action]");
            const article = button?.closest("[data-category-id]");
            const category = categories.find(
                (item) => item.id === article?.dataset.categoryId,
            );
            if (!category) return;
            if (button.dataset.categoryAction === "remove") {
                if (countFor(category.id)) return;
                categories = categories.filter(
                    (item) => item.id !== category.id,
                );
                if (productCategoryFilter === category.id)
                    productCategoryFilter = "all";
                render();
                showToast(`Đã xóa danh mục ${category.name} trong phiên này.`);
                return;
            }
            if (!form || !dialog) return;
            form.elements.id.value = category.id;
            form.elements.name.value = category.name;
            form.elements.name.setCustomValidity("");
            form.elements.description.value = category.description;
            const title = dialog.querySelector(
                "#product-category-dialog-title",
            );
            if (title)
                title.innerHTML =
                    '<i class="fa-solid fa-pen" aria-hidden="true"></i> Sửa danh mục';
            dialog.showModal();
        });

        form?.addEventListener("submit", (event) => {
            event.preventDefault();
            const id = form.elements.id.value;
            const name = form.elements.name.value.trim().replace(/\s+/g, " ");
            const description = form.elements.description.value.trim();
            if (!name) return;
            if (
                categories.some(
                    (category) =>
                        category.id !== id &&
                        category.name.toLocaleLowerCase("vi") ===
                            name.toLocaleLowerCase("vi"),
                )
            ) {
                form.elements.name.setCustomValidity(
                    "Danh mục này đã tồn tại.",
                );
                form.elements.name.reportValidity();
                return;
            }
            form.elements.name.setCustomValidity("");
            if (id) {
                const category = categories.find((item) => item.id === id);
                if (category) Object.assign(category, { name, description });
            } else {
                categories.push({
                    id: `custom-${Date.now()}`,
                    name,
                    description,
                });
            }
            render();
            dialog.close();
            showToast("Đã cập nhật danh mục trong phiên này.");
        });
        form?.elements.name.addEventListener("input", () =>
            form.elements.name.setCustomValidity(""),
        );
        render();
    }

    function initSearch() {
        document.querySelectorAll(".inline-search input").forEach((input) =>
            input.addEventListener("input", () => {
                const query = input.value.trim().toLocaleLowerCase("vi");
                const page = document.body.className;
                if (page.includes("page-customers")) {
                    const tier =
                        document
                            .querySelector(".customer-tier-tabs .active")
                            ?.textContent.trim() || "T\u1ea5t c\u1ea3";
                    document
                        .querySelectorAll(".customer-table tbody tr")
                        .forEach((row) => {
                            const matchesText = row.textContent
                                .toLocaleLowerCase("vi")
                                .includes(query);
                            const matchesTier =
                                tier === "T\u1ea5t c\u1ea3" ||
                                row.dataset.tier === tier;
                            row.hidden = !matchesText || !matchesTier;
                        });
                    return;
                }
                if (page.includes("page-products")) {
                    filterProducts();
                    return;
                }
                document
                    .querySelectorAll(".data-table tbody tr,.simple-card")
                    .forEach((row) => {
                        row.hidden = !row.textContent
                            .toLocaleLowerCase("vi")
                            .includes(query);
                    });
            }),
        );
    }

    function initProducts() {
        const page = document.querySelector(".page-products");
        const list = page?.querySelector(".product-cards");
        const dialog = page?.querySelector("#product-edit-dialog");
        const form = dialog?.querySelector("[data-product-edit-form]");
        if (!page || !list || !dialog || !form) return;

        let editingRow = null;
        list.addEventListener("click", (event) => {
            const button = event.target.closest(".product-row-action");
            const row = button?.closest(".product-row");
            if (!button || !row || button.classList.contains("product-row-delete"))
                return;

            editingRow = row;
            form.elements.name.value =
                row.querySelector(".product-row-info h3")?.textContent.trim() || "";
            form.elements.category.value =
                row.querySelector(".product-row-info p")?.textContent.trim() || "Khác";
            form.elements.price.value =
                (row.querySelector(".card-price")?.textContent || "").replace(/\D/g, "");
            form.elements.status.value =
                row.querySelector(".product-status-pill")?.textContent.trim() || "Đang bán";
            dialog.showModal();
        });

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!editingRow) return;
            const name = String(form.elements.name.value || "").trim();
            const category = String(form.elements.category.value || "Khác");
            const price = Math.max(0, Number(form.elements.price.value) || 0);
            const status = String(form.elements.status.value || "Đang bán");
            if (!name) return;

            const title = editingRow.querySelector(".product-row-info h3");
            const group = editingRow.querySelector(".product-row-info p");
            const priceLabel = editingRow.querySelector(".card-price");
            const statusLabel = editingRow.querySelector(".product-status-pill");
            if (title) title.textContent = name;
            if (group) group.textContent = category;
            if (priceLabel) priceLabel.textContent = formatMoney(price);
            if (statusLabel) {
                statusLabel.classList.toggle("is-hidden", status !== "Đang bán");
                statusLabel.innerHTML = `<i aria-hidden="true"></i> ${status}`;
            }
            const editButton = editingRow.querySelector(
                ".product-row-action:not(.product-row-delete)",
            );
            const deleteButton = editingRow.querySelector(".product-row-delete");
            editButton?.setAttribute("aria-label", `Sửa ${name}`);
            deleteButton?.setAttribute("aria-label", `Xóa ${name}`);
            dialog.close();
            editingRow = null;
            showToast("Đã cập nhật sản phẩm trong trang hiện tại.");
        });
    }

    function initCategories() {
        document.querySelectorAll(".segmented button").forEach((button) =>
            button.addEventListener("click", () => {
                if (button.closest(".product-filters")) return;
                button.parentElement
                    .querySelectorAll("button")
                    .forEach((item) =>
                        item.classList.remove("active", "selected"),
                    );
                button.classList.add("active");
                const page = document.body.className;
                if (page.includes("page-products")) {
                    const category = button.textContent
                        .split("\u00b7")[0]
                        .trim();
                    const query =
                        document
                            .querySelector(".inline-search input")
                            ?.value.trim()
                            .toLocaleLowerCase("vi") || "";
                    document
                        .querySelectorAll(".product-cards .simple-card")
                        .forEach((card) => {
                            card.hidden =
                                !card.textContent
                                    .toLocaleLowerCase("vi")
                                    .includes(query) ||
                                (category !== "T\u1ea5t c\u1ea3" &&
                                    !card.textContent.includes(category));
                        });
                } else if (page.includes("page-inventory")) {
                    const isStockTab =
                        button ===
                        button.parentElement.querySelector(
                            "button:first-child",
                        );
                    if (!isStockTab) {
                        const dialog =
                            document.querySelector("#inventory-dialog");
                        const title = dialog?.querySelector(".dialog-top h2");
                        const hint = dialog?.querySelector(".dialog-hint");
                        if (title)
                            title.innerHTML =
                                '<i class="fa-solid fa-boxes-stacked" aria-hidden="true"></i> ' +
                                button.textContent.trim();
                        if (hint)
                            hint.textContent =
                                "Thao t\u00e1c m\u00f4 ph\u1ecfng, d\u1eef li\u1ec7u ch\u1ec9 t\u1ea1m th\u1eddi tr\u00ean giao di\u1ec7n.";
                        dialog?.showModal();
                    }
                } else if (page.includes("page-orders")) {
                    const status = button.textContent.split("\u00b7")[0].trim();
                    document
                        .querySelectorAll(".data-table tbody tr")
                        .forEach((row) => {
                            row.hidden =
                                status !== "T\u1ea5t c\u1ea3" &&
                                !row.textContent.includes(status);
                        });
                }
            }),
        );
    }

    function initDialogs() {
        const tablePaymentDialog = document.querySelector("#pos-table-dialog");
        tablePaymentDialog?.addEventListener("click", (event) => {
            if (event.target === tablePaymentDialog) tablePaymentDialog.close();
        });
        document.querySelectorAll("[data-open-dialog]").forEach((button) =>
            button.addEventListener("click", (event) => {
                event.preventDefault();
                document.getElementById(button.dataset.openDialog)?.showModal();
            }),
        );
        document
            .querySelectorAll(
                '.static-dialog form:not([data-ephemeral-form^="pos-"]):not([data-category-form]):not([data-table-floor-form]):not([data-table-create-form])',
            )
            .forEach((form) =>
                form.addEventListener("submit", (event) => {
                    event.preventDefault();
                    form.closest("dialog")?.close();
                    form.reset();
                    showToast(
                        "Biểu mẫu đã đóng. Dữ liệu chưa được lưu trong bản giao diện tĩnh.",
                    );
                }),
            );
        document.querySelectorAll("[data-dialog-close]").forEach((button) =>
            button.addEventListener("click", () => {
                button.closest("dialog")?.close();
            }),
        );
    }

    function initReports() {
        document
            .querySelectorAll(".report-period-tabs button")
            .forEach((button) =>
                button.addEventListener("click", () => {
                    button.parentElement
                        .querySelectorAll("button")
                        .forEach((item) =>
                            item.classList.toggle("active", item === button),
                        );
                    showToast(
                        "Khoảng thời gian đã được chọn trên bản xem trước.",
                    );
                }),
            );
        document
            .querySelector(".report-export")
            ?.addEventListener("click", () =>
                showToast("Báo cáo đang hiển thị trên giao diện xem trước."),
            );
    }

    function initCustomers() {
        const buttons = [
            ...document.querySelectorAll(".customer-tier-tabs button"),
        ];
        const rows = [...document.querySelectorAll(".customer-table tbody tr")];
        buttons.forEach((button) =>
            button.addEventListener("click", () => {
                buttons.forEach((item) =>
                    item.classList.toggle("active", item === button),
                );
                document
                    .querySelector(".customer-search input")
                    ?.dispatchEvent(new Event("input", { bubbles: true }));
            }),
        );
        document
            .querySelectorAll(".customer-table-footer button")
            .forEach((button) =>
                button.addEventListener("click", () => {
                    if (!button.classList.contains("current"))
                        showToast(
                            "Danh s\u00e1ch ph\u00e2n trang ch\u1ec9 l\u00e0 b\u1ea3n xem tr\u01b0\u1edbc.",
                        );
                }),
            );
    }

    function initSettings() {
        const fields = [
            ...document.querySelectorAll(
                ".setting-form input, .setting-form select, .setting-form textarea",
            ),
        ];
        const editButton = document.querySelector(".panel-head .button-light");
        const saveButton = document.querySelector(".settings-save");
        fields.forEach((field) => {
            field.readOnly = true;
            field.setAttribute("aria-readonly", "true");
        });
        editButton?.addEventListener("click", () => {
            fields.forEach((field) => {
                field.readOnly = false;
                field.removeAttribute("aria-readonly");
            });
            editButton.innerHTML =
                '<i class="fa-solid fa-pen"></i> Ch\u1ec9nh s\u1eeda';
            fields[0]?.focus();
            showToast(
                "B\u1ea1n c\u00f3 th\u1ec3 ch\u1ec9nh s\u1eeda th\u00f4ng tin tr\u00ean trang n\u00e0y.",
            );
        });
        saveButton?.addEventListener("click", () => {
            fields.forEach((field) => {
                field.readOnly = true;
                field.setAttribute("aria-readonly", "true");
            });
            if (editButton)
                editButton.innerHTML =
                    '<i class="fa-solid fa-pen"></i> Ch\u1ec9nh s\u1eeda';
            showToast(
                "Đ\u00e3 c\u1eadp nh\u1eadt b\u1ea3n xem tr\u01b0\u1edbc. Th\u00f4ng tin ch\u01b0a \u0111\u01b0\u1ee3c l\u01b0u.",
            );
        });
        document
            .querySelectorAll(".icon-button,.notification-button")
            .forEach((button) =>
                button.addEventListener("click", () =>
                    showToast(
                        "Kh\u00f4ng c\u00f3 th\u00f4ng b\u00e1o m\u1edbi.",
                    ),
                ),
            );
    }

    function initPayment() {
        document
            .querySelectorAll(".pos-payment-options button")
            .forEach((button) => {
                button.setAttribute(
                    "aria-pressed",
                    button.classList.contains("chosen") ? "true" : "false",
                );
                button.addEventListener("click", () => {
                    document
                        .querySelectorAll(".pos-payment-options button")
                        .forEach((option) => {
                            option.classList.remove("chosen");
                            option.setAttribute("aria-pressed", "false");
                        });
                    button.classList.add("chosen");
                    button.setAttribute("aria-pressed", "true");
                });
            });
    }

    function initDashboardChart() {
        const plot = document.querySelector(".home-dashboard .chart-plot");
        if (!plot) return;
        const tooltip = plot.querySelector("[data-chart-tooltip]");
        const tooltipDate = tooltip?.querySelector("[data-chart-tooltip-date]");
        const tooltipValue = tooltip?.querySelector(
            "[data-chart-tooltip-value]",
        );
        const bars = [...plot.querySelectorAll(".revenue-bar")];
        if (!tooltip || !tooltipDate || !tooltipValue || !bars.length) return;
        let activeBar = null;

        const hideTooltip = (bar) => {
            if (
                activeBar &&
                activeBar !== bar &&
                (activeBar.matches(":hover") ||
                    document.activeElement === activeBar)
            )
                return;
            if (
                bar &&
                (bar.matches(":hover") || document.activeElement === bar)
            )
                return;
            activeBar = null;
            bars.forEach((item) => item.classList.remove("is-active"));
            tooltip.setAttribute("aria-hidden", "true");
        };

        const showTooltip = (bar) => {
            activeBar = bar;
            const plotRect = plot.getBoundingClientRect();
            const barRect = bar
                .querySelector(".revenue-bar-fill")
                .getBoundingClientRect();
            const pointX = barRect.left - plotRect.left + barRect.width / 2;
            const pointY = barRect.top - plotRect.top;

            tooltipDate.textContent = bar.dataset.date || "";
            tooltipValue.textContent = bar.dataset.value || "";
            tooltip.style.left = `${Math.min(Math.max(pointX, tooltip.offsetWidth / 2 + 5), plotRect.width - tooltip.offsetWidth / 2 - 5)}px`;
            tooltip.style.top = `${Math.max(pointY, tooltip.offsetHeight + 12)}px`;
            tooltip.setAttribute("aria-hidden", "false");
            bars.forEach((item) =>
                item.classList.toggle("is-active", item === bar),
            );
        };

        bars.forEach((bar) => {
            bar.addEventListener("pointerenter", () => showTooltip(bar));
            bar.addEventListener("focus", () => showTooltip(bar));
            bar.addEventListener("pointerleave", () => hideTooltip(bar));
            bar.addEventListener("blur", () => hideTooltip(bar));
        });
    }

    function init() {
        initDashboardChart();
        initPos();
        initTables();
        initProductCategories();
        initProducts();
        initSearch();
        initCategories();
        initDialogs();
        initSettings();
        initCustomers();
        initReports();
        initPayment();
    }

    document.readyState === "loading"
        ? document.addEventListener("DOMContentLoaded", init)
        : init();
})();
