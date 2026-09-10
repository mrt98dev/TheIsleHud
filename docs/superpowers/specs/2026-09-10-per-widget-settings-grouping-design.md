# Gom nhóm cấu hình Settings theo từng tiện ích overlay

Ngày: 2026-09-10

## Bối cảnh

`SettingsTab` (`src/MenuWindow.tsx`) hiện chia nội dung theo 6 category
chức năng: Widgets, Radar, Controls, Streaming, Appearance, Account
(`SETTINGS_CATS`, dòng ~455). Cách chia này trộn lẫn theo *loại thao tác*
chứ không theo *tiện ích sở hữu*:

- Category "Widgets" chỉ có công tắc bật/tắt 6 tiện ích (`PANELS`: Server
  info, Compass, Stats, PRIME, HP Heart, Radar) — không có option riêng
  nào của từng tiện ích.
- Category "Radar" chứa cả option của Radar (size/range/shape/labels) lẫn
  option không thuộc Radar: "Stats layout" (Bars/Circles — thuộc Stats),
  "HUD background" transparency (áp dụng toàn cục cho mọi
  `DraggablePanel`), và "Tracked map items" (dùng chung Radar + Compass).
- Category "Appearance" chứa "Stat colors" (4 màu Health/Stamina/
  Hunger/Thirst) — các màu này chỉ ảnh hưởng tới Stats widget
  (`StatsWidget.tsx`, `MiniStat`/`CircularStat`), không phải theme chung.
- PRIME, HP Heart, Compass, Server info không có option riêng nào ngoài
  bật/tắt. Trong đó HP Heart (`src/HeartHud.tsx`) là widget duy nhất có
  màu **cố định cứng trong CSS** (`#e2fbff` v.v., xem `.heartFill` trong
  `src/styles.css`), không ăn theo `OverlayTheme` như PRIME (dùng chung
  `theme.accent` qua biến CSS `--phos`) hay Stats (dùng `theme.stat.*` qua
  prop `color`).
