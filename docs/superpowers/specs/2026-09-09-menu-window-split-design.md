# Tách Menu HUD thành cửa sổ Windows riêng + Bản đồ full màn hình

Ngày: 2026-09-09

## Bối cảnh

Hiện tại toàn bộ HUD (widget overlay lẫn dashboard/menu) chạy trong **một**
`BrowserWindow` Electron trong suốt, click-through, full màn hình, luôn nổi
trên game (`mainWindow` trong [electron/main.cjs](../../../electron/main.cjs)).
Nhấn `F8` chỉ tắt click-through và gửi event `overlay:dash`; React
(`App.tsx`) hiện `<MainWindow>` (các tab Dashboard, Live Map, Skin Editor,
Garage, Dino Shop, Skin Shop, Support, Map Editor + Settings) đè lên trên
cùng cửa sổ overlay đó.

Vấn đề: dashboard chiếm dụng toàn bộ overlay khi mở, không có cảm giác như
một "menu" độc lập của app; bản đồ hiện tại chỉ có dạng minimap nhỏ ở góc,
không xem được tổng thể khi cần.

## Mục tiêu

1. Tách phần "menu" (các tab + Settings) ra một cửa sổ Windows bình thường,
   độc lập với overlay trong game.
2. Overlay trong game chỉ còn giữ các widget hiển thị số liệu/bản đồ nhỏ:
   Compass, Stats (máu/đói/khát/thể lực/tăng trưởng), Prime checklist, Heart
   HUD, Radar/minimap, Server-info widget.
3. Bỏ hoàn toàn phím tắt `F8` và mọi UI mở-menu trong overlay — menu window
   chỉ điều khiển qua taskbar/tray, giống một app Windows thông thường.
4. Thêm phím tắt (mặc định `M`, đổi được) để mở một bản đồ lớn, gần full màn
   hình, xem chi tiết hơn minimap — tái dùng logic bản đồ đang có ở tab Live
   Map trong menu.

## Ngoài phạm vi (Non-goals)

- Không đổi cơ chế `cursorKey`/`cursorMode` (phím Insert) hiện có.
- Không đổi radar window đã tách sẵn (`radarWindow`), giữ nguyên hành vi.
- Không đổi backend/API, auth Steam, hay bất kỳ tính năng nghiệp vụ nào của
  các tab (Garage, Skin Shop, Admin...).
- Không thêm test tự động — dự án hiện chỉ có `npm run typecheck`, kiểm thử
  bằng tay qua `npm run dev` (xem mục Kiểm thử).

## Kiến trúc

Ba cửa sổ Electron độc lập, mỗi cửa sổ là một React root riêng
(`src/main.tsx` route theo `location.hash`, giống cách `#radar` đã hoạt
động):

| Cửa sổ | Route | Vai trò |
| --- | --- | --- |
| Overlay (đổi tên khái niệm, biến `mainWindow` giữ nguyên) | (không hash) | Widget số liệu + minimap + panel bản đồ full khi bật |
| Radar | `#radar` | Không đổi |
| **Menu (mới)** | `#menu` | Toàn bộ nội dung `MainWindow.tsx` cũ + `SettingsPanel` |

### 1. Overlay window (giữ nguyên phần lớn)

- Trong suốt, click-through, luôn nổi, tự ẩn khi game không active — **không
  đổi** cơ chế `trackGame()`/`positionOverlay()`.
- Nội dung còn lại: `CompassWidget`, `StatsWidget`, `PrimePanel`, `HeartHud`,
  `RadarPanel`, `ServerInfoWidget` (tất cả bọc trong `DraggablePanel` như
  hiện tại).
