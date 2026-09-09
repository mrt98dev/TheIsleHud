# Tính năng & luồng chạy — TheIsleHud

Tài liệu này liệt kê toàn bộ tính năng của TheIsleHud, mỗi mục gồm hai phần:

- **Người dùng thấy gì** — mô tả trải nghiệm/nghiệp vụ.
- **Luồng kỹ thuật** — component/file liên quan, IPC channel, API, WebSocket message (kèm `file:line`) để dev đọc code nhanh hơn.

## 0. Kiến trúc nền cho phần luồng chạy

Ứng dụng có **1 tiến trình Electron main** và **3 React root**, mỗi root là một cửa sổ (`BrowserWindow`) riêng, chọn theo `location.hash`:

- **Main process** — [electron/main.cjs](../electron/main.cjs): quản lý cửa sổ, bám theo game, hotkey toàn cục, xác thực Steam, gọi API/WS thay renderer, auto-update.
- **Renderer (overlay chính)** — [src/App.tsx](../src/App.tsx), chọn bởi `main.tsx` khi không có hash (mặc định). Trong suốt, click-through, chỉ chứa các widget hiển thị số liệu/bản đồ nhỏ và panel bản đồ full màn hình (xem mục 2).
- **Renderer (menu)** — [src/MenuWindow.tsx](../src/MenuWindow.tsx), chọn khi `location.hash === "#menu"`. Chứa toàn bộ tab dashboard (Profile, Live Map, Skin Editor, Garage, Dino Shop, Skin Shop, Support, Map Editor) và `SettingsPanel`; chạy trong một `BrowserWindow` bình thường, có mục riêng trên taskbar, tự mở khi app khởi động (xem mục 2).
- **Renderer (radar)** — [src/RadarWindow.tsx](../src/RadarWindow.tsx), cửa sổ Electron riêng, chọn khi `location.hash === "#radar"` ([src/main.tsx:7](../src/main.tsx:7)).
- **Cầu nối** — [electron/preload.cjs](../electron/preload.cjs) expose duy nhất một object `window.isleOverlay` (xem [src/preload.d.ts](../src/preload.d.ts)) qua `contextBridge`; renderer không có quyền Node/`ipcRenderer` trực tiếp. Mỗi renderer (overlay/menu/radar) tự subscribe dữ liệu riêng qua object này — không chia sẻ React state giữa các cửa sổ.

Mọi tính năng bên dưới đều đi qua object `isleOverlay` này theo 3 dạng: `getX()/setX()` (request-response), `onX(cb)` (subscribe sự kiện từ main), hoặc `apiGet/apiPost/apiGetFile` (proxy API có gắn sẵn Bearer token).

## 1. Overlay & click-through

**Người dùng thấy gì:** cửa sổ HUD trong suốt, luôn nổi trên game, không chặn chuột/bàn phím khi đang chơi; tự ẩn khi game không phải cửa sổ đang active hoặc chưa mở.

**Luồng kỹ thuật:**
- `trackGame()` trong [electron/main.cjs:732-786](../electron/main.cjs) poll mỗi 700ms, dùng `koffi` (FFI tới user32/kernel32, xem [electron/native-windows.cjs](../electron/native-windows.cjs)) để tìm HWND tiến trình khớp `theisle.exe` / `theisleclient-win64-shipping.exe` (danh sách tại [electron/overlay-config.cjs:35-50](../electron/overlay-config.cjs)).
- Trạng thái (game có chạy, có active không, streamer mode, boot-grace 4 giây...) được diff và gửi renderer qua kênh `overlay:state`.
- Renderer subscribe bằng `window.isleOverlay.onState(cb)`, cập nhật state `state` trong `App()` ([src/App.tsx:991](../src/App.tsx)).
- Click-through bật/tắt bằng `setIgnoreMouseEvents(true, {forward:true})`; renderer có thể yêu cầu đổi qua `setMouseIgnore()` (kênh `overlay:mouseIgnore`).

## 2. Menu window & bản đồ full màn hình

