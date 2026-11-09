(() => {
    const products = {
        "matcha-latte": {
            name: "Matcha Latte",
            sku: "MAT-001",
            category: "coffee",
            description: "Matcha Nhật Bản kết hợp sữa tươi, vị trà thơm dịu.",
            price: 59000,
            sizes: ["standard", "m", "l"],
            toppings: ["Trân châu đen", "Thạch đào", "Kem cheese"],
        },
        "coconut-coffee": {
            name: "Cà phê sữa dừa",
            sku: "CF-002",
            category: "coffee",
            description: "Cà phê đậm vị kết hợp sữa dừa béo nhẹ.",
            price: 55000,
            sizes: ["standard", "m", "l"],
            toppings: ["Trân châu đen", "Kem cheese"],
        },
        "mango-bingsu": {
            name: "Bingsu xoài",
            sku: "BIN-003",
            category: "bingsu",
            description: "Đá tuyết mịn ăn cùng xoài chín và sữa đặc.",
            price: 79000,
            sizes: ["standard"],
            toppings: ["Thạch đào"],
        },
        tiramisu: {
            name: "Tiramisu",
            sku: "CAKE-004",
            category: "cake",
            description: "Bánh tiramisu mềm với lớp kem và cacao.",
            price: 49000,
            sizes: ["standard"],
            toppings: [],
        },
        "peach-tea": {
            name: "Trà đào cam sả",
            sku: "TEA-005",
            category: "tea",
            description: "Trà đào thơm mát, kết hợp cam tươi và sả.",
            price: 49000,
            sizes: ["standard", "m", "l"],
            toppings: ["Thạch đào", "Trân châu đen"],
        },
        "strawberry-tea": {
            name: "Trà dâu tươi",
            sku: "TEA-006",
            category: "tea",
            description: "Trà trái cây pha cùng dâu tươi.",
            price: 55000,
            sizes: ["standard", "m", "l"],
            toppings: ["Thạch đào"],
        },
        "matcha-frappe": {
            name: "Matcha đá xay",
            sku: "MAT-007",
            category: "coffee",
            description: "Matcha xay lạnh, phủ kem béo mịn.",
            price: 65000,
            sizes: ["standard", "m", "l"],
            toppings: ["Trân châu đen", "Kem cheese"],
        },
        brownie: {
            name: "Brownie chocolate",
            sku: "CAKE-008",
            category: "cake",
            description: "Bánh brownie chocolate đậm vị.",
            price: 45000,
            sizes: ["standard"],
            toppings: [],
        },
    };

    const page = document.querySelector(".page-create-product");
    const productId = new URLSearchParams(window.location.search).get("edit");
    const product = productId ? products[productId] : null;
    if (!page || !product) return;

    const form = page.querySelector(".create-product-form");
    if (!form) return;

    for (const field of ["name", "sku", "category", "description", "price"]) {
        const control = form.elements.namedItem(field);
        if (control) control.value = product[field];
    }

    const sizes = new Set(product.sizes);
    form.querySelectorAll('input[name="size"]').forEach((input) => {
        input.checked = sizes.has(input.value);
    });
    form.querySelectorAll(".size-price-input").forEach((input, index) => {
        input.value = product.price + index * 10000;
    });

    const toppings = new Set(product.toppings);
    form.querySelectorAll(".topping-row").forEach((row) => {
        const name = row.querySelector("strong")?.textContent.trim();
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = toppings.has(name);
    });

    page.dataset.mode = "edit";
    page.dataset.productId = productId;
    const title = page.querySelector(".create-product-heading h1 span");
    if (title) title.textContent = "Chỉnh sửa sản phẩm";
    const titleIcon = page.querySelector(".create-product-heading h1 i");
    if (titleIcon) titleIcon.className = "fa-solid fa-pen-to-square";
    const breadcrumb = page.querySelector(".breadcrumb strong");
    if (breadcrumb) breadcrumb.textContent = "Chỉnh sửa sản phẩm";
    const subtitle = page.querySelector(".create-product-heading p");
    if (subtitle) subtitle.textContent = "Cập nhật thông tin sản phẩm đang có trong thực đơn.";
    const saveButton = page.querySelector(".product-form-footer .button-primary");
    if (saveButton) saveButton.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Lưu thay đổi';

    const context = document.createElement("div");
    context.className = "product-edit-context";
    context.innerHTML = `<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span>Đang chỉnh sửa <strong>${product.name}</strong><small>Mã sản phẩm: ${product.sku} · Dữ liệu hiển thị minh họa, chưa được lưu.</small></span>`;
    form.before(context);

    if (productId !== "matcha-latte") {
        const recipeNote = form.querySelector(".recipe-note");
        if (recipeNote) recipeNote.textContent = "Định lượng nguyên liệu cần được rà soát theo công thức thực tế của sản phẩm này.";
    }
})();
