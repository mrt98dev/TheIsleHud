# Hướng dẫn phát triển — TheIsleHud

## 1. Yêu cầu môi trường

- **Windows** — bắt buộc để chạy/test app thật (overlay dùng Win32 API qua `koffi`, hotkey toàn cục qua `uiohook-napi`). Không chạy được (hoặc chỉ chạy được phần renderer) trên macOS/Linux.
- **Node.js 22** và **npm**.
- Không có backend đi kèm repo này — mặc định trỏ về `https://islepilot.eu`; các tính năng cần server (auth, garage, shop, ticket, admin...) chỉ hoạt động với backend tương thích (xem [HANDOVER.md](HANDOVER.md)).

## 2. Cài đặt & chạy dev

```powershell
npm ci
npm run dev
```

`npm run dev` chạy song song (qua `concurrently`): Vite dev server (cổng `5173`) + Electron trỏ `VITE_DEV_SERVER_URL` vào server đó, chờ bằng `wait-on` (xem script trong [package.json](../package.json)). Sửa code trong `src/` sẽ hot-reload renderer; sửa code trong `electron/` cần tắt/bật lại `npm run dev`.

```powershell
npm run typecheck   # tsc --noEmit, chạy độc lập không build
npm run build        # typecheck + vite build (bắt buộc trước khi đóng gói)
npm run pack          # build rồi electron-builder --dir (không tạo installer, để test nhanh thư mục app)
npm run dist -- --publish never   # build rồi tạo installer .exe đầy đủ
```

## 3. Cấu trúc thư mục

```
electron/        Main process (Node/Electron), chạy dưới quyền hệ điều hành
  main.cjs           entrypoint: cửa sổ, tracking game, IPC, auth, auto-update, kill-switch
  preload.cjs         cầu nối contextBridge → window.isleOverlay cho renderer
  overlay-config.cjs  hằng số/cấu hình dò game & hotkey (không chứa logic cửa sổ)
  native-windows.cjs  FFI (koffi) gọi user32/kernel32 để tìm/định vị cửa sổ game
  live-worker.cjs     worker_thread parse frame WebSocket ngoài main thread

src/              Renderer (React + TS), build bằng Vite, không có quyền Node trực tiếp
  main.tsx            entrypoint, chọn App vs RadarWindow theo location.hash
  App.tsx             overlay chính: state toàn cục, widget kéo-thả, mở/đóng dashboard
  MainWindow.tsx       dashboard (F8): tab-shell + widget dùng chung (StatsWidget, HeartHud)
  RadarWindow.tsx      cửa sổ radar tách rời
  *Tab.tsx             từng tab dashboard, tự fetch dữ liệu riêng (xem FEATURES.md)
  CompassWidget.tsx, compass-compute.ts, compass.worker.ts   la bàn + tính toán nền
  livemap/            bản đồ đầy đủ: canvas vẽ tay, hiệu chỉnh toạ độ, spawn thức ăn
  skin3d/             preview 3D skin (React Three Fiber), bake màu/texture lên model
  i18n.ts             từ điển vi/en

resources/        Catalog tĩnh (mesh/material/blueprint cho Map Editor), đóng gói kèm app
build.config.json  Cấu hình mặc định bản generic (commit trên main)
build.edition.json Cấu hình riêng theo server-edition (KHÔNG có trên main, chỉ trên nhánh edition)
```

Xem mô tả luồng chạy chi tiết từng tính năng tại [FEATURES.md](FEATURES.md).

## 4. Kiến trúc tổng quan: main process vs renderer

Nguyên tắc bắt buộc phải giữ khi sửa code:

- **Renderer không bao giờ được cầm token/credential thật.** Mọi gọi backend đi qua `window.isleOverlay.apiGet/apiPost/apiGetFile` để main process tự gắn `Authorization: Bearer`. Nếu thêm tính năng mới cần gọi API, **không** fetch trực tiếp từ `src/`, luôn thêm qua proxy IPC trong `main.cjs` + expose thêm hàm trong `preload.cjs`.
- **Mọi kênh IPC mới phải khai báo ở cả 3 nơi**: `ipcMain.handle`/`ipcMain.on` trong `main.cjs`, expose tương ứng trong `preload.cjs` (`contextBridge.exposeInMainWorld`), và type trong `src/preload.d.ts`. Thiếu một trong ba sẽ lỗi runtime hoặc mất type-check.
- **2 cửa sổ = 2 React root độc lập** (App vs RadarWindow), không share React state trực tiếp — đồng bộ giữa 2 cửa sổ luôn phải đi qua main process (event `settings:changed`, `overlay:live`, `radar:changed`...). Đừng giả định 2 cửa sổ dùng chung module-level state.
- **Dữ liệu real-time đi qua một pipeline duy nhất**: WS → `live-worker.cjs` (parse) → `dispatchLiveFrame()` phân loại → renderer merge vào `view` (`mergeLive()` trong `App.tsx`). Muốn thêm loại dữ liệu real-time mới, sửa 3 điểm này, không tạo kết nối WS riêng trong renderer.

## 5. Chiến lược server-edition (`build.config.json` vs `build.edition.json`)

