# HỆ THỐNG QUẢN LÝ HỒ SƠ ĐO ĐẠC ĐỊA CHÍNH
### Văn phòng Đăng ký Đất đai - Phòng Kỹ thuật Địa chính

Hệ thống chuyên biệt hỗ trợ nhân viên kỹ thuật địa chính tiếp nhận, phân công, theo dõi tiến độ và kiểm soát 3 mốc thời gian cốt lõi:
1. **Ngày nhận hồ sơ**
2. **Ngày đi đo thực địa**
3. **Ngày hẹn trả kết quả**

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Giao diện tối ưu Di động (Mobile-First)**:
   - Thao tác cảm ứng mượt mà, mở trực tiếp trên trình duyệt điện thoại (iOS Safari, Android Chrome).
   - Nút bấm to, rõ ràng, dễ nhập thông tin ngay ngoài hiện trường thực địa.
   - Nút gọi điện thoại trực tiếp cho chủ đất bằng 1 chạm (`tel:`).

2. **Quản lý toàn diện thông tin địa chính**:
   - Mã số hồ sơ (tự động tăng hoặc nhập theo số biên nhận một cửa).
   - Chủ sử dụng đất, số điện thoại, xã/phường, thôn/tổ dân phố.
   - Số tờ bản đồ, số thửa đất, diện tích (m²), loại đất (ONT, ODT, CLN...).
   - Loại hình đo: Trích lục địa chính, phân lô tách thửa, hợp thửa, cấp đổi GCN, cắm mốc ranh giới...
   - Cán bộ kỹ thuật phụ trách đo vẽ.

3. **Kiểm soát tiến độ & Cảnh báo hạn trả**:
   - Tính toán tự động số ngày còn lại đến hạn trả kết quả.
   - Đánh dấu màu trực quan: **Đỏ** (Quá hạn trả), **Vàng** (Hôm nay đến hạn hoặc còn dưới 2 ngày), **Xanh** (Đúng tiến độ).
   - Lọc nhanh 1 chạm: "Hôm nay đi đo", "Trễ hạn trả", "Đang nội nghiệp biên tập bản đồ".

4. **Chuyển trạng thái 1 chạm (Fast Workflow)**:
   - Từ *Chờ đi đo* -> bấm *Đã đi đo thực địa* -> tự động chuyển sang *Đang nội nghiệp* và lưu vết ngày đo thực tế.
   - Từ *Chờ trả* -> bấm *Đã trả cho chủ đất* -> hoàn tất hồ sơ.

5. **Chụp ảnh & Đính kèm biên bản từ điện thoại**:
   - Sử dụng trực tiếp Camera điện thoại chụp ảnh mốc giới, hiện trạng thửa đất, biên bản giáp ranh.
   - Xem và tải ảnh về máy tính để nhân viên nội nghiệp đưa vào MicroStation / AutoCAD làm bản đồ kỹ thuật thửa đất.

6. **Xuất báo cáo Excel & In phiếu theo dõi**:
   - Xuất file `.xlsx` định dạng chuẩn theo mẫu sổ theo dõi công tác đo đạc của Văn phòng Đăng ký Đất đai.
   - In trực tiếp "Phiếu kiểm soát và theo dõi hồ sơ đo đạc" kẹp vào bìa hồ sơ giấy.

7. **Quét mã QR kết nối nhanh**:
   - Bấm nút "Vào từ điện thoại" trên máy tính để hiển thị mã QR.
   - Điện thoại quét mã là truy cập ngay vào hệ thống (cùng mạng Wi-Fi cơ quan).

---

## 🚀 CÁCH KHỞI ĐỘNG VÀ SỬ DỤNG

### Bước 1: Khởi động hệ thống
- Mở thư mục dự án và nhấp đúp chuột vào file **`start.bat`** (hoặc mở Terminal gõ `node server.js`).

### Bước 2: Truy cập từ máy tính
- Mở trình duyệt web và vào địa chỉ:  
  👉 **`http://localhost:3000`**

### Bước 3: Truy cập từ điện thoại di động
1. Đảm bảo điện thoại kết nối **cùng mạng Wi-Fi** với máy tính.
2. Trên màn hình máy tính, bấm nút **"Vào từ điện thoại"**.
3. Dùng Camera điện thoại hoặc Zalo quét mã QR xuất hiện trên màn hình, hệ thống sẽ mở ngay lập tức.
4. *(Mẹo)*: Trên trình duyệt điện thoại, bấm menu và chọn **"Thêm vào Màn hình chính" (Add to Home screen)** để sử dụng như một App độc lập không có thanh địa chỉ.

---

## 💾 CƠ SỞ DỮ LIỆU & SAO LƯU

- Toàn bộ dữ liệu được lưu trữ trong tệp cơ sở dữ liệu SQLite: **`data.db`**.
- Hình ảnh hiện trường và biên bản đo đạc được lưu trữ trong thư mục: **`uploads/`**.
- **Cách sao lưu (Backup)**: Bạn chỉ cần copy file `data.db` và thư mục `uploads/` sang USB hoặc Google Drive định kỳ.