**Người dùng thấy gì:** bảng điều khiển (dashboard) không còn nằm trong overlay — nó là một cửa sổ Windows bình thường riêng ("Menu"), có mục riêng trên taskbar, có thể resize/di chuyển, không luôn nổi trên cùng, và **tự mở sẵn khi khởi động app**. Sau đó chỉ điều khiển qua taskbar hoặc icon tray ("Show / hide menu") — **không còn phím tắt nào** (F8 đã bị bỏ) hay nút nào trong overlay để mở nó. Cửa sổ Menu chứa các tab Profile, Live Map, Skin Editor, Garage, Dino Shop, Skin Shop, Support, và (nếu có quyền) Map Editor/Admin, cùng Settings.

Trong lúc chơi, nhấn phím tắt riêng (mặc định `M`, đổi được trong Settings ở mục "Phím mở bản đồ") để mở một panel bản đồ lớn, gần full màn hình, đè lên overlay — xem chi tiết hơn so với minimap nhỏ. Nhấn lại phím đó, `Esc`, hoặc nút ❌ trên panel để đóng.

**Luồng kỹ thuật:**
- `createMenuWindow()`/`openMenu()`/`closeMenu()`/`toggleMenu()` trong [electron/main.cjs](../electron/main.cjs) tạo `menuWindow` — `BrowserWindow` bình thường (`skipTaskbar:false`, `resizable/movable/minimizable/maximizable:true`, không `alwaysOnTop`); vị trí/kích thước lưu vào setting `menuBounds` (giống cơ chế `radarBounds`).
- Renderer của cửa sổ này là `src/MenuWindow.tsx`, chọn khi `location.hash === "#menu"` (giống cách `#radar` chọn `RadarWindow.tsx`); chứa tab-shell (state `tab` chọn `DashboardTab`, `LiveMapTab`, `SkinEditorTab`, `GarageTab`, `MapEditorTab`, `AdminTab`, `DinoShopTab`, `SkinShopTab`) và `SettingsPanel`, mỗi tab tự fetch dữ liệu qua `apiGet/apiPost` riêng; `MenuWindow` tự lấy settings/auth/live/ticket qua IPC độc lập, không chia sẻ React state với overlay `App.tsx`.
- Quyền truy cập tab `mapedit`/`admin` vẫn gác bởi state `mapEditAdmin`/`adminModeOn` (do backend trả về khi login, không phải cấu hình tĩnh) — không đổi so với trước, chỉ chuyển từ `MainWindow.tsx` sang `MenuWindow.tsx`.
- Không còn `globalShortcut`/setting `dashKey` (đã xoá cùng IPC `dash:recordKey`, kênh `overlay:dash`, mục "Dashboard hotkey" trong Settings UI). Menu window chỉ toggle qua tray context-menu "Show / hide menu" (gọi `toggleMenu()`) hoặc click/double-click icon taskbar.
- Bản đồ full màn hình: setting `mapKey` (mặc định `"M"`) đăng ký `globalShortcut` (thay cho `dashKey` cũ) gọi `toggleFullMap()` trong main → set cờ `fullMapOpen`, phát kênh `fullMap:changed` cho overlay. Renderer overlay render `src/FullMapOverlay.tsx` (bọc lại đúng component `LiveMapTab` dùng ở tab Live Map trong Menu window) khi `fullMapOpen === true`; đóng bằng nút ❌ gọi `window.isleOverlay.fullMap.toggle()`, phím `Esc` (bắt trong component), hoặc nhấn lại `mapKey`. Người dùng đổi phím `mapKey` trong Settings (Menu window) qua kênh ghi phím `map:recordKey`.
- Resize handle của các widget overlay chỉ hiện khi bật **"Chỉnh vị trí HUD"** trong Settings (Menu window) — setting/cờ nội bộ `hudEditMode`, gửi qua IPC `hudEdit:set` từ Menu window, main phát lại `hudEdit:changed` cho overlay (đổi tên từ cờ `dashboardOpen` cũ). Cả `hudEditMode` và `fullMapOpen` cùng điều khiển việc tắt/mở click-through của overlay (`overlayInteractive = hudEditMode || fullMapOpen`).

## 3. Xác thực Steam

