# Implementation plan: Tách Menu HUD + Bản đồ full màn hình

Spec: [2026-09-09-menu-window-split-design.md](../specs/2026-09-09-menu-window-split-design.md)

Thứ tự các bước dưới đây có phụ thuộc tuyến tính (mỗi bước dùng lại hạ tầng
của bước trước), nên thực hiện đúng thứ tự. Mỗi bước kết thúc bằng
`npm run typecheck` (và khởi động `npm run dev` khi cần kiểm tra hành vi
runtime) trước khi qua bước kế.

## Bước 1 — Settings schema: thêm `menuBounds`/`mapKey`, gỡ `dashKey`

**File:** `electron/main.cjs`

- Thêm `menuBounds: null` và `mapKey: "M"` vào `defaultSettings`.
- Thêm nhánh tương ứng trong `normalizeSettings()`:
  - `menuBounds`: giữ nguyên logic như `radarBounds` (object hoặc `null`).
  - `mapKey`: string, fallback `defaultSettings.mapKey`.
- Xoá `dashKey` khỏi `defaultSettings` và `normalizeSettings()`.
- Xoá đọc `buildConfig.dashKey` (giữ `buildString("dashKey", "F8")` không
  còn dùng — xoá luôn dòng đó).

**Kiểm tra:** `npm run typecheck`. Chạy `npm run dev`, mở DevTools console
overlay (tạm thời bật `devTools:true` nếu cần) hoặc log `readSettings()` để
xác nhận `menuBounds:null, mapKey:"M"` xuất hiện, không còn `dashKey`.

## Bước 2 — Gỡ hạ tầng phím tắt F8 khỏi main process

**File:** `electron/main.cjs`, `electron/overlay-config.cjs`

- Xoá biến `dashOn`, `dashKeyHeld`, `dashShortcutAccelerator`,
  `dashShortcutRegistered`.
- Xoá hàm `toggleDash()`, `registerDashShortcut()`.
- Trong `startCursorHook()`: xoá nhánh xử lý `dashCode`/`dashKeyHeld` trong
  cả `keydown` và `keyup` listener (giữ nguyên nhánh `cursorKey`).
- Trong `app.whenReady()`: xoá lời gọi `registerDashShortcut()`.
- Xoá export/dùng `dashAccelerator` từ `overlay-config.cjs` nếu không còn
  chỗ nào dùng (sẽ dùng lại dưới dạng `mapAccelerator` ở Bước 6 — xem xét
  đổi tên thay vì xoá hẳn, để tái dùng logic parse-key).
- Xoá IPC handler `ipcMain.handle("dash:recordKey", ...)`.
- `refreshBranding()`: đổi label tray "Show / hide dashboard" tạm thời giữ
  nguyên (sẽ đổi ở Bước 3 khi có `toggleMenu()`).

**Kiểm tra:** `npm run typecheck`. `npm run dev`, xác nhận app chạy không
crash (F8 tạm thời không làm gì — chưa nối vào menu window, sẽ nối ở Bước 3).

## Bước 3 — Tạo Menu window trong main process

**File:** `electron/main.cjs`

- Thêm biến `menuWindow = null`.
- Thêm `createMenuWindow()`: `BrowserWindow` với `frame:false`,
  `transparent:false`, `resizable:true`, `movable:true`,
  `minimizable:true`, `maximizable:true`, `skipTaskbar:false`,
  `hasShadow:true`, `show:false`, cùng `webPreferences.preload` như
  `mainWindow`. Load `dist/index.html#menu` (dev: `${devUrl}#menu`).
  Khôi phục bounds từ `readSettings().menuBounds` nếu có, nếu không dùng
  kích thước mặc định hợp lý (ví dụ 1100×720, căn giữa màn hình chính).
- `openMenu()`: tạo nếu chưa có, `show()` + `focus()`.
- `closeMenu()`: `menuWindow.hide()` (không destroy).
- `toggleMenu()`: nếu đang visible và focused → `closeMenu()`, ngược lại
  → `openMenu()`.
