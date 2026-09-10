# Ảnh nền bản đồ to bị mờ khi zoom sâu — settle-boost resize

Ngày: 2026-09-10

## Bối cảnh

`MapCanvas.tsx` (dùng trong `LiveMapTab`, mở bằng phím `M`) render 3 ảnh nền
(`base.webp`, `water.webp`, `land.webp`) và lớp POI/người chơi (SVG) bên
trong một khung `<div>` dùng chung một phép biến đổi
`transform: translate(tx,ty) scale(scale)` để xử lý pan/zoom. Ba ảnh nền
được đặt `width:100%; height:100%` trong khung chứa gốc (~800px vuông,
tuỳ kích thước popup), và `scale` có thể lên tới 25x.

Đã xác nhận qua kiểm tra trực tiếp: ảnh gốc trên server
(`https://islepilot.eu/maps/gateway-v0.21/base.webp`) có kích thước thật
**7800×7817px** (~4.9MB) — không phải ảnh chất lượng thấp.

**Nguyên nhân mờ:** trình duyệt vẽ (rasterize) ảnh `<img>` dựa trên kích
thước layout tại thời điểm layout (~800px), không "nhìn trước" việc một
`transform: scale()` của phần tử cha sẽ phóng to nó về sau. Zoom 25x nghĩa
là kéo dãn một bản đã-vẽ-ở-800px lên tương đương ~20.000px hiển thị — dù dữ
liệu ảnh gốc (7800px) đủ chi tiết, bản đã-rasterize-nhỏ thì không. Đóng/mở
lại bản đồ đôi khi khiến ảnh nét hơn (không nhất quán) vì việc đó buộc
trình duyệt tạo lại render layer cho ảnh.

Đã thử một hướng sửa trước đó (đổi React `key` của `<img>` theo bậc zoom
dạng luỹ thừa 2 để buộc remount) — **gây lỗi mới**: xoá/tạo lại thẻ `<img>`
tạo ra khoảng trống hiển thị nền đen của khung chứa trong lúc phần tử cũ đã
mất còn phần tử mới chưa kịp vẽ. Đã revert (xem comment tại vị trí `key={src}`
trong `MapCanvas.tsx`). Spec này thay thế hướng đó bằng một cơ chế không
đụng đến định danh DOM của `<img>`.

## Mục tiêu

1. Sau khi người dùng dừng zoom (~0.2-0.3s, dùng lại cờ `interacting` sẵn
   có), ảnh nền tự động nét lại theo đúng mức zoom hiện tại — không cần
   đóng/mở lại popup bản đồ.
2. Không gây khoảng đen, giật hình, hay xê dịch vị trí/kích thước hiển thị
   trong quá trình nét lại.
3. Giới hạn mức tăng độ phân giải khi vẽ lại ở một ngưỡng vừa phải
   (~2500–3000px cạnh dài nhất) để tránh tốn quá nhiều bộ nhớ GPU, thay vì
   luôn vẽ đủ 7800px gốc.
4. Không cần tự tách luồng thủ công: phần nặng nhất (resample pixel ảnh)
   vốn đã được Chromium chạy trên raster thread riêng, tách biệt với main
   thread — cơ chế mới chỉ cần thay đổi kích thước layout của `<img>`, phần
   còn lại trình duyệt tự lo.

## Ngoài phạm vi (Non-goals)

- Không áp dụng cho radar nhỏ (`RadarView`/`RadarPanel`/`RadarWindow`) —
  không có tính năng zoom sâu, không bị ảnh hưởng bởi vấn đề này.
- Không làm nét ảnh *trong lúc* đang zoom/kéo (đã quyết định ở bước
  brainstorm: chỉ nét lại sau khi thao tác dừng, ưu tiên mượt trong lúc
  tương tác hơn là nét tuyệt đối liên tục).
- Không viết lại pipeline render bằng `<canvas>`/`OffscreenCanvas`/Worker —
  đó là một hướng lớn hơn, được ghi nhận riêng, không nằm trong phạm vi sửa
  lỗi mờ lần này.