**Người dùng thấy gì:** bấm đăng nhập, trình duyệt mặc định mở trang Steam auth của backend; sau khi xong, ứng dụng tự nhận diện đã đăng nhập mà không cần dán token thủ công.

**Luồng kỹ thuật:**
- App đăng ký custom protocol `theislehud://` và `isle-overlay://` ([electron/main.cjs:1202-1212](../electron/main.cjs)); backend redirect về `theislehud://auth?sid=...&token=...` sau khi Steam xác thực xong.
- `handleDeepLink()` ([electron/main.cjs:1214-1231](../electron/main.cjs)) parse `sid` (SteamID64, validate 17 chữ số) và `token`, lưu vào settings, gọi lại kết nối WebSocket live, phát `auth:changed` cho renderer.
- Single-instance lock (`requestSingleInstanceLock`) đảm bảo deep-link mở app thứ 2 được forward về app đang chạy qua sự kiện `second-instance`/`open-url`.
- **Bảo mật token:** `overlayToken` được mã hoá bằng `safeStorage.encryptString` (tiền tố `enc1:`) trước khi ghi ra file settings; chỉ giải mã trong bộ nhớ main process. Renderer **không bao giờ** thấy token thật — mọi request tới backend đi qua `apiGet/apiPost/apiGetFile` (kênh `api:get/post/getfile`), main tự gắn header `Authorization: Bearer` trong `apiFetch()` ([electron/main.cjs:788-820](../electron/main.cjs)).

## 4. Compass (la bàn)

**Người dùng thấy gì:** la bàn ngang nằm giữa trên cùng màn hình, hiện tên địa danh gần trong bán kính 1.500m kèm khoảng cách, không đè chữ lên nhau; bạn bè luôn hiện trên la bàn kèm nhãn `BẠN` và khoảng cách — nếu bạn ở ngoài khung hình thì ghim vào cạnh la bàn gần nhất.

**Luồng kỹ thuật:**
- Widget: [src/CompassWidget.tsx](../src/CompassWidget.tsx); logic tính toán vị trí/góc/label tách riêng ở [src/compass-compute.ts](../src/compass-compute.ts) và chạy trong Web Worker ([src/compass.worker.ts](../src/compass.worker.ts)) để không giật khung hình chính khi tính toán nhiều điểm.
- Dữ liệu địa danh tĩnh cache theo bản đồ, tọa độ người chơi/bạn bè lấy từ frame `live` (xem mục 8 — Luồng dữ liệu WebSocket).
- Góc xoay được nội suy (interpolate) giữa các frame để chuyển động mượt thay vì giật theo từng gói dữ liệu.

## 5. Radar & Live map

**Người dùng thấy gì:** radar/minimap nổi, dạng tròn hoặc vuông, chỉnh được kích thước/phạm vi/nhãn; lọc hiển thị theo loại (sanctuary, khu di cư, khu tuần tra, địa điểm khác, bạn bè) — bộ lọc này dùng chung giữa Radar và Compass. Tab "Live Map" trong cửa sổ Menu là bản đồ đầy đủ, có bộ lọc theo danh mục và các điểm spawn thức ăn. Trong lúc chơi, nhấn phím tắt bản đồ (mặc định `M`, đổi được trong Settings) để mở đúng giao diện Live Map đó dưới dạng một panel lớn gần full màn hình đè lên overlay, thay cho minimap nhỏ — xem mục 2.