- Lưu bounds: listener `resize`/`move` → `writeSettings({ menuBounds:
  menuWindow.getBounds() })` (debounce theo cơ chế `scheduleSettingsWrite`
  đã có).
- `menuWindow.on("close", (e) => { e.preventDefault(); closeMenu(); })` để
  nút ❌ tự vẽ (gọi qua IPC ở Bước 4) chỉ ẩn, không destroy — hoặc xử lý
  trực tiếp trong renderer bằng gọi `menu.close()` thay vì bắt event
  `close` gốc (chọn cách renderer gọi IPC tường minh, đơn giản hơn).
- Tray: đổi label "Show / hide dashboard" → "Show / hide menu", handler
  gọi `toggleMenu()`. Double-click tray → `toggleMenu()`.
- `app.whenReady()`: gọi `createMenuWindow()` rồi `openMenu()` sau
  `createWindow()`/`createTray()` (menu mở sẵn khi khởi động).
- IPC mới: `ipcMain.handle("menu:toggle", () => toggleMenu())`,
  `ipcMain.handle("menu:open", () => openMenu())`,
  `ipcMain.handle("menu:close", () => closeMenu())`.
- `dispatchLiveFrame()`: thêm `if (menuWindow && !menuWindow.isDestroyed())
  menuWindow.webContents.send("overlay:live", frame.d)` cùng nhánh gửi cho
  `mainWindow`/`radarWindow`.
- `app.on("before-quit")`/`window-all-closed`: đảm bảo còn overlay window
  làm mốc quit (không đổi logic hiện tại vì `mainWindow` vẫn là cửa sổ
  chính của `window-all-closed`).

**File:** `electron/preload.cjs`, `src/preload.d.ts`

- Thêm `menu: { toggle: () => ipcRenderer.invoke("menu:toggle"), open: () =>
  ipcRenderer.invoke("menu:open"), close: () => ipcRenderer.invoke("menu:close") }`
  vào object expose (đặt cạnh `radar.*` hiện có).
- Cập nhật type trong `preload.d.ts` tương ứng.

**Kiểm tra:** `npm run dev` → thấy 2 cửa sổ: overlay (không frame, không
taskbar) + menu (có taskbar, mở sẵn). Đóng menu bằng cách gọi tạm
`window.isleOverlay.menu.close()` trong DevTools console của menu window →
ẩn xuống, click tray hoặc gọi `menu.open()` → hiện lại đúng vị trí.

## Bước 4 — Route `#menu` + tách `MenuWindow.tsx` khỏi `MainWindow.tsx`

**File mới:** `src/HeartHud.tsx`, `src/StatsWidget.tsx`

- Di chuyển nguyên `HeartHud` và `StatsWidget` (component + type liên quan
  trực tiếp, ví dụ `STAT_ICONS` nếu chỉ dùng ở đây) từ `src/MainWindow.tsx`
  sang 2 file riêng này. Export giữ tên cũ.

**File mới:** `src/MenuWindow.tsx`

- Copy phần còn lại của `MainWindow.tsx` (hàm `MainWindow()`, `TABS`,
  `TAB_ICONS`, `TabIcon`, và toàn bộ JSX khung tab) thành component
  `MenuWindow()` — **là root component**, không nhận props từ App.tsx nữa.
- Thêm phần bootstrap độc lập ở đầu `MenuWindow()` (copy logic tương ứng
  từ `App.tsx`, đơn giản hoá vì không cần biết `mainOpen`):
  - `getSettings()`/`onSettingsChanged` → state settings/theme/opacity.
  - `getAuth()`/`onAuthChanged` → state auth.
  - `useMe`/`useLive`/`useServerStatus` (import từ `App.tsx` nếu đang
    export, hoặc di chuyển các hook này sang một module chia sẻ mới
    `src/hud-data.ts` nếu `App.tsx` cần giữ bản riêng — quyết định tại thời
    điểm code theo nguyên tắc "không share React state giữa renderer", các
    hook chỉ gọi IPC nên có thể dùng lại y nguyên ở cả hai file).
  - Ticket summary polling (chuyển nguyên từ `App.tsx`).
  - `BootScreen` (chuyển nguyên từ `App.tsx`, chỉ hiện trong Menu window).
  - Màn hình bị khoá license (chuyển nguyên, nội dung thay thế bên trong
    `MenuWindow`, không đóng cửa sổ — cửa sổ vẫn `show`).