- `build.config.json` là cấu hình **generic**, luôn commit trên `main`, `gameMonitoringServerId: null` (ẩn widget trạng thái server).
- `build.edition.json` **không tồn tại trên `main`** — chỉ được tạo/maintain trên từng nhánh edition riêng của mỗi server cộng đồng dùng HUD này. Ở runtime, main.cjs đọc cả hai và merge nông (`{...base, ...edition}`) — field nào edition khai báo sẽ ghi đè field cùng tên của base.
- **Để tạo một edition mới:** tạo nhánh riêng từ `main`, thêm file `build.edition.json` ở root với các field cần override (tối thiểu là `serverName`, `gameMonitoringServerId`, `editionName`, `updateChannel`), không sửa `build.config.json`. Điều này giữ `main` luôn generic và tránh lẫn cấu hình server cụ thể vào lịch sử nhánh chính.
- `defaultUserSettings` trong config chỉ áp dụng cho **lần cài đặt đầu tiên**; sau đó người dùng override qua Settings panel trong app, lưu vào file settings riêng trên máy, không đụng vào 2 file config này nữa.

## 6. Build, đóng gói & release

- Đóng gói local: `npm run dist -- --publish never` → xuất `release/TheIsleHud-<version>-Setup.exe` (NSIS, one-click installer, x64, xem cấu hình `build` trong [package.json](../package.json)).
- `asarUnpack` bắt buộc giữ `uiohook-napi` và `koffi` ngoài asar vì đây là native binding — nếu bổ sung native module mới, nhớ thêm vào danh sách này.
- **CI/CD** ([.github/workflows/release.yml](../.github/workflows/release.yml)): chạy trên mọi push/PR vào `main` và mọi tag `v*`.
  - Push/PR thường → build Windows, chỉ upload installer làm workflow artifact (không publish Release).
  - Tag `v*` → kiểm tra tag phải khớp `version` trong `package.json` (build fail nếu lệch), lấy nội dung release notes từ `release-notes/<tag>.md` nếu có, publish GitHub Release kèm `.exe` + `.exe.blockmap` + `latest.yml`.
- **Quy trình phát hành bản generic:**
  ```powershell
  npm version patch     # hoặc minor/major — tự bump package.json + tạo tag
  git push origin main --follow-tags
  ```
- **Quy trình phát hành bản edition** (cho một server cụ thể): thực hiện trên nhánh edition riêng của server đó, tag dạng `v<version>-<tên-edition>.1`; GitHub Release nên đánh dấu pre-release và gắn nhãn riêng cho edition đó — nhánh `main` không bao giờ nhận tag/release dạng edition.
- Trước khi tạo release, nên viết trước `release-notes/vX.Y.Z.md` (đặt tên khớp tag sắp tạo, ví dụ tag `v1.0.0` → file `release-notes/v1.0.0.md`) để CI có nội dung thay vì changelog rỗng.

## 7. Sync code từ upstream

Repo giữ lại lịch sử Git của upstream `reversum/isle-overlay`:

```powershell
git fetch upstream
git merge upstream/main
```

Rà soát conflict cẩn thận — các thay đổi về branding, `apiBaseUrl`, và tích hợp backend riêng rất dễ bị merge đè mất. Không rebase lên upstream nếu không chắc — merge giữ lại rõ ràng hơn ai đổi gì.

## 8. Quy ước code quan sát được trong repo

- **i18n:** không hard-code chuỗi tiếng Việt trong JSX; viết chuỗi tiếng Anh làm key rồi bọc `t("...")`, thêm bản dịch vào từ điển `VI` trong [src/i18n.ts](../src/i18n.ts). Chuỗi không có trong từ điển sẽ hiển thị nguyên văn tiếng Anh (fallback an toàn, không throw).
- **Tab component pattern:** mỗi tab trong dashboard là 1 file độc lập, nhận `authed`/`onLogin` (và đôi khi cờ quyền như `supportOn`) qua props, tự gọi `apiGet/apiPost` bên trong, không đi qua một data-layer chung. Khi thêm tab mới, theo đúng pattern này thay vì tạo store toàn cục.
- **IPC naming:** kênh đặt tên `domain:action` (`overlay:getSettings`, `radar:toggle`, `auth:steamLogin`...) — theo đúng convention này khi thêm kênh mới để dễ tra trong `main.cjs`.
- **Không có test tự động** trong repo (không có Jest/Vitest/Playwright config). `npm run typecheck` là lưới an toàn duy nhất trước khi build — chạy trước khi mở PR.

## 9. Mẹo debug

- **Renderer:** chạy `npm run dev`, mở DevTools bằng cách gọi `webContents.openDevTools()` tạm thời trong `createWindow()`/`openRadar()` (không commit lại) — cửa sổ overlay production ẩn DevTools.
- **Main process:** log bằng `console.log` trong `main.cjs` xuất hiện thẳng ra terminal chạy `npm run dev` (Electron main process kế thừa stdout của tiến trình cha khi chạy dev, không cần công cụ riêng).
- **Live-worker:** vì chạy trong `worker_threads`, lỗi ở đây không tự nổi lên console main — bọc try/catch quanh `parseLiveFrame()` khi debug dữ liệu WS bất thường.
- **Game không được overlay nhận diện:** kiểm tra tên tiến trình thực tế của game (Task Manager) có khớp danh sách trong [electron/overlay-config.cjs](../electron/overlay-config.cjs) không — đây là nguyên nhân phổ biến nhất khi overlay không tự hiện.
- **Overlay tự tắt không rõ lý do:** kiểm tra `overlay:blocked` — có thể do `checkLicense()` nhận `wrightynice: false` từ `status.yml` phía backend (xem [FEATURES.md §13](FEATURES.md#13-cập-nhật-tự-động--kill-switch-từ-xa)), không phải lỗi ở client.

---

Xem thêm: [FEATURES.md](FEATURES.md) (toàn bộ tính năng & luồng chạy), [HANDOVER.md](HANDOVER.md) (tiếp nhận dự án).