**Luồng kỹ thuật:**
- Radar mini render qua [src/RadarPanel.tsx](../src/RadarPanel.tsx)/[src/RadarView.tsx](../src/RadarView.tsx); có thể tách ra cửa sổ Electron riêng (`RadarWindow`) — bật/tắt qua kênh `radar:toggle`, vị trí/kích thước cửa sổ được lưu qua `radar:setBounds` và khôi phục ở lần mở sau ([electron/main.cjs:464-522](../electron/main.cjs)).
- Bản đồ đầy đủ: [src/LiveMapTab.tsx](../src/LiveMapTab.tsx) dùng [src/livemap/MapCanvas.tsx](../src/livemap/MapCanvas.tsx) (canvas vẽ tay, không dùng thư viện bản đồ ngoài) với hệ số hiệu chỉnh toạ độ tại [src/livemap/calibration.ts](../src/livemap/calibration.ts) và danh sách điểm spawn thức ăn tại [src/livemap/isle-food-spawns.ts](../src/livemap/isle-food-spawns.ts). Cùng component `LiveMapTab` này được dùng lại nguyên vẹn ở cả tab "Live Map" (cửa sổ Menu) và panel bản đồ full màn hình [src/FullMapOverlay.tsx](../src/FullMapOverlay.tsx) (cửa sổ overlay, mở bằng phím `mapKey` — xem mục 2).
- Bộ lọc hiển thị dùng chung state `mapTracking` (sanctuaries/migration/patrol/places/friends) lưu trong settings, chia sẻ giữa Radar/Compass/LiveMap — xem [src/map-tracking.ts](../src/map-tracking.ts).
- Vị trí/hướng người chơi và bạn bè đến từ WebSocket live (mục 8), không phải poll HTTP.

## 6. Skin tools

**Người dùng thấy gì:** chỉnh màu da khủng long theo từng vùng (thân, bụng, chi tiết, chi tiết-2, mắt, viền mắt) với preview 3D xoay được ngay trong app; lưu/nạp/xoá/đặt-lại/random preset skin; xem cửa hàng skin để mua thêm mẫu.

**Luồng kỹ thuật:**
- Editor: [src/SkinEditorTab.tsx](../src/SkinEditorTab.tsx) + [src/ColorPicker.tsx](../src/ColorPicker.tsx).
- Preview 3D: [src/skin3d/skin-viewer-3d.tsx](../src/skin3d/skin-viewer-3d.tsx) (React Three Fiber), model theo loài lấy từ [src/skin3d/registry.ts](../src/skin3d/registry.ts), việc "bake" màu/pattern/texture/normal-map lên model nằm ở [src/skin3d/bake.ts](../src/skin3d/bake.ts) (file lớn nhất trong nhóm skin, xử lý cả trường hợp da juvenile và da "glitched").
- Khi chỉnh màu xong và muốn áp dụng ngay trong game khi đang sống, gọi `window.isleOverlay.sendLiveSkin(...)` → kênh `skin:send`, main forward lên backend qua WebSocket/API tương ứng để server áp dụng cho dino đang sống.
- Cửa hàng: [src/SkinShopTab.tsx](../src/SkinShopTab.tsx) — fetch danh sách skin khả dụng/đã sở hữu qua `apiGet`, mua qua `apiPost`.
- Catalog tĩnh nguồn model/vật liệu tại [resources/mat_files.json](../resources/mat_files.json), [resources/sm_files.json](../resources/sm_files.json), [resources/bp_files.json](../resources/bp_files.json), được `extraResources` đóng gói kèm app (xem [package.json](../package.json)).

## 7. Garage & Shops

**Người dùng thấy gì:** xem danh sách khủng long đã "park" (gửi xe) cùng chỉ số sinh tồn, tăng trưởng, trạng thái Prime, bảng màu; có thể park, hồi sinh/live-swap, bán, đổi tên, hoặc "slay" (nếu server cho phép); chọn đột biến (mutation) nếu server hỗ trợ. Dino Shop cho phép mua loài mới bằng số dư tài khoản.

**Luồng kỹ thuật:**
- [src/GarageTab.tsx](../src/GarageTab.tsx) — mọi hành động (park/restore/sell/rename/slay) là các lệnh `apiPost` riêng lẻ tới backend; UI chỉ hiện nút hành động nào server báo là được phép (flag trả về cùng dữ liệu garage).
- [src/DinoShopTab.tsx](../src/DinoShopTab.tsx) — luồng mua: fetch catalog + số dư qua `apiGet`, xác nhận mua qua `apiPost`, cập nhật số dư/quyền sở hữu từ response.

## 8. Prime / chỉ số sống / dữ liệu real-time

**Người dùng thấy gì:** chỉ số máu, năng lượng (stamina), đói, khát, tăng trưởng hiển thị dạng thanh hoặc vòng tròn; theo dõi dinh dưỡng carb/protein/lipid; danh sách điều kiện Prime/Prime Elder đã hoàn thành và còn thiếu, cập nhật theo thời gian thực khi đang chơi.