- Xoá `onClose`/nút "Hide dashboard" trong header — không còn cần vì cửa sổ
  tự có titlebar/nút ❌ riêng (Bước 5).

**File:** `src/main.tsx`

```ts
const hash = window.location.hash.replace(/^#/, "");
const isRadar = hash.startsWith("radar");
const isMenu = hash.startsWith("menu");
createRoot(...).render(
  isRadar ? <RadarWindow /> : isMenu ? <MenuWindow /> : <App />
);
```

**Kiểm tra:** `npm run typecheck`. `npm run dev` → menu window hiện đúng
nội dung tab/login/boot-screen; overlay chưa cần đổi gì ở bước này (App.tsx
vẫn còn render `<MainWindow>` cũ — sẽ xoá ở Bước 5, để tránh app crash giữa
chừng nếu build từng phần).

## Bước 5 — Dọn `App.tsx`: bỏ menu-trong-overlay, thêm titlebar cho Menu window

**File:** `src/MenuWindow.tsx`

- Thêm titlebar tự vẽ ở đầu component: vùng kéo di chuyển cửa sổ (theo
  pattern thủ công giống `RadarWindow.tsx` — `onPointerDown` tính offset,
  gọi IPC set bounds mới `menu.getBounds()/menu.setBounds()` nếu cần kéo
  bằng tay, HOẶC đơn giản hơn: dùng CSS `-webkit-app-region: drag` trên
  thanh titlebar vì `menuWindow` có `frame:false` nhưng không cần logic
  thủ công phức tạp như radar — chọn CSS app-region để đỡ code, chỉ đặt
  `-webkit-app-region: no-drag` cho các nút bấm bên trong titlebar).
- Thêm 3 nút: minimize, maximize/restore, close — gọi IPC mới
  `window.isleOverlay.menu.minimize()/maximize()/close()`.

**File:** `electron/main.cjs` + preload

- Thêm IPC `menu:minimize` (`menuWindow.minimize()`), `menu:maximize`
  (toggle `menuWindow.isMaximized() ? unmaximize() : maximize()`),
  `menu:close` (đã có ở Bước 3, dùng lại — gọi `closeMenu()` chứ không
  `menuWindow.close()` thật).

**File:** `src/App.tsx`

- Xoá state `mainOpen`, `settingsOpen`, `ticketSummary`,
  `focusSupportSignal`.
- Xoá render `<MainWindow>`, `<SettingsPanel>` (định nghĩa `SettingsPanel`
  trong `App.tsx` — xoá luôn, đã chuyển logic vào `MenuWindow.tsx` ở
  Bước 4/tự viết tương đương ở đó nếu chưa copy hết).
- Xoá nút `statusPill` và icon lá thư (`envelopeFloat`) + polling ticket
  liên quan.
- Xoá `useEffect` lắng nghe `onDash`/gọi `setDashOpen` (không còn API này
  theo spec — xem Bước 6 sẽ thêm `onHudEdit` thay thế).
- Class CSS trên root: đổi `${mainOpen ? "dashboardOpen" : ""}` →
  `${hudEditMode ? "hudEditMode" : ""}` (state mới, thêm ở Bước 6).

**File:** `src/styles.css`

- Đổi selector `.dashboardOpen .panelResizeHandle` → `.hudEditMode
  .panelResizeHandle`.

**Kiểm tra:** `npm run typecheck`. `npm run dev` → overlay chỉ còn widget
số liệu, không còn statusPill/envelope/menu nào trong overlay. Menu window
có titlebar riêng, minimize/maximize/close hoạt động, không quit app khi
đóng.

