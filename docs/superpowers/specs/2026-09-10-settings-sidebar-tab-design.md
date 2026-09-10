# Chuyển popup Settings thành tab trong sidebar Menu window

Ngày: 2026-09-10

## Bối cảnh

Trong `MenuWindow.tsx`, `SettingsPanel` hiện là một modal (`.settingsBackdrop`
+ `.settingsFrame`) đè lên toàn bộ menu, mở bằng nút gear ở topbar
(`MenuShell`). Bên trong modal có rail phụ riêng gồm 6 category: Widgets,
Radar, Controls, Streaming, Appearance, Account.

Sidebar chính (`tabSidebar`, thêm ở commit 44be978) hiện chỉ tồn tại trong
nhánh `authed` của `MenuShell`; khi chưa đăng nhập, `MenuShell` render màn
hình "gate" (nút Sign in with Steam) thay cho toàn bộ `mainBody`. Nút gear ở
topbar nằm ngoài nhánh `authed`, nên hiện tại người dùng đổi được ngôn
ngữ/theme/opacity qua Settings **trước khi đăng nhập**.

## Mục tiêu

1. Bỏ popup Settings, biến Settings thành một item cố định trong
   `tabSidebar`, ghim ở cuối, tách biệt về mặt hiển thị với các tab tính
   năng (Dashboard, Skin Editor, Garage, Dino Shop, Skin Shop, Support, Map
   Editor).
2. Giữ hành vi "đổi ngôn ngữ/theme được trước khi đăng nhập": sidebar (chỉ
   hiện item Settings) vẫn hiển thị ở màn hình chưa login.
3. Xoá nút gear ở topbar — Settings chỉ truy cập qua sidebar.
4. Giữ nguyên toàn bộ rail category con (Widgets/Radar/Controls/Streaming/
   Appearance/Account) và mọi logic/state/IPC hiện có bên trong từng
   category — chỉ đổi lớp vỏ hiển thị (modal → nội dung tab thường).

## Ngoài phạm vi (Non-goals)

- Không đổi nội dung/logic của bất kỳ category Settings nào (không thêm/bớt
  option).
- Không đổi các tab tính năng khác (Dashboard, Garage, Skin Editor, Dino
  Shop, Skin Shop, Support/Admin, Map Editor).
- Không đổi cơ chế lưu settings qua IPC (`window.isleOverlay.setSettings`/
  `getSettings`/`onSettingsChanged`).
- Không thêm test tự động — kiểm thử bằng tay qua `npm run dev` như quy ước
  hiện tại của dự án.

## Kiến trúc

### 1. `TabKey` và danh sách tab

- Thêm `"settings"` vào union `TabKey` trong `MenuWindow.tsx`.
- Giữ mảng `TABS` hiện có (7 tab tính năng) không đổi cấu trúc. Settings
  **không** nằm trong mảng này — render như một item riêng, cố định, ở cuối
  `tabSidebar`, có đường phân cách (margin-top tự động đẩy xuống đáy cột
  flex) để phân biệt về mặt hình ảnh với nhóm tab tính năng.
- Icon Settings dùng lại chính icon gear SVG hiện đang nằm trong nút topbar
  (di chuyển vào `TAB_ICONS`/component tương đương).

### 2. `MenuShell` — bỏ rẽ nhánh gate/mainBody cứng

Hiện tại:

```tsx
{!authed ? <div className="gate">...</div> : <div className="mainBody">...</div>}
```

Đổi thành: `mainBody` (sidebar + content) luôn render.

- **Sidebar**: `TABS.filter(...)` như cũ (rỗng/ẩn hết khi `!authed` vì mọi
  tab tính năng đều yêu cầu `authed` ở tab content, giữ nguyên filter theo
  `mapEditAdmin`/`adminModeOn`) + item Settings luôn hiện, không phụ thuộc
  `authed`.
- **Content**:
  - `tab === "settings"` → render `SettingsTab` (xem mục 3), bất kể
    `authed`.
  - `tab !== "settings" && !authed` → render lại đúng nội dung "gate" hiện
    tại (icon, tiêu đề "Sign in to ...", nút Steam) nhưng bên trong
    `tabContent` (không còn là toàn màn hình `mainBody`), để layout sidebar +
    content nhất quán ở mọi trạng thái auth.
  - `tab !== "settings" && authed` → giữ nguyên switch hiện tại giữa các
    tab tính năng.
- `useEffect` reset tab (`mapedit`/`admin` → `profile` khi mất quyền) giữ
  nguyên, không áp dụng cho `settings` (Settings luôn được phép mở).
- Breadcrumb topbar (`brandCtx`, hiện tra `TABS.find(...)`) cần fallback
  hiển thị nhãn "Settings" khi `tab === "settings"` (vì tab này không nằm
  trong `TABS`).
- Xoá nút gear (`<button className="iconBtn" onClick={onSettings} .../>`)
  và prop `onSettings` khỏi `MenuShell`.

### 3. `SettingsTab` (đổi tên từ `SettingsPanel`)

- Bỏ hoàn toàn lớp vỏ modal: `div.settingsBackdrop` (kèm `onMouseDown`
  đóng-khi-click-ngoài) và `div.frame.settingsFrame` + `div.frameBar` (tiêu
  đề "SETTINGS" + nút `xbtn` ✕). Bỏ prop `onClose` (không còn khái niệm
  đóng — đây là một tab thường trực).
- Giữ nguyên phần thân: `div.settingsLayout` chứa `div.settingsRail`
  (`SETTINGS_CATS` map ra `settingsRailBtn`) và `div.settingsContent`
  (nội dung theo `cat`, y nguyên JSX của 6 category hiện có, không đổi biến
  state/effect nào bên trong).
