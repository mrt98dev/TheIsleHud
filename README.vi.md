# TheIsleHud

**[English](README.md)** | **Tiếng Việt**

HUD trong game có thể tùy chỉnh cho Windows, dành cho **The Isle**, dựa trên
[reversum/isle-overlay](https://github.com/reversum/isle-overlay).

HUD ưu tiên tiếng Việt với lớp phủ (overlay) hiển thị liên tục trong game,
các widget có thể di chuyển, minimap, dữ liệu người chơi trực tiếp, và la bàn
định vị/bạn bè mượt mà. Nhấn `F8` để mở hoặc đóng bảng điều khiển; HUD vẫn
hiển thị trong khi bạn chơi.

> [!IMPORTANT]
> Dự án này là bản phái sinh xây dựng trên
> [TheIsleAE3Mien/TheIsleCustomHud](https://github.com/TheIsleAE3Mien/TheIsleCustomHud),
> vốn được tùy biến từ [reversum/isle-overlay](https://github.com/reversum/isle-overlay).
> Cả hai kho lưu trữ upstream đều không công bố giấy phép tại thời điểm mã
> nguồn được nhập vào, nên dự án này không tuyên bố cấp lại giấy phép cho mã
> nguồn đó, và kho lưu trữ này cũng không giữ đầy đủ lịch sử Git gốc. Xem
> [Giấy phép và ghi nhận công lao](#giấy-phép-và-ghi-nhận-công-lao) và
> [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Xem trước HUD

### Bố cục HUD đầy đủ trong game

Minimap, danh sách kiểm tra Prime, la bàn, chỉ số dạng vòng tròn, và các widget
HUD khác luôn hiển thị trong khi chơi. Mở bảng điều khiển bằng `F8` để kéo từng
widget hoặc tự do thay đổi kích thước/tỷ lệ.

![Bố cục HUD đầy đủ trong game của TheIsleHud](docs/images/hud-prime-and-stats.png)

### Chỉ số dạng vòng tròn cho máu, đói, khát, thể lực và tăng trưởng

![HUD chỉ số dạng vòng tròn của TheIsleHud](docs/images/hud-circular-stats.png)

### La bàn mượt với địa điểm, khoảng cách và bạn bè

La bàn hiển thị các địa điểm có tên gần đó kèm khoảng cách, đồng thời luôn giữ
tên bạn bè hiển thị với ký hiệu `BẠN` và khoảng cách hiện tại của họ.

![La bàn của TheIsleHud hiển thị địa điểm, khoảng cách và một người bạn](docs/images/hud-compass.png)

## Tính năng

### Lớp phủ trong game

- Lớp phủ Electron trong suốt, cho phép click xuyên qua, bám theo cửa sổ game
  The Isle, luôn hiển thị phía trên chế độ toàn màn hình/không viền, và tự ẩn
  khi game không hoạt động.
- Đăng nhập Steam qua deep link; bearer token được giữ trong tiến trình chính
  (main process) của Electron thay vì lộ ra ở renderer React.
- `F8` chỉ mở hoặc đóng bảng điều khiển; các widget HUD đã bật vẫn hiển thị
  trong game.
- Widget cho chỉ số, tiến trình Prime, tim/máu, la bàn và radar có thể kéo và
  thay đổi kích thước tự do. Tay cầm resize chỉ hiện khi bảng điều khiển đang mở.
- Tiếng Việt là ngôn ngữ mặc định, kèm bộ chọn ngôn ngữ Anh/Việt cho người chơi.
- Thương hiệu máy chủ và endpoint backend do nhà phát triển kiểm soát, cùng độ
  trong suốt HUD, nền trong suốt, màu nhấn/màu chỉ số, chế độ streamer, và chế
  độ tương thích cho người chơi.
- Widget máy chủ tùy chọn dành cho các bản build có cung cấp GameMonitoring
  server ID. Bản build thông thường (generic) sẽ tắt tích hợp này.

### Bảng điều khiển và HUD người chơi

- Danh tính khủng long, loài, giới tính, máy chủ, trạng thái online và tăng trưởng.
- Chỉ số máu, thể lực, đói, khát và tăng trưởng với bố cục dạng thanh hoặc vòng tròn.
- Theo dõi dinh dưỡng carb, protein và lipid.
- Điều kiện Prime/Prime Elder, các điều kiện đã hoàn thành, và danh sách nhiệm vụ.
- Cập nhật trực tiếp qua WebSocket.

### Radar và bản đồ trực tiếp

- Radar/minimap nổi với hình tròn hoặc vuông, cùng kích thước, phạm vi và nhãn
  có thể tùy chỉnh.
- Bộ lọc Radar/La bàn dùng chung cho khu bảo tồn, vùng di cư, vùng tuần tra,
  các địa điểm khác và bạn bè.
- Vị trí và hướng di chuyển của người chơi theo thời gian thực.
- La bàn ngang mượt mà, đặt ở giữa phía trên màn hình. Hiển thị các địa điểm có
  tên trên bản đồ trong phạm vi 1.500 mét, tránh chồng lấp nhãn, lưu đệm vị trí
  bản đồ, và nội suy góc xoay để giảm giật hình.
- Bạn bè luôn được hiển thị trên la bàn kèm tên và khoảng cách; bạn bè ngoài
  màn hình sẽ được ghim vào cạnh gần nhất của la bàn.
- Bản đồ trực tiếp đầy đủ với địa điểm có tên, bộ lọc theo danh mục, và điểm
  xuất hiện thức ăn.

### Công cụ tùy biến da (skin)

- Trình chỉnh sửa màu da trực tiếp cho các vùng thân, bụng, chi tiết, chi tiết-2,
  mắt, và viền mắt.
- Lưu, tải, cập nhật, xóa, đặt lại, và ngẫu nhiên hóa bộ da đã lưu (preset).
- Xem trước khủng long 3D có hoạt ảnh, hỗ trợ render họa tiết, texture,
  normal-map, khủng long non, và da bị lỗi (glitch).
- Giao diện cửa hàng da cho các skin có sẵn và đã sở hữu.

### Garage và cửa hàng

- Xem các khủng long đang gửi (park) cùng chỉ số sinh tồn, tăng trưởng, trạng
  thái Prime, và bảng màu.
- Gửi, khôi phục/hoán đổi trực tiếp, bán, đổi tên, hoặc giết khủng long khi máy
  chủ cho phép.
- Chọn đột biến (mutation) khi được hỗ trợ.
- Cửa hàng khủng long và skin với số dư, mua hàng, quyền sở hữu, và trang bị do
  backend cung cấp.

### Hỗ trợ và quản trị

- Hộp thư yêu cầu hỗ trợ, chỉ báo chưa đọc/khẩn cấp, và giao diện bàn hỗ trợ.
- Trạng thái online của admin và điều khiển khả dụng của admin.
- Sự kiện media/âm thanh phủ do máy chủ điều khiển.
- Trình chỉnh sửa bản đồ chỉ dành cho admin với danh mục mesh/blueprint, mục
  yêu thích và gần đây, đặt vị trí theo người chơi/góc nhìn/tọa độ XYZ, biến
  đổi, spawn, focus, mang đến (bring), dịch chuyển (teleport), và xóa.

### Phân phối trên desktop

- Trình cài đặt NSIS cho Windows x64.
- Kiểm tra cập nhật trong ứng dụng dựa trên GitHub Releases của kho lưu trữ này.
- Kiểm tra hợp lệ bằng GitHub Actions trên mỗi push và pull request.
- Tự động tạo tài sản GitHub Release cho các tag phiên bản như `v1.0.0`.

## Yêu cầu backend

Đây là client desktop từ hệ sinh thái IslePilot upstream. Theo mặc định, ứng
dụng kết nối tới `https://islepilot.eu` và yêu cầu các endpoint tương thích cho
xác thực Steam, HTTP API, WebSocket, bản đồ, cửa hàng, garage, skin, hỗ trợ, và
quản trị.

Bạn có thể build giao diện (UI) độc lập, nhưng các tính năng phụ thuộc backend
sẽ không hoạt động trên máy chủ khác trừ khi bạn cung cấp dịch vụ tương thích
hoặc tùy chỉnh tích hợp API và xác thực.

## Công nghệ

- Tiến trình chính Electron và tích hợp native Windows (`electron/`).
- React + TypeScript cho renderer, đóng gói bằng Vite (`src/`).
- Xem trước da bằng Three.js / React Three Fiber.
- Danh mục tĩnh cho trình chỉnh sửa bản đồ trong `resources/`.
- Đóng gói trình cài đặt Windows bằng `electron-builder`.

## Phát triển

Yêu cầu: Windows, Node.js 22, và npm.

```powershell
npm ci
npm run dev
npm run typecheck
```

### Cấu hình mặc định khi build

Chỉnh sửa `build.config.json` trước khi đóng gói để tùy chỉnh giá trị mặc định
dùng cho một bản cài đặt mới:

- `serverName` và `overlayLabel` điều khiển tiêu đề cửa sổ và huy hiệu góc dưới
  bên phải.
- `apiBaseUrl` chọn backend tương thích.
- `language` nhận giá trị `en` hoặc `vi`.
- `statsStyle` nhận giá trị `bars` hoặc `circles`.
- `dashKey`, `radarShape`, và `accentColor` thiết lập giá trị khởi tạo của chúng.
- `gameMonitoringServerId` là `null` trong cấu hình thông thường (generic), điều
  này ẩn widget trạng thái máy chủ và ngăn các yêu cầu tới GameMonitoring.
- `defaultUserSettings` chứa bố cục widget mặc định đã được làm sạch, tỷ lệ,
  hiển thị, minimap, độ trong suốt, và các thiết lập hình ảnh dùng cho một bản
  cài đặt mới.

Bố cục mặc định đã commit được sao chép từ cấu hình HUD hiện tại của người bảo
trì (maintainer). Các trường xác thực (`steamId` và `overlayToken`) và vị trí
cửa sổ radar tách rời (đặc thù theo máy) cố tình không bao giờ được lưu vào mã
nguồn.

Thương hiệu máy chủ và các giá trị backend là thiết lập build chỉ dành cho nhà
phát triển và không hiển thị trong ứng dụng đã cài đặt. Người dùng có thể ghi
đè ngôn ngữ, kiểu HUD, phím tắt, radar, và màu sắc từ bảng Cài đặt trong ứng
dụng. Ngôn ngữ của bản build được dùng cho đến khi người dùng chủ động chọn
tiếng Anh hoặc tiếng Việt; lựa chọn đó sau đó sẽ được ghi nhớ.

### Các phiên bản máy chủ (server editions)

`build.config.json` đã commit trên nhánh `main` là bản thông thường (generic)
và cố tình không chứa GameMonitoring server ID nào. Cấu hình đặc thù theo máy
chủ (tên máy chủ, GameMonitoring server ID, kênh cập nhật, bố cục mặc định,
v.v.) có thể được duy trì trên một nhánh phiên bản (edition) riêng bằng cách
thêm file `build.edition.json`, file này sẽ được gộp nông (shallow-merge) đè
lên `build.config.json` khi build/runtime. Nhờ vậy, bất kỳ cộng đồng máy chủ
nào cũng có thể phát hành bản build có thương hiệu riêng mà không cần fork mã
nguồn chung hoặc nhúng giá trị đặc thù máy chủ vào bản phát hành chung.

Khi có cấu hình `gameMonitoringServerId`, client sẽ thăm dò (poll)
GameMonitoring mỗi 30 giây và hiển thị đầy đủ tên máy chủ, trạng thái
online/offline, số người chơi, giới hạn slot, và thời gian của snapshot.
GameMonitoring cung cấp snapshot theo dõi định kỳ chứ không phải luồng thời
gian thực, nên số lượng hiển thị có thể chậm hơn thực tế trong game vài phút.
Widget hiển thị `Dữ liệu X phút trước` dựa trên giá trị `last_update` từ API.

Build trình cài đặt Windows cục bộ:

```powershell
npm run dist -- --publish never
```

Trình cài đặt được ghi ra tại `release/TheIsleHud-<version>-Setup.exe`.

## Phát hành qua GitHub Actions

Mỗi lần push và pull request đều chạy build Windows thông thường (generic) và
tải trình cài đặt lên như một artifact của workflow. Để tạo một GitHub Release
thông thường:

```powershell
npm version patch
git push origin main --follow-tags
```

Tag `v*` được push phải khớp với phiên bản trong `package.json`. Sau đó
workflow sẽ tạo GitHub Release và đính kèm file `.exe`, metadata cập nhật, và
blockmap. Bạn cũng có thể chạy workflow thủ công để tạo một artifact Actions có
thể tải về mà không xuất bản Release.

Một phiên bản (edition) đặc thù theo máy chủ có thể được build từ nhánh riêng
của nó với `build.edition.json` riêng, kênh cập nhật riêng, và một tag như
`v1.0.0-myedition.1`, được xuất bản dưới dạng pre-release với nhãn riêng. Bản
phát hành thông thường được build từ `main` không bao giờ nhận server ID hay
widget của bất kỳ edition nào — `main` luôn giữ ở trạng thái generic, với
`gameMonitoringServerId: null`.

## Đồng bộ với upstream

Remote upstream đã được cấu hình trong bản clone cục bộ:

```powershell
git fetch upstream
git merge upstream/main
```

Hãy xem xét kỹ các xung đột (conflict) để không làm mất thương hiệu tùy chỉnh
và các thay đổi backend.

## Giấy phép và ghi nhận công lao

Dự án gốc: [reversum/isle-overlay](https://github.com/reversum/isle-overlay)
Tác giả/ghi nhận nguồn gốc: **Yannik F / YannikAufDie1 / reversum**
Commit upstream đã nhập: `fe7eb0c7f95258b7d7a13694d08629aaed37a5f4`

Nguồn trực tiếp của bản fork này: [TheIsleAE3Mien/TheIsleCustomHud](https://github.com/TheIsleAE3Mien/TheIsleCustomHud)
— phần tùy biến ưu tiên tiếng Việt, bố cục HUD, và tính năng xây dựng thêm trên
nền dự án upstream gốc.

Tại thời điểm nhập, cả kho lưu trữ upstream gốc lẫn
TheIsleAE3Mien/TheIsleCustomHud đều không công bố giấy phép hay được GitHub
phát hiện giấy phép nào. Do đó, bản quyền vẫn thuộc về các tác giả tương ứng ở
cả hai lớp, và không có giấy phép mã nguồn mở nào được ngụ ý. Thông báo trong
[LICENSE](LICENSE) ghi lại tình trạng này; đây không phải là sự thay thế cho
việc xin phép từ chủ sở hữu bản quyền upstream hoặc lớp trung gian.

Các thay đổi tùy chỉnh và việc bảo trì kho lưu trữ trong bản fork này được ghi
nhận cho [mrt98dev](https://github.com/mrt98dev). Việc ghi nhận công lao
upstream và lớp trung gian phải được giữ lại trong các bản phân phối lại và
phiên bản phái sinh.

## Ghi nhận công lao

- [reversum/isle-overlay](https://github.com/reversum/isle-overlay) — ứng dụng
  gốc, kiến trúc, giao diện, và mã nguồn gốc.
- **Yannik F / YannikAufDie1** — tác giả gốc được nêu tên trong commit upstream
  và metadata của package.
- [TheIsleAE3Mien/TheIsleCustomHud](https://github.com/TheIsleAE3Mien/TheIsleCustomHud)
  — phần tùy biến ưu tiên tiếng Việt và các tính năng HUD mà bản fork này kế
  thừa.
- [mrt98dev](https://github.com/mrt98dev) — tùy chỉnh, bảo trì kho lưu trữ, và
  tự động hóa phát hành.
