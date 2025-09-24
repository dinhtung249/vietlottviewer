// CẤU HÌNH GAME + dữ liệu mặc định trong thư mục data/
// Sau này chỉ cần thêm game mới ở đây và tạo file JSONL tương ứng trong /data.
window.APP_CONFIG = {
  palette: ["#2563eb","#16a34a","#eab308","#ef4444","#a855f7","#06b6d4","#f97316","#22c55e","#ec4899","#94a3b8"],
  games: {
    max3dpro: {
      label: "Max 3D Pro",
      numberWidth: 3,
      preferredPrizeOrder: ["Giải Đặc biệt","Giải Nhất","Giải Nhì","Giải ba"],
      dataPath: "data/max3dpro.jsonl"   // <-- sẽ tự load file này
    },
    max3d:   { label:"Max 3D",   dataPath:"data/max3d.jsonl", numberWidth:3, preferredPrizeOrder:["Kết quả"] },
    mega645: { label:"Mega 6/45",dataPath:"data/mega645.jsonl",numberWidth:2, preferredPrizeOrder:["Kết quả"] },
    power655:{ label:"Power 6/55",dataPath:"data/power655.jsonl",numberWidth:2, preferredPrizeOrder:["Kết quả"] },
    lotto535:{ label:"Lotto 5/35",dataPath:"data/lotto535.jsonl",numberWidth:2, preferredPrizeOrder:["Kết quả"] }
  },
  defaultGame: "max3dpro"
};