**Luồng kỹ thuật (luồng dữ liệu WebSocket — dùng chung cho Compass/Radar/HUD số liệu):**
1. Main process mở kết nối WS tới backend, URL suy ra bằng cách đổi `http`→`ws` trên `apiBaseUrl` (hàm `baseWs()`, [src/App.tsx:944-946](../src/App.tsx) phía renderer dùng lại logic tương tự để hiển thị trạng thái kết nối).
2. Frame thô (text) được đẩy vào một `worker_threads.Worker` riêng chạy [electron/live-worker.cjs](../electron/live-worker.cjs) để parse JSON ngoài main thread (`startLiveWorker()`, [electron/main.cjs:905-927](../electron/main.cjs); `parseLiveFrame()`, dòng 929-941), tránh block UI main process khi có nhiều gói tin.
3. Kết quả được `dispatchLiveFrame()` ([electron/main.cjs:829-838](../electron/main.cjs)) phân loại và gửi renderer qua 3 kênh:
   - `overlay:live` — payload dạng `{t:"live", d:{growth, health, hunger, thirst, stamina, steamId, hasDino, ...}}`.
   - `overlay:troll` / `overlay:troll-audio` — sự kiện media/âm thanh do server/admin kích hoạt (xem mục 9).
   - `overlay:ticket` — cập nhật ticket hỗ trợ (xem mục 10).
4. Renderer nhận qua `onLive(cb)`, lưu vào state `live`; hàm `mergeLive()` ([src/App.tsx:971-989](../src/App.tsx)) merge frame `live` (chỉ số tức thời) vào snapshot REST `me` (lấy một lần từ `/api/overlay/me` khi mở app) để ra object thống nhất `view` — đây là nguồn dữ liệu chung cho HUD số liệu, Prime checklist, Compass, Radar.
5. Các widget hiển thị (`StatsWidget` — [src/StatsWidget.tsx](../src/StatsWidget.tsx), `HeartHud` — [src/HeartHud.tsx](../src/HeartHud.tsx), dùng lại trong `App.tsx` làm widget kéo-thả độc lập trên overlay) chỉ đọc `view`, không tự gọi API/WS.

## 9. Sự kiện media/troll do server điều khiển

**Người dùng thấy gì:** admin/server có thể kích hoạt hiệu ứng hình ảnh/âm thanh phủ lên màn hình người chơi (ví dụ để chọc/thông báo).

**Luồng kỹ thuật:**
- [src/TrollLayer.tsx](../src/TrollLayer.tsx) subscribe `onTroll`/`onTrollAudio`; dữ liệu đến từ cùng luồng WebSocket ở mục 8, phân loại bởi `dispatchLiveFrame()`.

## 10. Ticket hỗ trợ (Support)

**Người dùng thấy gì:** hộp thư ticket hỗ trợ, có đánh dấu chưa đọc/khẩn cấp; xem trạng thái admin đang online/available.

**Luồng kỹ thuật:**
- [src/TicketsTab.tsx](../src/TicketsTab.tsx) — danh sách/nội dung ticket qua `apiGet/apiPost`; cập nhật real-time (ticket mới, đổi trạng thái) qua kênh `overlay:ticket` (`onTicket(cb)`), cùng nguồn dữ liệu WS ở mục 8.
- `ticketSummary` (đếm chưa đọc/khẩn cấp) được cửa sổ Menu (`src/MenuWindow.tsx`) tự fetch qua IPC riêng để hiện badge. Overlay chính không còn polling dữ liệu này — icon lá thư mở nhanh menu và polling `ticketSummary` phía overlay đã bị bỏ cùng lúc tách Menu window ra (mục 2).

## 11. Admin & Map Editor

**Người dùng thấy gì (chỉ tài khoản có quyền admin):** trạng thái admin online/available; công cụ chỉnh sửa bản đồ cho phép chọn mesh/blueprint từ danh mục (có mục yêu thích & gần đây), đặt theo vị trí người chơi/hướng nhìn/toạ độ XYZ, biến đổi (transform), spawn, focus, bring (đưa vật thể tới người chơi), teleport, xoá.

