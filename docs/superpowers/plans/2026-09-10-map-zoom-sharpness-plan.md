# Implementation plan: Ảnh nền bản đồ to bị mờ khi zoom sâu

Spec: [2026-09-10-map-zoom-sharpness-design.md](../specs/2026-09-10-map-zoom-sharpness-design.md)

Chỉ đổi một file (`src/livemap/MapCanvas.tsx`), một bước duy nhất. Kết thúc
bằng `npm run typecheck` sạch, sau đó kiểm thử thủ công theo danh sách ở
cuối spec.

## Bước 1 — Thêm boost layout size cho lớp ảnh nền khi zoom dừng

**File:** `src/livemap/MapCanvas.tsx`

1. Thêm hằng số `MAX_BOOST_PX = 2800` cạnh các hằng số/type khác ở đầu file
   (gần `CullBounds`).

2. Thêm state `imgBoost` ngay cạnh `cullBounds` (cùng khu vực trong
   component `MapCanvas`):

   ```ts
   const [imgBoost, setImgBoost] = useState<{ boostPx: number; boostFactor: number }>({
     boostPx: 0,
     boostFactor: 1,
   });
   ```

3. Thêm effect tính lại `imgBoost` khi thao tác dừng — đặt ngay sau effect
   tính `cullBounds` hiện có (tái dùng đúng pattern: đọc `viewRef` khi
   `!interacting`):

   ```ts
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

4. Sửa JSX render 3 ảnh nền (`layers.map(...)`): bọc thêm một `<div>` trung
   gian giữa khung `transform` pan-zoom hiện có và các thẻ `<img>`. Thẻ
   `<img>` giữ nguyên `key={src}`, style, props — chỉ đổi phần tử cha bọc
   quanh chúng:

   ```tsx
   <div
     style={{
       position: "absolute",
       inset: 0,
       width: imgBoost.boostPx || "100%",
       height: imgBoost.boostPx || "100%",
       transform: imgBoost.boostPx ? `scale(${1 / imgBoost.boostFactor})` : undefined,
       transformOrigin: "0 0",
     }}
   >
     {layers.map((src) => (
       <img key={src} src={src} ... /> {/* giữ nguyên như hiện tại */}
     ))}
   </div>
   ```

   Trước khi có lần đo đầu tiên (`imgBoost.boostPx === 0`), div trung gian
   dùng `width/height: 100%` và không có `transform` — tương đương hệt như
   không có div bọc này (không đổi hành vi hiện tại).

5. Thêm/giữ comment ngắn giải thích lý do (tham chiếu spec) ngay tại vị trí
   `imgBoost`/div bọc mới — không lặp lại toàn bộ giải thích, chỉ 2-3 dòng
   trỏ tới cơ chế: layout size quyết định độ phân giải raster, transform
   không tự khiến trình duyệt vẽ lại nét hơn.

6. Xoá đoạn comment dài hiện đang giải thích lý do revert "raster tier key"
   ở đúng vị trí `key={src}` (đã lỗi thời, được thay bằng cách tiếp cận mới
   trong bước này) — rút gọn còn 1 dòng nếu cần giữ ngữ cảnh, hoặc xoá hẳn
   vì spec đã ghi lại đầy đủ lịch sử.

**Kiểm tra:** `npm run typecheck` sạch. Sau đó build lại app
(`npm run dev` hoặc quy trình build/cài đặt hiện có của người dùng) và chạy
đủ 7 mục kiểm thử thủ công liệt kê trong spec (mục "Kiểm thử").
