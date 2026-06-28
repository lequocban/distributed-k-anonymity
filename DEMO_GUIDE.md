# Hướng Dẫn Demo & Giải Thích Thuật Toán
## Distributed k-Anonymity — Project #102 — Cơ Sở Dữ Liệu Phân Tán

Tài liệu này hướng dẫn cách vận hành demo, thực hiện các kịch bản kiểm thử bảo mật (Hacker Mode), kiểm thử lỗi (Fault Tolerance), đồng thời giải thích chi tiết thuật toán **Distributed k-Anonymity** bảo vệ quyền riêng tư sử dụng cơ chế **Hashed Quasi-Identifier Counting** và **Bearer Token Authentication**.

---

## Phần 1: Hướng Dẫn Chạy Demo & Kiểm Thử

### 1.1. Chuẩn bị môi trường
- **Node.js** phiên bản 18 trở lên.
- **npm** (được cài đặt cùng Node.js).
- Không cần cài đặt cơ sở dữ liệu bên ngoài (hệ thống sử dụng sql.js chạy SQLite trực tiếp thông qua WebAssembly cực kỳ tiện lợi).

### 1.2. Cài đặt các thư viện liên quan
Di chuyển vào thư mục dự án và chạy lệnh cài đặt:
```bash
cd distributed-k-anonymity
npm install
```

### 1.3. Sinh cơ sở dữ liệu mẫu
Hệ thống sử dụng script sinh dữ liệu mẫu để phân chia các tập dữ liệu bệnh nhân thực tế về các node tương ứng:
```bash
npm run generate
```
Script này sẽ tự động sinh ra:
- `node-a/site_a.db` — **1.000 bản ghi** bệnh nhân khu vực TP.HCM (ZipCode bắt đầu bằng `7xxxx`).
- `node-b/site_b.db` — **1.000 bản ghi** bệnh nhân khu vực Hà Nội (ZipCode bắt đầu bằng `1xxxx`).

### 1.4. Khởi động hệ thống
Khởi chạy cùng lúc Coordinator, Node A và Node B bằng lệnh:
```bash
npm start
```
Terminal sẽ hiển thị nhật ký khởi động của cả 3 tiến trình:
- **Coordinator** chạy tại cổng `3000` (Điều phối, chạy thuật toán ẩn danh, hiển thị Dashboard).
- **Node A** chạy tại cổng `3001` (Quản lý dữ liệu site A).
- **Node B** chạy tại cổng `3002` (Quản lý dữ liệu site B).

---

## Phần 2: Kịch Bản Demo & Các Endpoint API

### 2.1. Sử dụng Dashboard Web trực quan
Truy cập địa chỉ sau trên trình duyệt:
```text
http://localhost:3000/
```
Giao diện quản trị viên cho phép bạn cấu hình giá trị $k$, kích hoạt thuật toán, theo dõi tỉ lệ dữ liệu bị xóa bỏ (suppressed), dữ liệu được giữ lại (kept), và thông số mất mát thông tin (Information Loss) một cách trực quan bằng biểu đồ và bảng kết quả phân trang.

### 2.2. Kiểm thử API bằng dòng lệnh (curl)

#### Bước 1 — Kiểm tra kết nối & Trạng thái hệ thống (Health Check)
```bash
curl http://localhost:3000/health
```
**Phản hồi mẫu:**
```json
{
  "coordinator": "online",
  "nodes": {
    "Node A": "online",
    "Node B": "online"
  }
}
```

#### Bước 2 — Chạy thuật toán k-Anonymity (mặc định k = 5)
```bash
curl http://localhost:3000/run
```
Giao thức bảo mật băm Quasi-Identifier sẽ chạy qua các mức độ generalization và trả về dữ liệu y tế đã ẩn danh hóa an toàn:
```json
{
  "k": 5,
  "status": "achieved",
  "protocol": "Privacy-Preserving Hashed QI Group Counting",
  "generalization": {
    "age_level": 3,
    "zip_level": 2,
    "description": "Age suppressed + ZipCode 3-digit prefix"
  },
  "information_loss": {
    "overall_il_percent": "100%",
    "age": {
      "il_cell_percent": "100%",
      "il_contribution": "100%",
      "cells_generalized": 2000,
      "total_cells": 2000
    },
    "zipcode": {
      "il_cell_percent": "40%",
      "il_contribution": "40%",
      "cells_generalized": 2000,
      "total_cells": 2000
    },
    "suppressed": {
      "count": 0,
      "total_records": 2000,
      "il_contribution": "0%",
      "per_node": { "A": 0, "B": 0 }
    }
  },
  "stats": {
    "total_qi_groups": 40,
    "valid_groups": 40,
    "min_group_size": 50
  }
}
```

#### Bước 3 — Chạy k-Anonymity với giá trị k tùy chọn
```bash
curl "http://localhost:3000/run?k=10"
curl "http://localhost:3000/run?k=150"
```

#### Bước 4 — So sánh chỉ số Information Loss ở nhiều cấp độ k
```bash
curl http://localhost:3000/run-levels
```

---

## Phần 3: Kịch Bản Lỗi & Bảo Mật Nâng Cao

### 3.1. Kịch bản lỗi hệ thống phân tán (Fault Tolerance)
Để chứng minh hệ thống có khả năng nhận biết lỗi phân tán và từ chối xử lý để đảm bảo an toàn:
1. **Mô phỏng lỗi:** Tắt tiến trình Node B bằng tổ hợp phím `Ctrl + C` trên terminal tương ứng.
2. **Yêu cầu ẩn danh:** Chạy lệnh gọi thuật toán từ Coordinator:
   ```bash
   curl http://localhost:3000/run
   ```
