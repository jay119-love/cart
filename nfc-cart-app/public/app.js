// app.js

const cartList = document.getElementById("cartList");
const emptyMsg = document.getElementById("emptyMsg");

const itemModal = document.getElementById("itemModal");
const closeModal = document.getElementById("closeModal");
const modalName = document.getElementById("modalName");
const modalDesc = document.getElementById("modalDesc");
const sizeSelect = document.getElementById("sizeSelect");
const colorSelect = document.getElementById("colorSelect");
const addBtn = document.getElementById("addBtn");
const changeBtn = document.getElementById("changeBtn");

// ----------------------
// 1. 세션 ID 관리 (방문자 식별)
// ----------------------
let sessionId = sessionStorage.getItem("sessionId");

if (!sessionId) {
  // 간단한 UUID 생성 (crypto.randomUUID()는 HTTPS or localhost 필요)
  if (window.crypto && window.crypto.randomUUID) {
    sessionId = window.crypto.randomUUID();
  } else {
    // Fallback for older browsers / non-secure context
    sessionId = "sess-" + Math.random().toString(36).slice(2) + Date.now();
  }
  sessionStorage.setItem("sessionId", sessionId);
}

console.log("Current Session ID:", sessionId);

// ----------------------
// 2. 초기화 및 NFC 딥링크 처리
// ----------------------
const params = new URLSearchParams(window.location.search);
const nfcProductId = params.get("productId"); // 예: ?productId=P001

init();

async function init() {
  // 만약 NFC로 들어왔다면 바로 장바구니에 담기 시도
  if (nfcProductId) {
    console.log("NFC Detected! Product ID:", nfcProductId);
    await autoAddProduct(nfcProductId);
  }

  // 장바구니 로드
  await loadCart();

  // 만약 NFC로 들어왔다면 해당 상품 팝업도 띄워주기 (선택 사항, UX상 좋음)
  if (nfcProductId) {
    await openProductById(nfcProductId);
  }
}

// ----------------------
// 3. API 통신 함수들
// ----------------------

// 장바구니 불러오기
async function loadCart() {
  try {
    const res = await fetch(`/api/session/${sessionId}/cart`);
    if (!res.ok) throw new Error("Failed to load cart");
    const data = await res.json();
    renderCart(data);
  } catch (e) {
    console.error(e);
  }
}

// 상품 정보 가져오기 & 모달 열기
async function openProductById(productId) {
  try {
    const res = await fetch(`/api/product/${productId}`);
    if (!res.ok) {
      console.error("상품 조회 실패");
      return;
    }
    const product = await res.json();
    openProductModal(product);
  } catch (e) {
    console.error(e);
  }
}

// (NFC용) 상품 자동 담기 (기본 옵션으로)
async function autoAddProduct(productId) {
  try {
    // 1. 상품 정보 조회 (옵션 확인용)
    const res = await fetch(`/api/product/${productId}`);
    if (!res.ok) return;
    const product = await res.json();

    // 2. 기본 옵션(첫번째)으로 담기
    const payload = {
      productId: product.id,
      size: product.sizes[0],
      color: product.colors[0],
    };

    await fetch(`/api/session/${sessionId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("Auto added to cart");
  } catch (e) {
    console.error("Auto add failed", e);
  }
}

// ----------------------
// 4. UI 이벤트 핸들러
// ----------------------

// 모달 열기
let currentProduct = null;

function openProductModal(product) {
  currentProduct = product;

  modalName.textContent = product.name;
  modalDesc.textContent = product.desc;

  // 이미지 처리 (없으면 텍스트)
  const imgPlaceholder = document.querySelector(".img-placeholder");
  if (product.imageUrl) {
    // 실제 이미지가 있다면 img 태그로 교체하거나 배경으로 설정
    // 여기선 간단히 텍스트 유지
    imgPlaceholder.textContent = product.name;
  }

  sizeSelect.innerHTML = product.sizes
    .map((s) => `<option value="${s}">${s}</option>`)
    .join("");

  colorSelect.innerHTML = product.colors
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");

  itemModal.classList.remove("hidden");
}

// 모달 닫기
closeModal.addEventListener("click", () => {
  itemModal.classList.add("hidden");
});

// [담기] 버튼 클릭
addBtn.addEventListener("click", async () => {
  if (!currentProduct) return;

  const payload = {
    productId: currentProduct.id,
    size: sizeSelect.value,
    color: colorSelect.value,
  };

  try {
    const res = await fetch(`/api/session/${sessionId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      itemModal.classList.add("hidden");
      await loadCart();
    }
  } catch (e) {
    console.error(e);
  }
});

// [옵션 바꾸기] 버튼 (랜덤)
changeBtn.addEventListener("click", () => {
  if (sizeSelect.options.length > 0) {
    sizeSelect.selectedIndex = Math.floor(
      Math.random() * sizeSelect.options.length
    );
  }
  if (colorSelect.options.length > 0) {
    colorSelect.selectedIndex = Math.floor(
      Math.random() * colorSelect.options.length
    );
  }
});

// ----------------------
// 5. 렌더링
// ----------------------
function renderCart(cartItems) {
  cartList.innerHTML = "";

  if (!cartItems || cartItems.length === 0) {
    emptyMsg.style.display = "block";
    cartList.appendChild(emptyMsg);
    return;
  }

  emptyMsg.style.display = "none";

  cartItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <button class="card-remove" data-id="${item.id}">×</button>
      <div class="card-img">LOOK</div>
      <div class="card-name">${item.name}</div>
      <div class="card-meta">${item.size} / ${item.color}</div>
    `;

    // 삭제 버튼
    card.querySelector(".card-remove").addEventListener("click", async (e) => {
      const itemId = e.target.dataset.id;
      await fetch(`/api/session/${sessionId}/cart/${itemId}`, {
        method: "DELETE",
      });
      await loadCart();
    });

    cartList.appendChild(card);
  });
}

// 개발용: 랜덤 스캔 테스트
window.testRandomScan = async () => {
  const res = await fetch("/api/debug/random-product-id");
  const { productId } = await res.json();
  console.log("Simulating NFC Scan:", productId);

  // URL 변경 없이 함수만 호출하여 테스트
  await autoAddProduct(productId);
  await openProductById(productId);
  await loadCart();
};