- Props giữ nguyên: `settings, theme, panels, opacity, authed, gameDetected,
  onTheme, onOpacity, onTogglePanel, onLogout, onQuit` (bỏ `onClose`).
  - Category "Account": nút Logout chỉ hiện khi `authed` (điều kiện có sẵn),
    nút "Quit overlay" luôn hiện — hành vi không đổi, chỉ khác là category
    này giờ truy cập được cả trước khi login (trước đây cũng vậy vì gear mở
    được trước login).

### 4. Truyền props qua `MenuWindow` → `MenuShell` → `SettingsTab`

`MenuWindow` hiện giữ `panels`, `theme`, `opacity`, `overlayState`
(`gameDetected`) và các callback `logout`, `quit`, `setTheme`, `setOpacity`,
`togglePanel` — trước đây truyền trực tiếp cho `SettingsPanel` ở cùng cấp.
Nay cần truyền xuống thêm một tầng, qua `MenuShell`:

- Thêm props cho `MenuShell`: `panels`, `opacity`, `gameDetected`, `onTheme`,
  `onOpacity`, `onTogglePanel`, `onLogout`, `onQuit` (bên cạnh `theme`,
  `settings`, `authed` đã có sẵn).
- Xoá state `settingsOpen` khỏi `MenuWindow` và khối:
  ```tsx
  {settingsOpen ? <SettingsPanel ... onClose={...} /> : null}
  ```
- `useEffect(() => { if (blocked) setSettingsOpen(false); }, [blocked])` —
  xoá theo (không còn `settingsOpen`); khi `blocked` (license khoá), màn
  `menuBlocked` (☹️) đã thay thế toàn bộ `MenuShell` ở cấp `MenuWindow`, nên
  không cần xử lý riêng cho tab Settings.

### 5. CSS (`src/styles.css`)

- Xoá `.settingsBackdrop` và `.settingsFrame` (chỉ dùng cho modal, không còn
  chỗ nào tham chiếu sau khi đổi).
- `.settingsLayout`: bỏ `flex: 1 1 auto; min-height: 0` (không còn nằm
  trong một frame có chiều cao cố định) — để nó chảy tự nhiên trong
  `.tabContent` giống nội dung các tab khác.
- `.settingsContent`: bỏ `overflow-y: auto`, `min-height: 0` và 3 rule
  `::-webkit-scrollbar*` riêng của nó — để việc cuộn do `.tabContent` (đã có
  `overflow-y: auto` + scrollbar riêng) đảm nhiệm, tránh scrollbar lồng
  nhau. Giữ nguyên `padding`, `display:flex; flex-direction:column;
  align-items:flex-start; gap:8px` và rule `.range { width: 100% }`.
- `.settingsRail`: giữ nguyên (nền/viền phân biệt cột danh mục con), bỏ
  thuộc tính không còn cần vì không nằm trong flex-row có chiều cao ép buộc
  — kiểm tra lại khi implement, chỉnh nếu rail bị kéo giãn/lệch khi
  `.settingsContent` dài hơn.
- `.frame`, `.frameBar`, `.xbtn` **không đổi** — các class này dùng chung
  cho `DraggablePanel` trong `App.tsx` (overlay window), không liên quan.

## Xử lý lỗi / trường hợp biên

- License bị khoá (`blocked === true`): không đổi — `MenuWindow` đã render
  `div.menuBlocked` thay cho toàn bộ `MenuShell`, Settings không hiện được
  trong tình huống này, giống hành vi hiện tại của popup.
- Mất quyền `mapEditAdmin`/`adminModeOn` khi đang mở tab đó: giữ nguyên logic
  reset về `profile`; không ảnh hưởng khi đang ở tab `settings`.
- Đăng xuất (`onLogout`) khi đang ở tab `settings`, category `account`: sau
  khi `authed` chuyển `false`, nút Logout tự ẩn theo điều kiện có sẵn (React
  re-render với `authed` mới), không cần thêm xử lý.

## Kiểm thử (thủ công qua `npm run dev`)

1. Chưa đăng nhập: sidebar chỉ hiện item Settings; các tab tính năng khác
   không hiện. Vào Settings đổi được ngôn ngữ (en/vi) và theme — áp dụng
   ngay cả ở màn hình gate (kiểm tra text gate đổi ngôn ngữ theo).
2. Từ tab Settings (chưa login) chuyển sang bất kỳ tab khác → hiện lại đúng
   màn hình "Sign in with Steam" bên trong vùng content (sidebar vẫn hiện
   nguyên).
3. Đăng nhập → sidebar hiện đủ 7 tab tính năng + Settings ở cuối, có phân
   cách rõ trực quan.
4. Trong Settings, chuyển qua đủ 6 category (Widgets, Radar, Controls,
   Streaming, Appearance, Account) → mỗi category vẫn hoạt động đúng như
   trước (toggle panel, đổi radar size/range/shape, cursor key, map key,
   streamer mode, compat mode, theme, opacity, account logout/quit).
5. Xác nhận không còn nút gear ở topbar.
6. Nội dung Settings dài (ví dụ category Controls) → cuộn mượt bằng
   scrollbar của `.tabContent`, rail danh mục con không bị vỡ layout.
7. Đăng xuất khi đang ở category Account → nút Logout biến mất, nút Quit
   overlay vẫn còn.
8. `npm run typecheck` sạch lỗi sau khi đổi props/thành phần.

## Tài liệu cần cập nhật kèm theo

- Không có tài liệu nào khác (README/FEATURES) mô tả chi tiết vị trí nút
  Settings hiện tại — không cần cập nhật thêm ngoài spec này.