## Bước 6 — Chế độ "Chỉnh vị trí HUD" (`hudEditMode`)

**File:** `electron/main.cjs`

- Thêm `let hudEditMode = false; let fullMapOpen = false;` (khai báo
  `fullMapOpen` trước cho Bước 7 dùng chung).
- Thêm hàm `applyOverlayInteractive()`: gọi `setCursor(hudEditMode ||
  fullMapOpen)` (tái dùng `setCursor()` sẵn có).
- IPC `ipcMain.handle("hudEdit:set", (_e, on) => { hudEditMode = !!on;
  applyOverlayInteractive(); if (mainWindow && !mainWindow.isDestroyed())
  mainWindow.webContents.send("hudEdit:changed", hudEditMode); })`.
- `applyLicense()`: khi `licenseBlocked === true`, set `hudEditMode = false;
  fullMapOpen = false;` trước khi gọi `setCursor(false)` (đã có sẵn dòng
  `setCursor(false)` trong hàm này — chỉ cần thêm reset 2 cờ).

**File:** `electron/preload.cjs`, `src/preload.d.ts`

- Thêm `hudEdit: { set: (on: boolean) => ipcRenderer.invoke("hudEdit:set", on) }`.
- Thêm `onHudEdit: (cb) => { ipcRenderer.on("hudEdit:changed", ...); return
  off; }` theo pattern `onDash` cũ (nay xoá) / `onLive` hiện có.

**File:** `src/App.tsx`

- Thêm `const [hudEditMode, setHudEditMode] = useState(false);` +
  `useEffect(() => window.isleOverlay.onHudEdit(setHudEditMode), [])`.

**File:** `src/MenuWindow.tsx` (mục Settings)

- Thêm nút toggle "Chỉnh vị trí HUD": `onClick={() =>
  window.isleOverlay.hudEdit.set(!hudEditModeLocal)}` — cần state cục bộ
  trong Menu window để hiển thị trạng thái ON/OFF hiện tại; vì `hudEditMode`
  sống ở main process, Menu window cũng subscribe `onHudEdit` giống overlay
  để đồng bộ hiển thị nút (không tin tưởng state cục bộ một chiều).

**Kiểm tra:** `npm run dev` → bật "Chỉnh vị trí HUD" trong Menu, quan sát
overlay: resize-handle hiện, kéo/resize widget được, chuột không xuyên qua
overlay xuống game nữa. Tắt đi → ngược lại.

## Bước 7 — Bản đồ full màn hình (`mapKey`, mặc định `M`)

**File:** `electron/overlay-config.cjs`

- Đổi tên (hoặc thêm bản sao) `dashAccelerator` thành `mapAccelerator` (hàm
  parse tên phím thành Electron accelerator string) — logic parse giữ
  nguyên, chỉ đổi tên cho đúng ngữ cảnh.

**File:** `electron/main.cjs`

- Thêm `mapShortcutAccelerator`, `mapShortcutRegistered` (song song với
  biến `dashShortcutAccelerator` đã xoá ở Bước 2, giờ dựng lại riêng cho
  map).
- `registerMapShortcut()`: giống `registerDashShortcut()` cũ nhưng đọc
  `readSettings().mapKey`, callback gọi `toggleFullMap()`.
- `toggleFullMap()`: `fullMapOpen = !fullMapOpen; applyOverlayInteractive();
  if (mainWindow && !mainWindow.isDestroyed())
  mainWindow.webContents.send("fullMap:changed", fullMapOpen);`.
- Trong `startCursorHook()`: thêm nhánh `keydown` bắt phím `mapKey` (giống
  cách `dashKey` cũ từng bắt, dùng `cursorCodeFrom`/tương tự) để hotkey
  hoạt động cả khi game đang focus (không chỉ khi app có focus — lý do
  `uiohook-napi` được dùng cho `dashKey`/`cursorKey` cũ chính là để bắt
  phím toàn cục ngay cả khi Electron window không có OS focus).