- Không đổi cơ chế `cullBounds` (viewport culling cho POI/nhãn) hay
  `simplified` (ẩn label/icon lúc đang tương tác) đã có sẵn — hai cơ chế đó
  độc lập với thay đổi này.
- Không tải/tạo thêm biến thể ảnh độ phân giải khác trên server — vẫn dùng
  đúng 3 file `base/water/land.webp` hiện có.

## Kiến trúc

### 1. Cấu trúc DOM mới cho lớp ảnh nền

Hiện tại (`MapCanvas.tsx`, trong khung `transform` chung):

```tsx
<div style={{ transform: `translate(${tx}px,${ty}px) scale(${scale})`, ... }}>
  {layers.map((src) => <img key={src} src={src} style={{ width: "100%", height: "100%", ... }} />)}
  <svg>...</svg>
</div>
```

Đổi thành: bọc riêng 3 thẻ `<img>` trong một `<div>` trung gian có kích
thước và transform bù trừ riêng, **không đụng đến `<svg>`/khung transform
pan-zoom chung**:

```tsx
<div style={{ transform: `translate(${tx}px,${ty}px) scale(${scale})`, ... }}>
  <div
    style={{
      position: "absolute",
      inset: 0,
      width: boostPx,
      height: boostPx,
      transform: `scale(${1 / boostFactor})`,
      transformOrigin: "0 0",
    }}
  >
    {layers.map((src) => <img key={src} src={src} style={{ width: "100%", height: "100%", ... }} />)}
  </div>
  <svg>...</svg>
</div>
```

- `boostPx`/`boostFactor` mặc định `containerSize`/`1` (không boost — giữ
  nguyên hành vi hiện tại) khi chưa có lần "settle" nào.
- Vì lớp trung gian tự thu nhỏ lại đúng bằng `1/boostFactor`, hình ảnh hiển
  thị cuối cùng (vị trí, kích thước trong khung transform pan-zoom chung)
  **không đổi** — chỉ có việc trình duyệt phải vẽ ảnh ở kích thước layout
  lớn hơn thật sự.
- Thẻ `<img>` giữ nguyên `key={src}` (không remount) — chỉ box cha thay đổi
  kích thước, đây là một resize layout bình thường, không phải xoá/tạo lại
  phần tử.

### 2. Tính `boostPx`/`boostFactor` khi thao tác dừng

Tái sử dụng đúng pattern đã có của `cullBounds` (tính lại khi `interacting`
chuyển `true` → `false`, đọc kích thước container qua `viewRef`):

```tsx
const MAX_BOOST_PX = 2800; // ngưỡng vừa phải theo quyết định ở bước brainstorm

const [imgBoost, setImgBoost] = useState({ boostPx: 0, boostFactor: 1 });
useEffect(() => {
  if (interacting) return;
  const el = viewRef.current;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return;
  const wanted = rect.width * view.scale;
  const boostPx = Math.min(Math.max(wanted, rect.width), MAX_BOOST_PX);
  setImgBoost({ boostPx, boostFactor: boostPx / rect.width });
}, [interacting, view]);
```

- `wanted = rect.width * view.scale`: kích thước layout "lý tưởng" để khớp
  đúng mức zoom hiện tại.
- `Math.max(wanted, rect.width)`: không bao giờ boost xuống *dưới* kích
  thước gốc (áp dụng khi `scale` về lại 1 hoặc nhỏ hơn — tức không cần
  boost).
- `Math.min(..., MAX_BOOST_PX)`: chặn trần ở ~2800px bất kể zoom sâu đến
  đâu (25x × ~800px ≈ 20.000px sẽ bị chặn lại ở 2800px).
- Render dùng `boostPx || containerSize` làm giá trị an toàn trước khi có
  lần đo đầu tiên (tránh `width: 0`).

### 3. Không đổi gì ở nơi khác