**Luồng kỹ thuật:**
- [src/AdminTab.tsx](../src/AdminTab.tsx) — trạng thái admin qua `apiGet/apiPost`.
- [src/MapEditorTab.tsx](../src/MapEditorTab.tsx) (1000+ dòng, tab lớn nhất) — danh mục mesh/blueprint lấy qua kênh `mapedit:getCatalog` (main đọc từ `resources/*.json` tĩnh, không gọi mạng); mỗi hành động (spawn/transform/teleport/xoá...) là một lệnh `apiPost` riêng gửi lên backend để backend forward vào game server.
- Quyền truy cập cả tab Admin và Map Editor gác bởi `adminModeOn`/`mapEditAdmin` (mục 2), do backend cấp khi đăng nhập — không cấu hình được từ client.

## 12. Cấu hình & cài đặt người dùng

**Người dùng thấy gì:** đổi ngôn ngữ (Anh/Việt — mặc định theo `build.config.json` cho tới khi người dùng tự chọn, sau đó nhớ lựa chọn), kiểu hiển thị chỉ số (thanh/vòng tròn), độ trong suốt HUD, màu accent/màu từng chỉ số, streamer mode (ẩn thông tin nhạy cảm khi stream), compatibility mode, phím tắt bản đồ (mặc định `M`)/cursor, hình dạng/kích thước/phạm vi radar, và bật/tắt "Chỉnh vị trí HUD" để tạm thời kéo/resize widget overlay. Tất cả các thiết lập này đều nằm trong Settings của cửa sổ Menu (không còn ở dashboard mở đè trên overlay).

**Luồng kỹ thuật:**
- Toàn bộ nằm trong một object `OverlaySettings`, đọc/ghi qua `getSettings()/setSettings()` (kênh `overlay:getSettings`/`overlay:setSettings`); main ghi xuống file settings JSON trên đĩa rồi phát lại `settings:changed` để mọi cửa sổ (overlay chính + radar) đồng bộ ngay.
- Giá trị khởi tạo lần đầu cài app lấy từ `defaultUserSettings` trong [build.config.json](../build.config.json) (merge với [build.edition.json](DEVELOPMENT.md#chiến-lược-server-edition) nếu có).
- i18n: [src/i18n.ts](../src/i18n.ts) là một `Record<string,string>` tiếng Việt tra theo key tiếng Anh qua hàm `tr(lang, key)`/`t(key)`, dùng trực tiếp trong JSX (`t("Dashboard")` → "Bảng điều khiển"); không có số nhiều/ICU, phù hợp vì phần lớn chuỗi là nhãn UI ngắn.

## 13. Cập nhật tự động & kill-switch từ xa

**Người dùng thấy gì:** app tự kiểm tra bản cập nhật mới và tự cài, không cần tải thủ công.

**Luồng kỹ thuật:**
- `initAutoUpdate()` ([electron/main.cjs:1305-1331](../electron/main.cjs)) dùng `electron-updater`, kiểm tra mỗi 10 phút qua kênh GitHub Releases tương ứng edition (`updateChannel` trong build config), tự quit-and-install khi tải xong (`update-downloaded`). Renderer chỉ hiện trạng thái qua `onUpdaterEvent`/`updaterCheck`/`updaterRestart`.
- **Không có trong README, cần lưu ý khi vận hành:** `checkLicense()` ([electron/main.cjs:1246-1256](../electron/main.cjs)) poll `https://<apiBaseUrl>/cdn/launcher/status.yml` mỗi 5 phút; nếu cờ `wrightynice: false` thì main tự vô hiệu hoá overlay (đóng radar, tắt cursor, phát `overlay:blocked` cho renderer hiện thông báo chặn). Đây là cơ chế kill-switch điều khiển từ xa qua backend, không nằm trong mã nguồn client mở.

---

Xem thêm: [DEVELOPMENT.md](DEVELOPMENT.md) (kiến trúc & hướng dẫn code), [HANDOVER.md](HANDOVER.md) (tiếp nhận dự án).