- Vị trí & kích thước mọi widget đã tự do 100% qua kéo-thả/resize trực
  tiếp trên HUD (`DraggablePanel`, `src/App.tsx` dòng ~60, bật bằng "Edit
  HUD layout"), lưu theo từng `id` widget trong `settings.layout`. Đây
  không phải khoảng trống cần lấp thêm bằng slider trong Settings.

## Mục tiêu

1. Đổi rail category của `SettingsTab` từ 6 mục hiện tại thành 10 mục:
   6 mục theo tiện ích (Server info, Compass, Stats, PRIME, HP Heart,
   Radar — mỗi mục có công tắc bật/tắt riêng ở đầu, theo sau là toàn bộ
   option thuộc về tiện ích đó) + 4 mục không-thuộc-widget giữ nguyên
   (Controls, Streaming, Appearance, Account).
2. Di chuyển các option hiện có về đúng nhóm tiện ích sở hữu chúng (xem
   bảng ở mục Kiến trúc) — không đổi hành vi/giá trị mặc định của bất kỳ
   option nào khi di chuyển.
3. Thêm màu riêng cho HP Heart (`theme.heart`), theo đúng pattern màu đã
   có cho Stats (`theme.stat.*`) — vá luôn sự thiếu nhất quán nói ở trên.
4. Không thêm slider vị trí/kích thước trong Settings cho bất kỳ widget
   nào (đã có cơ chế kéo-thả/resize trực tiếp).

## Ngoài phạm vi (Non-goals)

- Không thêm màu riêng cho PRIME — PRIME tiếp tục dùng chung
  `theme.accent` (đổi ở Appearance → Theme sẽ đổi luôn màu PRIME). Đây là
  hành vi hiện tại, không phải bug cần vá.
- Không thêm option cấu hình mới nào khác ngoài màu HP Heart (không thêm
  field hiển thị cho Server info, không thêm hiệu ứng/animation, không
  thêm option cho Compass ngoài việc dời "Tracked map items" tới đây).
- Không đổi `RadarWindow.tsx` (cửa sổ radar tách rời) — nó đọc cùng các
  key settings (`radarSize`, `radarRange`, `radarShape`, `radarLabels`,
  `mapTracking`), không đổi tên/schema nên không cần sửa.
- Không đổi cơ chế lưu settings qua IPC
  (`window.isleOverlay.setSettings`/`getSettings`/`onSettingsChanged`).
- Không thêm test tự động — kiểm thử bằng tay qua `npm run dev`.

## Kiến trúc

### 1. Rail category mới (`SETTINGS_CATS`, `MenuWindow.tsx`)

```ts
const SETTINGS_CATS = [
  { key: "server", label: "Server info" },
  { key: "compass", label: "Compass" },
  { key: "stats", label: "Stats" },
  { key: "prime", label: "PRIME" },
  { key: "heart", label: "HP Heart" },
  { key: "radar", label: "Radar" },
  { key: "controls", label: "Controls" },
  { key: "streaming", label: "Streaming" },
  { key: "appearance", label: "Appearance" },
  { key: "account", label: "Account" },
];
```

Mục "server" chỉ được thêm vào mảng hiển thị khi
`settings?.serverInfoEnabled` (đúng điều kiện ẩn/hiện hiện tại của chip
Server info trong `PANELS`), lọc giống cách `TABS` lọc theo quyền hiện có
trong `MenuShell`. `cat` mặc định đổi từ `"widgets"` thành `"server"` (mục
đầu tiên còn tồn tại), rơi về `"compass"` khi build không bật
`serverInfoEnabled` (dùng `SETTINGS_CATS_VISIBLE[0].key` làm state khởi
tạo qua lazy `useState` initializer thay vì hằng số cứng, để không bao
giờ mở nhầm vào tab bị ẩn).

Xoá hằng `PANELS` module-level (không còn nơi nào lặp qua toàn bộ danh
sách để vẽ hàng chip chung — mỗi tiện ích tự vẽ công tắc bật/tắt riêng
trong category của nó) nhưng giữ nguyên `key`/`label` của từng widget làm
hằng cục bộ nếu cần tái dùng nhãn.

### 2. Component "enable chip" dùng chung cho 5 tiện ích

Radar giữ nguyên nút "Open/close radar" đặc thù đã có (icon + label động).
5 tiện ích còn lại (Server info, Compass, Stats, PRIME, HP Heart) dùng
lại đúng pattern chip ON/OFF hiện có cho `cursorEnabled`/`streamerMode`/
`compatMode`:

```tsx
<div className="featRow">
  <button className={`chip ${panels[key] ? "on" : ""}`} onClick={() => onTogglePanel(key)}>
    {panels[key] ? "ON" : "OFF"}
  </button>
</div>
```

Không cần component tách riêng — 5 dòng JSX gần như giống hệt nhau, tách
hàm sẽ chỉ thêm một lớp gián tiếp không cần thiết cho lượng lặp này.

### 3. Nội dung từng category (di chuyển, không đổi logic bên trong)

| Category (key) | Nội dung | Nguồn gốc |
|---|---|---|
| `server` | secLabel "Server info" + hint mới "Shows server name and player count on the HUD." + enable chip (`panels.server`, ẩn/hiện đã có qua `serverInfoEnabled`) | Mới (trước đây server chỉ là 1 chip trong hàng PANELS) |
| `compass` | secLabel "Compass" + hint mới "Shows a compass pointing to tracked map items." + enable chip (`panels.compass`) + secLabel "Tracked map items" + hint có sẵn "These filters are shared by the radar and compass." + `trackingGrid` (nguyên trạng) | `trackingGrid` + hint di chuyển từ category `radar` cũ |
| `stats` | secLabel "Stats" + hint mới "Shows health, stamina, hunger and thirst." + enable chip (`panels.stats`) + secLabel "Stats layout" + 2 chip Bars/Circles (nguyên trạng) + secLabel "Stat colors" + 4 `ColorRow` Health/Stamina/Hunger/Thirst (nguyên trạng, đổi `onChange` vẫn gọi `setStat`) | "Stats layout" từ `radar` cũ, "Stat colors" từ `appearance` cũ |
| `prime` | secLabel "PRIME" + hint mới "Tracks Prime Elder eligibility progress." + enable chip (`panels.prime`) + hint mới "PRIME uses the overlay's accent color. Change it under Appearance → Theme." | Mới (trước đây PRIME chỉ là 1 chip trong hàng PANELS) |
| `heart` | secLabel "HP Heart" + hint mới "A floating heart that fills based on health." + enable chip (`panels.heart`) + secLabel "Color" + 1 `ColorRow` label "Heart" value `theme.heart` onChange `(v) => onTheme({ ...theme, heart: v })` | Enable mới thêm; màu là tính năng mới (mục 4) |
| `radar` | Giữ nguyên toàn bộ: nút "Open/close radar", Size slider, Range chips, Shape chips, Labels chip — **trừ** "Stats layout" và "HUD background" (dời đi) — **giữ lại** "Tracked map items" (hiển thị lại ở đây, cùng state với `compass`, không nhân đôi state) | Nguyên trạng, đã bớt 2 khối |
| `controls` | Nguyên trạng (Cursor + Map hotkey) | Không đổi |
| `streaming` | Nguyên trạng (OBS mode) | Không đổi |
| `appearance` | Language, Theme accent (`ColorRow` "Accent"), **"HUD background"** (dời vào đây từ `radar` cũ), Opacity, Compatibility mode. **Bỏ** "Stat colors" (dời sang `stats`) | "HUD background" từ `radar` cũ |
| `account` | Nguyên trạng | Không đổi |

`trackingGrid` ở `compass` và `radar` là **cùng một khối JSX lặp lại**
(cùng đọc/ghi `mapTracking` state và `window.isleOverlay.setSettings`),
không tách logic mới — chấp nhận trùng lặp ~30 dòng JSX vì tách thành
component dùng chung cho đúng 2 chỗ, mỗi chỗ gọi 1 lần, không giảm rủi ro
hay tăng rõ ràng đáng kể so với chi phí thêm 1 prop interface.

### 4. Màu HP Heart — theo đúng pattern màu Stats đã có

**`src/preload.d.ts`** — thêm field vào `OverlayTheme`:

```ts
export type OverlayTheme = {
  accent: string;
  stat: { health: string; stamina: string; food: string; water: string };
  heart: string;
};
```

**`electron/main.cjs`** — thêm hỗ trợ build-config default cho `heart`,
đúng pattern đang có cho `accent`/`stat.*`:

- `configuredTheme.heart` (đọc qua `isHex`, fallback `"#e2fbff"`) vào
  `defaultTheme.heart`.
- `normalizeTheme()`: thêm `heart: isHex(src.heart) ? src.heart :
  defaultTheme.heart`.

**`src/MenuWindow.tsx`**:

- `DEFAULT_THEME.heart = "#e2fbff"`, `VN_HUD_THEME.heart = "#e2fbff"`
  (giữ nguyên màu mặc định hiện tại ở cả 2 theme preset — theme preset
  hiện chỉ đổi accent + stat, không đổi heart, tránh đổi giao diện mặc
  định ngoài ý muốn khi thêm field mới).
- `SettingsTab`: thêm `ColorRow` trong category `heart` như bảng trên.

**`src/HeartHud.tsx`** — nhận thêm prop `color`, áp dụng theo đúng pattern
`--c` đã dùng ở `MiniStat`/`CircularStat` (`StatsWidget.tsx`):

```tsx
export function HeartHud({ me, color }: { me: PlayerMe | null; color: string }) {
  // ...
  return (
    <div className="heartHud dragHandle" style={{ ["--heart-color" as string]: color }} title={...}>
```

**`src/styles.css`** — chỉ 2 trong 4 path đổi theo màu cấu hình được (2
path còn lại là nền/viền trang trí phụ, giữ cố định để không phải xử lý
trộn alpha từ 1 giá trị hex):

```css
.heartFill { fill: var(--heart-color, #e2fbff); }
.heartLine { stroke: var(--heart-color, #a9eeff); }
/* .heartBase và .hexOuter giữ nguyên màu cố định — nền/viền trang trí phụ, không phải phần thể hiện màu máu */
```

`.heartFill` là phần khối chính thể hiện lượng máu (mục đích chính của
tính năng), `.heartLine` là viền đi theo để đồng bộ thị giác. `.heartBase`
(nền mờ phía sau) và `.hexOuter` (khung lục giác) giữ nguyên như hiện tại.

**`src/App.tsx`** — truyền `color={theme.heart}` vào `<HeartHud me={view}
color={theme.heart} />` (dòng ~665).

### 5. Chuỗi i18n mới (`src/i18n.ts`, thêm vào `VI`)

| Key (en) | vi |
|---|---|
| `Shows server name and player count on the HUD.` | `Hiển thị tên máy chủ và số người chơi trên HUD.` |
| `Shows a compass pointing to tracked map items.` | `Hiển thị la bàn chỉ hướng tới các điểm được theo dõi trên bản đồ.` |
| `Shows health, stamina, hunger and thirst.` | `Hiển thị máu, thể lực, đói và khát.` |
| `Tracks Prime Elder eligibility progress.` | `Theo dõi tiến trình đủ điều kiện Prime Elder.` |
| `PRIME uses the overlay's accent color. Change it under Appearance → Theme.` | `PRIME dùng màu accent chung của overlay. Đổi tại Giao diện → Theme.` |
| `A floating heart that fills based on health.` | `Trái tim nổi, đầy vơi theo lượng máu.` |
| `Color` | `Màu sắc` |
| `Heart` | `Tim` |

Các nhãn category ("Server info", "Compass", "Stats", "Radar", "HP
Heart", "Controls", "Streaming", "Appearance", "Account") và hint dùng
chung ("These filters are shared by the radar and compass.", "HUD
background", ...) đã có sẵn trong `VI` — không cần thêm. "PRIME" không
dịch (giữ nguyên như hiện tại, xem `PrimePanel`).

## Xử lý lỗi / trường hợp biên

- `settings` chưa load xong (`null`) lúc mount: mọi `ColorRow` mới
  (`theme.heart`) đọc từ state `theme` cục bộ của `MenuWindow` (đã có
  `DEFAULT_THEME` làm giá trị khởi tạo trước khi `getSettings()` trả về),
  giống hệt cách `theme.stat.*` đang hoạt động — không có trường hợp biên
  mới phát sinh.
- Widget bị ẩn (`panels[key] === false`) nhưng user vẫn mở đúng category
  của nó trong Settings để đổi màu/style: cho phép, giống hành vi hiện
  tại của category `radar` (đổi radar size dù đang đóng radar).
- `serverInfoEnabled === false`: category `server` không hiện trong rail;
  nếu `cat` state đang lỡ là `"server"` từ trước (không thể xảy ra vì
  initializer đã loại trừ) — không cần xử lý thêm.
- Build config cũ không có `configuredUserDefaults.theme.heart`: fallback
  `"#e2fbff"` qua `isHex` check giống các field theme khác — không crash.

## Kiểm thử (thủ công qua `npm run dev`)

1. Rail Settings hiện đủ 10 mục theo đúng thứ tự, category `server` ẩn
   khi build không có `serverInfoEnabled`.
2. Mỗi trong 6 category tiện ích: nút bật/tắt hoạt động đúng (widget hiện
   ẩn trên overlay ngay lập tức, theo đúng fix panels đồng bộ đã có ở
   `App.tsx`), và với Radar riêng vẫn dùng nút "Open/close radar" như cũ.
3. `compass` và `radar`: đổi 1 filter trong "Tracked map items" ở category
   này → phản ánh ngay khi chuyển sang category kia (cùng state).
4. `stats`: đổi Bars/Circles và đổi 1 trong 4 màu → Stats widget trên
   overlay cập nhật đúng, giống hành vi cũ khi các option này còn ở
   `radar`/`appearance`.
5. `heart`: đổi màu → HP Heart trên overlay đổi màu ngay; tắt/bật lại
   overlay (restart) → màu được giữ nguyên (đã lưu qua `setSettings`).
6. `appearance`: "HUD background" (Transparent/Default) vẫn hoạt động
   đúng như trước dù đã dời khỏi `radar`.
7. `prime`: bật/tắt PRIME; đổi Accent ở `appearance` → màu PRIME
   (checkbox `q-done`, viền frame) đổi theo, xác nhận hint không đổi
   hành vi.
8. Test lại toàn bộ 8 mục kiểm thử của spec sidebar-tab trước đó
   (`2026-09-10-settings-sidebar-tab-design.md`) vẫn pass — thay đổi này
   không đụng lớp vỏ tab/sidebar, chỉ đụng nội dung bên trong
   `SettingsTab`.
9. `npx tsc --noEmit` sạch lỗi.

## Tài liệu cần cập nhật kèm theo

- Không có tài liệu nào khác mô tả cấu trúc category Settings hiện tại
  ngoài spec sidebar-tab (không mô tả nội dung category, chỉ mô tả lớp
  vỏ) — không cần cập nhật thêm.
