// 추후 NFC 상품 인식되면 이 함수 호출하면 됨
export function receiveProductData(product) {
    console.log("상품 인식됨:", product);
    // 이후 제품 팝업 띄우기 추가 예정
  }
  
  window.receiveProductData = receiveProductData;
  