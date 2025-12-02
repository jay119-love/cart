// server.js
const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// 1. 상품 데이터 (DB 대용)
//    Key: Product ID (String)
// --------------------------------------------------
const products = {
  "P001": {
    id: "P001",
    name: "블랙 자켓",
    desc: "미니멀 블랙 테일러드 자켓",
    imageUrl: "/img/placeholder-jacket.jpg",
    sizes: ["S", "M", "L"],
    colors: ["black", "white"],
  },
  "P002": {
    id: "P002",
    name: "데님 팬츠",
    desc: "스트레이트 중청 데님 팬츠",
    imageUrl: "/img/placeholder-denim.jpg",
    sizes: ["M", "L", "XL"],
    colors: ["blue", "navy"],
  },
  "P003": {
    id: "P003",
    name: "코튼 셔츠",
    desc: "화이트 옥스포드 셔츠",
    imageUrl: "/img/placeholder-shirt.jpg",
    sizes: ["S", "M", "L", "XL"],
    colors: ["white", "beige"],
  },
};

// --------------------------------------------------
// 2. 세션 데이터 (임시 DB)
//    Key: Session ID (String)
//    Value: { createdAt: Date, clickedProducts: Array }
// --------------------------------------------------
const sessions = new Map();

const SESSION_TTL = 30 * 60 * 1000; // 30분

// 세션 조회 (없으면 생성)
function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      createdAt: Date.now(),
      clickedProducts: [], // [{ productId, name, size, color, timestamp }]
    });
    console.log(`[Session Created] ${sessionId}`);
  }
  // 접근 시 TTL 갱신은 정책에 따라 결정 (여기선 생성 기준 30분 유지로 가정하거나, 접근 시 갱신할 수도 있음)
  // 방문자 기반 임시 저장이므로 '생성 기준' 혹은 '마지막 활동 기준' 중 선택.
  // 여기서는 간단히 '마지막 활동 기준'으로 갱신해줌.
  const session = sessions.get(sessionId);
  session.lastActive = Date.now();
  return session;
}

// TTL 스케줄러 (1분마다 만료된 세션 삭제)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of sessions.entries()) {
    if (now - data.lastActive > SESSION_TTL) {
      sessions.delete(sessionId);
      console.log(`[Session Expired] ${sessionId}`);
    }
  }
}, 60 * 1000);

// --------------------------------------------------
// 3. API: 상품 조회
// --------------------------------------------------
app.get("/api/product/:productId", (req, res) => {
  const { productId } = req.params;
  const product = products[productId];

  if (!product) {
    return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
  }
  res.json(product);
});

// 테스트용: 랜덤 상품 ID 반환
app.get("/api/debug/random-product-id", (req, res) => {
  const keys = Object.keys(products);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  res.json({ productId: randomKey });
});

// --------------------------------------------------
// 4. API: 세션 관리 (웹앱 용)
// --------------------------------------------------

// 세션의 장바구니 조회 (상세 정보 포함)
app.get("/api/session/:sessionId/cart", (req, res) => {
  const { sessionId } = req.params;
  const session = getOrCreateSession(sessionId);
  res.json(session.clickedProducts);
});

// 세션에 상품 담기
app.post("/api/session/:sessionId/add", (req, res) => {
  const { sessionId } = req.params;
  const { productId, size, color } = req.body;

  const product = products[productId];
  if (!product) {
    return res.status(400).json({ error: "유효하지 않은 상품 ID" });
  }

  const session = getOrCreateSession(sessionId);

  const item = {
    id: Date.now(), // cartItemId
    productId,
    name: product.name,
    size,
    color,
    timestamp: new Date().toISOString(),
  };

  session.clickedProducts.push(item);
  console.log(`[Cart Add] Session: ${sessionId}, Product: ${productId}`);

  res.json(item);
});

// 세션에서 상품 삭제
app.delete("/api/session/:sessionId/cart/:itemId", (req, res) => {
  const { sessionId, itemId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "세션이 만료되었습니다." });
  }

  const index = session.clickedProducts.findIndex(
    (item) => item.id === Number(itemId)
  );
  if (index === -1) {
    return res.status(404).json({ error: "아이템이 없습니다." });
  }

  session.clickedProducts.splice(index, 1);
  res.json({ success: true });
});

// --------------------------------------------------
// 5. API: 스마트미러 조회용
// --------------------------------------------------
app.get("/api/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    // 미러 입장에서는 세션이 없으면 빈 목록 or 에러
    return res.status(404).json({ error: "Session not found or expired" });
  }

  // 스마트미러가 필요한 데이터 형태에 맞춰 반환
  res.json({
    sessionId,
    clickedProducts: session.clickedProducts,
  });
});

// --------------------------------------------------
// 서버 시작
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