3. **Kết quả:** Hệ thống ngay lập tức trả về mã lỗi `503 Service Unavailable` và thông báo lỗi:
   ```json
   {
     "error": "k-anonymity cannot be guaranteed — one or more nodes are unreachable",
     "details": "Node B: http://localhost:3002 unreachable: connect ECONNREFUSED 127.0.0.1:3002"
   }
   ```
   *Giải thích lý do:* Nếu một Node bị sập, hệ thống không thể biết dữ liệu ở site đó là gì để tính toán tần suất toàn cục một cách chính xác. Do đó, Coordinator từ chối gộp hay ẩn danh hóa chỉ trên một phần dữ liệu để tránh vi phạm bảo mật hoặc rò rỉ thông tin bán định danh.
4. **Phục hồi:** Chạy lại Node B bằng lệnh `npm run node-b` để khôi phục trạng thái hoạt động bình thường.

### 3.2. Kiểm thử mô phỏng tấn công (Hacker Mode)
Hệ thống tích hợp sẵn kịch bản tấn công để đánh giá tính toàn vẹn của lớp xác thực Bearer Token Auth giữa Coordinator và các Node.
Khi các node đang chạy, chạy lệnh sau ở một cửa sổ dòng lệnh khác:
```bash
npm run hacker-mode
```
Script sẽ mô phỏng 3 cuộc tấn công thực tế từ phía hacker:
1. **Tấn công trực tiếp (Direct Data Theft)**: Hacker bỏ qua Coordinator, gửi request trực tiếp đến Node A nhằm lấy cơ sở dữ liệu bệnh nhân thô không có Authorization Token.
   - *Kết quả chặn thành công:* Hệ thống trả về `401 Unauthorized`.
2. **Tấn công giả mạo token (Fake Token Attempt)**: Hacker gửi request kèm token giả dạng hoặc tự chế (ví dụ: `admin`, `hacker-token-123`).
   - *Kết quả chặn thành công:* Hệ thống trả về `403 Forbidden` (Invalid API token).
3. **Mạo danh Coordinator (Coordinator Impersonation)**: Hacker giả danh Coordinator gửi yêu cầu lấy dữ liệu y tế ẩn danh qua API `POST /anonymized-data` với danh sách loại bỏ (blacklist) trống rỗng để lấy toàn bộ dữ liệu thô.
   - *Kết quả chặn thành công:* Hệ thống chặn thành công với lỗi `403 Forbidden` do token xác thực không hợp lệ.

---

## Phần 4: Giải Thích Thuật Toán & Giao Thức

### 4.1. Bài toán k-Anonymity & Phân cấp Generalization
- **k-Anonymity** đảm bảo mỗi bản ghi thông tin bệnh nhân trong kết quả cuối cùng phải tương đồng (về tuổi, giới tính, mã zip) với ít nhất $k-1$ bệnh nhân khác.
- **Generalization (Tổng quát hóa)** được thực hiện theo phân cấp tăng dần:
  - **Tuổi (Age):** Giá trị gốc $\rightarrow$ khoảng 10 năm (ví dụ `20-29`) $\rightarrow$ khoảng 20 năm (ví dụ `20-39`) $\rightarrow$ ẩn hoàn toàn (`*`).
  - **Mã bưu điện (ZipCode):** Giá trị gốc `70001` $\rightarrow$ ẩn 1 số `7000*` $\rightarrow$ ẩn 2 số `700**` $\rightarrow$ ẩn 3 số `70***` $\rightarrow$ ẩn hoàn toàn `*****`.
- Tổng cộng hệ thống kiểm thử tự động **20 tổ hợp** generalization levels để tìm phương án có mất mát thông tin (Information Loss) thấp nhất thỏa mãn $k$.

### 4.2. Giao thức băm Quasi-Identifier an toàn (Hashed QI Counting Protocol)
Để đảm bảo dữ liệu bệnh nhân thô không bao giờ bị rò rỉ hay truyền đi ở dạng rõ (plain text) trước khi ẩn danh hóa thành công, giao thức phân tán được thiết kế như sau:

```text
  Coordinator                          Node A / Node B
      │                                       │
      │ 1. GET /check-anonymity               │
      ├──────────────────────────────────────>│ (Generalize locally)
      │                                       │ (Compute SHA-256 hash)
      │                                       │ (Count local frequencies)
      │ 2. Return { hash, count }             │
      |<──────────────────────────────────────┤ (Only hashed metadata sent)
      │                                       │
  (Global Aggregation)                        │
  (Identify violating hashes)                 │
      │                                       │
      │ 3. POST /anonymized-data              │
      │    (with blacklistedHashes)           │
      ├──────────────────────────────────────>│ (Filter and suppress locally)
      │                                       │ (Send approved records only)
      │ 4. Return anonymized records          │
      |<──────────────────────────────────────┤
      │                                       │
```

1. **Không truyền thông tin rõ**: Dữ liệu trao đổi ở bước kiểm tra độ an toàn chỉ là các chuỗi băm mật mã SHA-256 đại diện cho các nhóm quasi-identifier kết hợp cùng tần suất đếm được của chúng.
2. **Thực thi bộ lọc tại biên (Edge Suppression)**: Việc ẩn bỏ các bản ghi không đạt chuẩn $k$ được các Node thực hiện trực tiếp tại cơ sở dữ liệu cục bộ của mình. Các bản ghi bị loại bỏ này hoàn toàn **không bao giờ** truyền tải qua mạng lên Coordinator.
3. **Quyền riêng tư tuyệt đối**: Điều này tuân thủ các quy tắc bảo mật cao nhất trong lý thuyết cơ sở dữ liệu phân tán, ngăn chặn rò rỉ dữ liệu y tế nhạy cảm ngay cả khi kênh truyền thông bị nghe lén hoặc bản thân Coordinator bị tấn công chiếm quyền kiểm soát.
