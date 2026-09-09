# Tiếp nhận dự án — TheIsleHud

Tài liệu này dành cho người/nhóm sắp tiếp nhận việc phát triển và vận hành TheIsleHud. Đọc cùng [FEATURES.md](FEATURES.md) (tính năng & luồng chạy) và [DEVELOPMENT.md](DEVELOPMENT.md) (hướng dẫn code) trước khi bắt đầu.

## 1. Tóm tắt dự án

- **TheIsleHud** là HUD overlay Windows cho game *The Isle*, fork từ [reversum/isle-overlay](https://github.com/reversum/isle-overlay) (tác giả gốc: Yannik F / YannikAufDie1).
- Bên duy trì bản fork và phát hành hiện tại: **mrt98dev**, phát triển độc lập, dùng chung cho toàn bộ cộng đồng server (không gắn với một server cụ thể nào).
- Repo giữ nguyên lịch sử Git upstream — đây **không phải** một dự án viết mới hoàn toàn, mà là tuỳ biến trên codebase của người khác. Mọi bản phân phối lại phải giữ ghi công upstream (xem [README.md § License and attribution](../README.md#license-and-attribution)).
- **Tình trạng license:** upstream chưa từng công bố license khi được import vào repo này, nên bản thân dự án cũng không tự cấp license mở. Bản quyền code gốc thuộc về tác giả upstream; xem [LICENSE](../LICENSE) và [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) trước khi quyết định publish/phân phối lại dưới hình thức khác.
- Ứng dụng phụ thuộc một backend ngoài repo (mặc định `https://islepilot.eu`) để chạy đầy đủ tính năng (auth, garage, shop, ticket, admin, GameMonitoring). Repo này chỉ chứa **client**, không chứa server.

## 2. Checklist quyền truy cập cần xin trước khi bắt tay code/release

Đây là danh sách các hạng mục cần xin quyền — **không có giá trị thật nào được lưu trong tài liệu này**, chỉ liệt kê tên để biết cần hỏi ai:

- [ ] Quyền ghi/admin repo GitHub `mrt98dev/TheIsleHud` (để push nhánh, tạo tag, chạy Actions).
- [ ] Bất kỳ secret nào GitHub Actions cần cho release (token publish GitHub Release — hiện workflow dùng `GITHUB_TOKEN` mặc định của Actions nên có thể không cần secret riêng, nhưng cần xác nhận lại nếu quy trình đổi).
- [ ] Thông tin backend `islepilot.eu`: ai vận hành, cách liên hệ khi API/WS đổi breaking change, tài liệu API (nếu có) cho các endpoint app đang gọi (`/api/overlay/me`, auth, garage, shop, ticket, admin, map-editor...).
- [ ] Với mỗi server cộng đồng muốn có bản riêng (edition): quyền truy cập tài khoản GameMonitoring của server đó nếu cần hiển thị widget trạng thái server, và quyền vào nhánh edition tương ứng do server đó tự quản lý.
- [ ] Danh sách người có quyền admin/support trong hệ thống backend, để biết ai test được các tính năng gác quyền (`adminModeOn`, `mapEditAdmin`).

## 3. Bản đồ nhánh & quy trình release (những gì suy ra được từ repo)

- **`main`** — bản generic, dùng chung cho toàn bộ cộng đồng, `gameMonitoringServerId: null`, không có `build.edition.json`. Đây là nhánh phát triển chính.
- **Nhánh edition** — mỗi server cộng đồng muốn có bản riêng (tên server, GameMonitoring ID, kênh update riêng...) tự tạo một nhánh edition từ `main`, thêm `build.edition.json` (xem [DEVELOPMENT.md §5](DEVELOPMENT.md#5-chiến-lược-server-edition-buildconfigjson-vs-buildeditionjson)). Các nhánh này không thuộc phạm vi phát triển chung, tự quản lý bởi từng server.
- Release generic: bump version bằng `npm version patch/minor/major` trên `main`, push kèm tag `v*` → CI tự build + publish GitHub Release (không phải pre-release).
- Release edition: build từ nhánh edition riêng, tag dạng `v<version>-<tên-edition>.1`, publish dưới dạng pre-release với nhãn riêng cho edition đó.
- **Quy tắc bất biến cần giữ:** `main` không bao giờ được nhận `gameMonitoringServerId` hay tag/release kiểu edition của một server cụ thể. Nếu thấy `main` sắp bị merge dính cấu hình edition — dừng lại, đó là lỗi quy trình.
- Chi tiết kỹ thuật của workflow: [.github/workflows/release.yml](../.github/workflows/release.yml) và [DEVELOPMENT.md §6](DEVELOPMENT.md#6-build-đóng-gói--release).

## 4. Known issues / hạn chế quan sát được từ code

- **Không có test tự động** — không có Jest/Vitest/Playwright hay bất kỳ config test nào trong repo. Lưới an toàn duy nhất là `npm run typecheck` (`tsc --noEmit`). Rủi ro: một thay đổi làm sai luồng WS/IPC chỉ phát hiện được bằng test tay trong game thật.
- **File lớn, nhiều trách nhiệm gộp chung** — ứng viên nên refactor tách nhỏ nếu có thời gian:
  - [electron/main.cjs](../electron/main.cjs) (~1300 dòng) — gộp cả window management, game tracking, auth, IPC routing, auto-update, license check trong 1 file.
  - [src/App.tsx](../src/App.tsx) (~1290 dòng) — gộp toàn bộ state toàn cục của overlay chính.
  - [src/MapEditorTab.tsx](../src/MapEditorTab.tsx) (~1080 dòng) — tab lớn nhất, nhiều loại thao tác admin trong 1 component.
- **Cơ chế kill-switch từ xa** (`checkLicense()` poll `status.yml`, xem [FEATURES.md §13](FEATURES.md#13-cập-nhật-tự-động--kill-switch-từ-xa)) không được tài liệu hoá ở README gốc — người tiếp nhận cần biết cơ chế này tồn tại để không nhầm là bug khi overlay tự tắt.
- **Không chạy được đầy đủ ngoài Windows** — `koffi` (Win32 FFI) và `uiohook-napi` (global hook) đều là tính năng riêng của Windows; không có fallback cho macOS/Linux, kể cả để dev.
- **Phụ thuộc cứng vào một backend không thuộc repo** — không có mock/stub server nào đi kèm để dev/test các tính năng phụ thuộc API mà không có backend thật.
- **License chưa rõ ràng** (xem mục 1) — cân nhắc kỹ trước khi mở public repo rộng hơn hiện tại hoặc phát hành dưới license khác.

## 5. Việc nên làm đầu tiên khi nhận bàn giao

1. Đọc [FEATURES.md](FEATURES.md) và [DEVELOPMENT.md](DEVELOPMENT.md) trước khi đụng vào code.
2. Xin đủ quyền truy cập ở mục 2 — đặc biệt là quyền vào repo `mrt98dev/TheIsleHud` và thông tin liên hệ backend, vì phần lớn tính năng không test được nếu thiếu 2 thứ này.
3. Chạy thử `npm ci && npm run dev` trên máy Windows thật, xác nhận overlay hiện được với game (hoặc ít nhất renderer chạy được nếu chưa có game để test).
4. Đăng nhập thử bằng tài khoản Steam thật để xác nhận luồng deep-link auth còn hoạt động với backend hiện tại.
5. Rà lại `release-notes/` để hiểu lịch sử thay đổi gần nhất trước khi lên kế hoạch release tiếp theo.
6. Nếu dự định merge tiếp từ upstream (`reversum/isle-overlay`), làm theo [DEVELOPMENT.md §7](DEVELOPMENT.md#7-sync-code-từ-upstream) và review kỹ conflict liên quan branding/backend.

---

Xem thêm: [FEATURES.md](FEATURES.md), [DEVELOPMENT.md](DEVELOPMENT.md).