- Bỏ: `<MainWindow>`, `<SettingsPanel>`, nút `statusPill` ("F8 to open
  dashboard"), icon lá thư mở nhanh menu, và toàn bộ polling
  `ticketSummary` phục vụ icon đó.
- Thêm: panel "Bản đồ full" (mục Bản đồ full màn hình dưới đây), và class
  CSS bật resize-handle cho chế độ "Chỉnh vị trí HUD" (đổi tên từ
  `dashboardOpen` thành `hudEditMode`).
- Boot screen (logo khởi động) và màn hình "bị khoá license" (☹️) chuyển
  hẳn sang Menu window; overlay khi bị khoá license sẽ ẩn hoàn toàn, không
  hiện gì.
- Màn hình "Streaming..." (streamer mode) giữ nguyên trong overlay — không
  liên quan Menu window.

### 2. Menu window (mới)

- `BrowserWindow` bình thường: `frame:false` (giữ phong cách UI tối hiện có,
  tự vẽ titlebar) nhưng **hiện trong taskbar** (`skipTaskbar:false`),
  `resizable:true`, `movable:true`, `minimizable:true`, `maximizable:true`,
  **không** `alwaysOnTop`.
- Titlebar tự vẽ có nút minimize/maximize/close riêng. Nút ❌ **ẩn cửa sổ**
  (giống minimize-to-tray), không quit app — quit chỉ qua tray "Quit".
- Vị trí/kích thước lưu vào setting mới `menuBounds` (giống cơ chế
  `radarBounds` hiện tại: lưu khi resize/move, khôi phục khi mở app).
- **Mở sẵn khi app khởi động.** Sau đó chỉ điều khiển qua:
  - Taskbar (click icon để focus lại nếu bị che bởi game).
  - Tray context-menu: đổi mục "Show / hide dashboard" thành
    "Show / hide menu", vẫn gọi hàm toggle tương ứng; double-click tray vẫn
    toggle.
- **Không có global hotkey nào** mở/tắt menu window (F8 bị bỏ hoàn toàn:
  xoá setting `dashKey`, xoá mục "Dashboard hotkey" trong Settings UI, xoá
  IPC `dash:recordKey`, xoá `dashAccelerator`/đăng ký `globalShortcut`
  tương ứng trong `electron/main.cjs` và `electron/overlay-config.cjs`).
- Chứa: khung tab (Dashboard/profile, Live Map, Skin Editor, Garage, Dino
  Shop, Skin Shop, Support, Map Editor) + `SettingsPanel`, đăng nhập Steam,
  boot screen, màn hình bị khoá license (nội dung thay thế, không đóng cửa
  sổ).
- Có nút mới **"Chỉnh vị trí HUD"** (trong Settings) — xem mục dưới.
- Có mục Settings mới **"Phím mở bản đồ"** (mặc định `M`, đổi được) — xem
  mục Bản đồ full màn hình.
- Tự lấy dữ liệu qua IPC độc lập (settings, auth, live, ticket summary) —
  **không chia sẻ React state với overlay `App.tsx`** vì là renderer process
  khác nhau, đúng theo pattern `RadarWindow.tsx` đang tự subscribe
  `onSettingsChanged`/`onLive`.

## Thay đổi code chi tiết

### `electron/main.cjs`

- Thêm `menuWindow`, `createMenuWindow()`, `openMenu()`, `closeMenu()` (ẩn,
  không destroy), `toggleMenu()` — song song với `openRadar()`/`closeRadar()`
  hiện có.
- Lưu `menuBounds` qua listener `resize`/`move` như `radarWindow` đang làm.
- Xoá `dashOn`, `toggleDash()`, xoá đăng ký `globalShortcut` cho `dashKey`,
  xoá nhánh xử lý `dashKey` trong `startCursorHook()` (uiohook keydown/keyup).
- Giữ `setCursor()` nhưng đổi mục đích: chỉ dùng cho cờ nội bộ
  `overlayInteractive = hudEditMode || fullMapOpen` (bật/tắt click-through
  overlay window).
- Thêm `hudEditMode` boolean + IPC `hudEdit:set` (gọi từ Menu window) →
  cập nhật `overlayInteractive`, gửi `hudEdit:changed` cho overlay.
- Thêm `fullMapOpen` boolean + `toggleFullMap()` (gọi bởi `mapKey` hotkey)
  → cập nhật `overlayInteractive`, gửi `fullMap:changed` cho overlay.
- Thêm setting `mapKey` (mặc định `"M"`) + đăng ký `globalShortcut` tương
  tự cách `dashKey` từng làm (dùng lại `dashAccelerator`-style helper, đổi
  tên cho phù hợp, ví dụ `mapAccelerator`) + IPC `map:recordKey` cho UI ghi
  phím trong Settings.
- Tray: đổi label + handler `toggleMenu()`.
- `dispatchLiveFrame`: gửi thêm cho `menuWindow` (giống đang gửi cho
  `radarWindow`).

### `electron/preload.cjs` + `src/preload.d.ts`

- Xoá `dash:recordKey`, `overlay:dashOpen`, `onDash`.
- Thêm `menu.toggle()`, `menu.open()`, `menu.close()`.
- Thêm `hudEdit.set(on: boolean)`, `onHudEdit(cb)`.
- Thêm `map.recordKey()`, `onFullMap(cb)`, `fullMap.toggle()` (dùng nội bộ
  khi cần đóng bằng nút X/Esc từ renderer).

### `src/main.tsx`

- Thêm nhánh `#menu` → render root mới `MenuWindow.tsx`.

### Tách `src/MainWindow.tsx`

- Phần khung tab + logic hiện có trong hàm `MainWindow()` chuyển vào file
  mới `src/MenuWindow.tsx` (giữ tên component nội dung tương tự, đổi thành
  root độc lập tự fetch settings/auth/live/ticket qua IPC).
- `HeartHud` và `StatsWidget` (dùng cho overlay) tách sang file riêng
  (`src/HeartHud.tsx`, `src/StatsWidget.tsx`), `App.tsx` tiếp tục import.
- `SettingsPanel` (đang định nghĩa trong `App.tsx`) chuyển vào
  `MenuWindow.tsx`, thêm 2 mục mới: "Chỉnh vị trí HUD" (nút bật/tắt) và
  "Phím mở bản đồ" (chọn/ghi phím, mặc định `M`).

### `src/App.tsx`

- Bỏ `mainOpen`, `<MainWindow>`, `<SettingsPanel>`, `statusPill`, envelope
  ticket icon, polling `ticketSummary`.
- Thêm state `hudEditMode` (từ `onHudEdit`) → toggle class CSS (đổi tên
  `dashboardOpen` → `hudEditMode`) để hiện `.panelResizeHandle`.
- Thêm state `fullMapOpen` (từ `onFullMap`) → render panel bản đồ full khi
  `true`.
- Giữ nguyên: `TrollLayer`, các `DraggablePanel` widget, màn hình streamer
  mode, `useAutoInteract`.

### Bản đồ full màn hình (mới)

- File mới `src/FullMapOverlay.tsx`: bọc `<LiveMapTab authed={auth.authed}
  onLogin={login} />` (tái dùng nguyên component, đã tự fetch data độc lập)
  trong một panel gần full màn hình (ví dụ 90vw × 90vh, căn giữa, nền mờ tối
  phía sau — cùng style modal với `SettingsPanel`).
- Có nút ❌ ở góc panel gọi `window.isleOverlay.fullMap.toggle()`.
- Bắt phím `Escape` bằng `keydown` listener trong component này (chỉ hoạt
  động khi panel đang mở và overlay đang nhận input — không phải global
  shortcut) → cũng gọi toggle đóng.
- Phím `mapKey` (global shortcut, main process) → `toggleFullMap()` → bật
  cờ `overlayInteractive`, gửi `fullMap:changed(true)`; nhấn lại → đóng.

## Settings/cấu hình thay đổi

- **Xoá**: `dashKey` (và migration không cần thiết — field không dùng nữa,
  bỏ qua khi đọc settings cũ, không gây lỗi vì `normalizeSettings` chỉ đọc
  field đã biết).
- **Thêm**: `menuBounds` (giống `radarBounds`: `{x,y,width,height} | null`),
  `mapKey` (string, mặc định `"M"`).
- Các setting khác (`layout`, `panels`, `theme`, `radarBounds`,
  `cursorKey`, `cursorMode`, `cursorEnabled`...) không đổi.

## Xử lý lỗi

- Mọi IPC gửi tới `menuWindow`/`mainWindow` đều check `!win.isDestroyed()`
  như các đoạn code hiện có (`radarSend`, `dispatchLiveFrame`).
- Nếu tạo `menuWindow` thất bại (hiếm) → nuốt lỗi theo phong cách hiện tại
  của codebase; lần tray-click kế tiếp sẽ thử tạo lại.
- License bị khoá (`applyLicense()`): overlay ẩn hoàn toàn (không widget,
  không panel bản đồ full); Menu window vẫn hiện được nhưng nội dung thay
  bằng màn hình khoá, không đóng cửa sổ. Đóng `fullMapOpen`/`hudEditMode`
  và khôi phục click-through khi bị khoá (tương tự `setCursor(false)` đang
  làm khi license blocked hiện tại).
- Nếu `mapKey` trùng với phím khác đang dùng trong game/app — người dùng tự
  đổi qua Settings, không cần validate đặc biệt (giống cách `dashKey` cũ
  từng hoạt động).

## Kiểm thử (thủ công qua `npm run dev`)

1. Mở app → Menu window hiện sẵn, đăng nhập Steam, đổi tab hoạt động bình
   thường.
2. Overlay trong game chỉ còn Compass/Stats/Prime/Heart/Radar/Server-info —
   không còn `MainWindow`/`Settings`/statusPill/envelope trong overlay.
3. Đóng Menu window bằng nút ❌ → ẩn xuống tray, click tray icon hoặc
   double-click → mở lại đúng vị trí/kích thước đã lưu (`menuBounds`) sau
   khi khởi động lại app.
4. Không còn phím tắt nào mở/tắt Menu window từ trong game (xác nhận `F8`
   không còn tác dụng).
5. Trong Settings (Menu window) bật "Chỉnh vị trí HUD" → resize-handle hiện
   trên overlay, kéo/resize widget được; tắt đi thì hết và overlay
   click-through trở lại.
6. Nhấn `M` (hoặc phím đã đổi trong Settings) trong lúc chơi → panel bản đồ
   full mở, pan/zoom/click địa điểm được bằng chuột; nhấn `M`/`Esc`/nút ❌ →
   đóng, overlay click-through trở lại.
7. Đổi Settings (theme, opacity, `mapKey`...) trong Menu → cập nhật realtime
   ở cả overlay và radar window.
8. Build packaged (`npm run dist`) → icon Menu hiện đúng trong taskbar,
   minimize/maximize/close hoạt động bình thường; license bị khoá ẩn đúng
   overlay và hiện màn hình khoá trong Menu.
9. `npm run typecheck` sạch lỗi sau khi tách file.

## Tài liệu cần cập nhật kèm theo

- [README.md](../../../README.md) và [README.vi.md](../../../README.vi.md):
  bỏ đoạn nhắc "Press F8", mô tả lại kiến trúc 2 cửa sổ (overlay + menu) và
  hotkey bản đồ full mới.
- [docs/FEATURES.md](../../FEATURES.md): cập nhật danh sách tính năng theo
  kiến trúc mới.
