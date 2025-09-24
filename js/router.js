// Đọc ?game=...&data=... từ URL để chọn dataset mặc định.
(function(){
  const params = new URLSearchParams(location.search);
  const gameParam = params.get("game");
  const dataParam = params.get("data"); // cho phép override đường dẫn file dữ liệu
  const cfg = window.APP_CONFIG;

  let currentGameKey = cfg.games[gameParam] ? gameParam : cfg.defaultGame;
  window.ROUTE = {
    currentGameKey,
    overrideDataPath: dataParam || null
  };
})();