- `cullBounds`, `simplified` (ẩn label/icon lúc tương tác), khung transform
  pan-zoom chung, logic wheel/drag: giữ nguyên 100%, không tương tác chéo
  với thay đổi này.
- `TileWarmer.tsx`: không đổi — vẫn giữ vai trò giữ ảnh nền "nóng" trong bộ
  nhớ đệm giải mã của Chromium trong lúc bản đồ đóng.

## Xử lý lỗi / trường hợp biên

- `viewRef.current` là `null` hoặc `rect.width <= 0` tại thời điểm tính
  (ví dụ đang trong quá trình đóng popup) → bỏ qua, giữ `imgBoost` cũ.
- Người dùng bấm "Reset" (đưa `scale` về 1) → effect chạy lại theo dep
  `view`, boost tự giảm về kích thước gốc (vì `wanted <= rect.width`).
- Đổi `apiBaseUrl` (cài đặt khác) khiến `src` ảnh đổi → không cần reset
  `imgBoost` thủ công, vì đây là thuộc tính của khung chứa (kích thước),
  không gắn với URL ảnh cụ thể; ảnh mới load vào đúng khung đã boost sẵn
  (nếu có) là hành vi chấp nhận được.
- Container resize (người dùng đổi kích thước popup nếu có tính năng đó
  trong tương lai) → đã nằm trong dependency `view`/`interacting`, nhưng
  **không tự kích hoạt lại nếu chỉ container đổi kích thước mà `view` không
  đổi**. Chấp nhận được vì hiện tại kích thước popup bản đồ cố định theo
  `ResizeObserver` ở `LiveMapTab`, không đổi trong lúc mở.

## Kiểm thử (thủ công qua bản build)

1. Mở bản đồ, zoom sâu dần từng bước (cuộn chuột từng nấc), dừng lại ở mỗi
   mức — ảnh tự nét lại sau ~0.2–0.3s mà không cần đóng/mở lại popup.
2. Cuộn chuột dồn dập nhiều nấc rồi dừng đột ngột — không xuất hiện khoảng
   đen, không giật hình trong và sau khi vẽ lại.
3. Zoom vào sâu (gần mức trần 25x) rồi zoom ra về 1x nhiều lần liên tục —
   theo dõi Task Manager phần bộ nhớ GPU của tiến trình renderer, xác nhận
   không tăng dần không kiểm soát (mỗi lần render lại thay thế, không cộng
   dồn).
4. Kéo bản đồ (pan) sau khi đã zoom nét — vị trí/kích thước hiển thị không
   bị lệch do phép bù trừ `1/boostFactor`.
5. Bấm nút "Reset" sau khi đã zoom sâu và nét — bản đồ về lại scale 1 bình
   thường, không còn giữ độ phân giải boost thừa.
6. Đóng rồi mở lại bản đồ ở một mức zoom đã từng nét — xác nhận vẫn nét
   (không bị mất boost do trạng thái `MapCanvas` được giữ nguyên xuyên suốt
   theo thiết kế `display:none` hiện có).
7. `npm run typecheck` sạch lỗi.

## Tài liệu cần cập nhật kèm theo

- Không có tài liệu nào khác mô tả chi tiết cơ chế render bản đồ ngoài spec
  này — không cần cập nhật thêm.

## Ghi nhận cho tương lai (ngoài phạm vi spec này)

Nếu sau này cần bản đồ nét tuyệt đối ở mọi mức zoom (bao gồm cả lúc đang
zoom) và/hoặc cần giảm tải main thread nhiều hơn nữa cho toàn bộ lớp
marker/POI (không chỉ ảnh nền), hướng đúng là viết lại `MapCanvas` bằng
`<canvas>` + `OffscreenCanvas` chạy trong Web Worker thay vì DOM/SVG. Đây
là một dự án riêng, quy mô lớn hơn nhiều so với spec này, đánh đổi mất một
số tiện lợi của SVG (hover trực tiếp, style CSS).