- `app.whenReady()`: gọi `registerMapShortcut()` cạnh chỗ từng gọi
  `registerDashShortcut()`.
- IPC mới: `ipcMain.handle("map:recordKey", () => recordKey("mapKey"))`
  (tái dùng hàm `recordKey()` chung đã có, chỉ đổi `recordTarget`).
- Trong `ipcMain.handle("overlay:setSettings", ...)`: thêm nhánh — nếu
  `next.mapKey` thay đổi so với `prev.mapKey` → gọi `registerMapShortcut()`
  (giống nhánh `dashKey` cũ).
- `applyLicense()`: đã reset `fullMapOpen` ở Bước 6, không cần sửa thêm.

**File:** `electron/preload.cjs`, `src/preload.d.ts`

- Thêm `map: { recordKey: () => ipcRenderer.invoke("map:recordKey") }`.
- Thêm `onFullMap: (cb) => {...}` (nhận `fullMap:changed`).
- Thêm `fullMap: { toggle: () => ipcRenderer.invoke("fullMap:toggle") }` và
  IPC handler tương ứng ở main process (dùng khi renderer tự đóng qua nút ❌
  hoặc phím Esc, gọi cùng `toggleFullMap()`).

**File mới:** `src/FullMapOverlay.tsx`

- Nhận props `open: boolean`, `onClose: () => void`, `authed`, `onLogin`.
- Khi `open`, render panel ~90vw×90vh căn giữa, nền mờ tối phía sau, nút ❌
  gọi `onClose`; bên trong render `<LiveMapTab authed={authed}
  onLogin={onLogin} />` full kích thước panel.
- `useEffect` gắn `keydown` listener cho `Escape` khi `open === true`, gọi
  `onClose`.

**File:** `src/App.tsx`

- Thêm `const [fullMapOpen, setFullMapOpen] = useState(false);` +
  `useEffect(() => window.isleOverlay.onFullMap(setFullMapOpen), [])`.
- Render `<FullMapOverlay open={fullMapOpen} onClose={() =>
  window.isleOverlay.fullMap.toggle()} authed={auth.authed} onLogin={login} />`
  cạnh các widget khác.

**File:** `src/MenuWindow.tsx` (mục Settings)

- Thêm mục "Phím mở bản đồ" giống UI "Dashboard hotkey" cũ đã xoá: hiển thị
  `mapKey` hiện tại, các chip phím gợi ý, nút ghi phím tuỳ chỉnh
  (`map.recordKey()`).

**Kiểm tra:** `npm run dev` → nhấn `M` trong lúc overlay đang active (giả
lập game qua `bootGraceUntil` hoặc chạy cùng game thật) → panel bản đồ full
mở, pan/zoom/click POI được; `M`/`Esc`/nút ❌ đóng lại, overlay click-through
trở lại. Đổi phím trong Settings → phím mới hoạt động, phím cũ (`M`) không
còn tác dụng.

## Bước 8 — Dọn tài liệu

**File:** `README.md`, `README.vi.md`, `docs/FEATURES.md`

- Bỏ mọi đoạn nhắc "Press F8 to open/close the dashboard".
- Thêm mô tả: Menu là cửa sổ Windows riêng (mở sẵn khi khởi động, điều
  khiển qua taskbar/tray), overlay chỉ còn widget, phím `M` (đổi được) mở
  bản đồ full.

**Kiểm tra:** đọc lại toàn bộ đoạn liên quan, đảm bảo không còn nhắc F8.

## Bước 9 — QA thủ công tổng thể

Chạy lại đầy đủ danh sách "Kiểm thử" trong spec
([2026-09-09-menu-window-split-design.md](../specs/2026-09-09-menu-window-split-design.md#kiểm-thử-thủ-công-qua-npm-run-dev))
+ `npm run typecheck` sạch + build thử `npm run dist -- --publish never`
(kiểm tra icon taskbar Menu window trong bản đóng gói thật).
