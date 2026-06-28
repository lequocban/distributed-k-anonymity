# Distributed k-Anonymity for Medical Research Data Sharing

**Project #102 — Cơ Sở Dữ Liệu Phân Tán (Distributed Databases)**

Hệ thống chia sẻ dữ liệu nghiên cứu y tế phân tán bảo vệ quyền riêng tư sử dụng thuật toán **Distributed k-Anonymity** cải tiến với cơ chế **Hashed Quasi-Identifier Counting** và bảo mật **Bearer Token Auth**.

---

## 1. Tổng quan hệ thống (System Overview)

Hệ thống mô phỏng kịch bản hai bệnh viện (Node A và Node B) muốn chia sẻ dữ liệu bệnh nhân để nghiên cứu khoa học nhưng phải đảm bảo không làm lộ danh tính của bất kỳ bệnh nhân nào. Hệ thống thực hiện việc này bằng cách đảm bảo nhóm quasi-identifier (thông tin bán định danh) của mỗi bệnh nhân không thể phân biệt được với ít nhất $k-1$ bệnh nhân khác (mặc định $k = 5$).

- **Quasi-identifiers (QI):** `Age`, `Gender`, `ZipCode`
- **Sensitive attribute:** `Disease`
- **Cơ chế Anonymization:** Generalization (Tổng quát hóa) kết hợp với Suppression (Ẩn bỏ bản ghi không đạt yêu cầu).
- **Metric:** Information Loss (IL) - Đánh giá lượng thông tin bị mất mát sau quá trình ẩn danh hóa.

---

## 2. Kiến trúc & Giao thức Bảo mật (Architecture & Security Protocol)

Hệ thống được thiết kế theo kiến trúc phân tán trung tâm điều phối (Coordinator-based Architecture), bổ sung các lớp bảo mật nâng cao:

```text
                  ┌──────────────────────────────┐
                  │      Coordinator (:3000)     │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │ (HTTP REST + Bearer Token Authentication)     │
         ▼                                               ▼
┌──────────────────┐                            ┌──────────────────┐
│  Node A (:3001)  │                            │  Node B (:3002)  │
├──────────────────┤                            ├──────────────────┤
│ SQLite (site_a)  │                            │ SQLite (site_b)  │
└──────────────────┘                            └──────────────────┘
```

### 2.1. Bảo mật Bearer Token Authentication
- Toàn bộ giao tiếp giữa Coordinator và các Node được bảo vệ bởi Bearer Token xác thực trong `.env` (`NODE_API_TOKEN`).
- Mọi truy cập trái phép từ mạng hoặc các nỗ lực đánh cắp dữ liệu trực tiếp không có Token đều bị chặn hoàn toàn với mã lỗi `401 Unauthorized` hoặc `403 Forbidden`.
- Có thể kiểm chứng hệ thống bảo mật bằng cách chạy kịch bản mô phỏng tấn công: `npm run hacker-mode`.

### 2.2. Giao thức Hashed Quasi-Identifier Counting (Bảo vệ quyền riêng tư tuyệt đối)
Trong các giải pháp truyền thống, các Node phải gửi toàn bộ bản ghi bệnh nhân thô lên Coordinator để chạy thuật toán ẩn danh, làm tăng nguy cơ rò rỉ dữ liệu. Giao thức phân tán của chúng tôi giải quyết triệt để vấn đề này:
1. **Local Hashing**: Các Node tự tính toán các mức độ generalization trên dữ liệu của mình cục bộ và mã hóa băm SHA-256 các tổ hợp quasi-identifier dạng băm (`hash(age_gen | gender | zip_gen)`).
2. **Frequency Exchange**: Coordinator gửi yêu cầu thử các mức generalization qua endpoint `/check-anonymity`. Các Node chỉ gửi về danh sách mã băm SHA-256 kèm theo **tần suất xuất hiện (frequency counts)** của mã băm đó. **Không có dữ liệu gốc hay định danh thô nào được gửi đi ở bước này.**
3. **Global Aggregation**: Coordinator tổng hợp tần suất của các mã băm trên toàn hệ thống để tìm mức generalization tối ưu và lập danh sách mã băm bị loại bỏ (blacklist) do có tổng số lượng nhỏ hơn $k$ (vi phạm k-anonymity).
4. **Targeted Retrieval**: Coordinator gửi danh sách băm bị loại bỏ (blacklist) tới các Node thông qua `POST /anonymized-data`. Các Node tự thực hiện lọc bỏ các bản ghi vi phạm cục bộ rồi mới gửi trả lại dữ liệu đã ẩn danh hóa thành công về Coordinator.
5. **Privacy Guarantee**: Các bản ghi bị suppression không bao giờ rời khỏi database của các Node dưới bất kỳ hình thức nào. Coordinator hoàn toàn không tiếp cận được thông tin của các nhóm bị loại bỏ.

---

## 3. Hướng dẫn nhanh (Quick Start)

### 3.1. Cài đặt Dependencies
Cài đặt các gói thư viện Node.js cần thiết:
```bash
npm install
```

### 3.2. Sinh dữ liệu mẫu (One-time Setup)
Sinh cơ sở dữ liệu SQLite mô phỏng cho hai site:
```bash
npm run generate
```
Lệnh này sẽ tạo ra:
- `node-a/site_a.db` — 1.000 bản ghi bệnh nhân TP.HCM (ZipCode dạng `7xxxx`)
- `node-b/site_b.db` — 1.000 bản ghi bệnh nhân Hà Nội (ZipCode dạng `1xxxx`)

### 3.3. Khởi chạy hệ thống
Khởi chạy cùng lúc Coordinator, Node A và Node B bằng lệnh:
```bash
npm start
```

Hoặc chạy độc lập trên từng terminal riêng biệt:
```bash
npm run node-a         # Terminal 1: Node A (:3001)
npm run node-b         # Terminal 2: Node B (:3002)
npm run coordinator    # Terminal 3: Coordinator (:3000)
```

---

## 4. Kiểm thử & Dashboard

### 4.1. Dashboard Web trực quan
Mở trình duyệt truy cập địa chỉ:
```text
http://localhost:3000/
```
Dashboard cung cấp giao diện quản trị hiện đại, cho phép:
- Kiểm tra kết nối và trạng thái hoạt động (Health check) của các Node.
- Thay đổi tham số ẩn danh $k$ và kích hoạt thuật toán trực quan.
- Xem bảng dữ liệu ẩn danh hóa sau khi gộp, phân trang tiện lợi.
- Hiển thị biểu đồ và thống kê chi tiết lượng thông tin mất mát (Information Loss), tỉ lệ bản ghi bị loại bỏ (Suppressed records).

### 4.2. Gọi các Endpoint trực tiếp
```bash
# Kiểm tra trạng thái hoạt động của hệ thống
curl http://localhost:3000/health

# Chạy thuật toán k-anonymity với k mặc định (k=5)
curl http://localhost:3000/run

# Chạy thuật toán k-anonymity với k tùy chỉnh (ví dụ k=7)
curl "http://localhost:3000/run?k=7"

# So sánh chỉ số Information Loss ở nhiều mức k khác nhau
curl http://localhost:3000/run-levels
```

### 4.3. Mô phỏng tấn công bảo mật (Hacker Mode)
Chạy script kiểm chứng bảo mật để kiểm tra tính toàn vẹn của lớp xác thực Bearer Token chống lại các cuộc tấn công đánh cắp dữ liệu, giả mạo token, hoặc mạo danh Coordinator:
```bash
npm run hacker-mode
# hoặc: npm test
```

### 4.4. Kiểm chứng kịch bản lỗi (Fault Tolerance Scenario)
Mô phỏng lỗi hệ thống phân tán khi một Node bị sập:
1. Tắt Node B (nhấn `Ctrl+C` tại terminal chạy Node B).
2. Gọi endpoint chạy thuật toán k-anonymity từ Coordinator:
   ```bash
   curl http://localhost:3000/run
   ```
3. Hệ thống trả về lỗi `503 Service Unavailable` kèm thông báo chi tiết:
   `"k-anonymity cannot be guaranteed — one or more nodes are unreachable"`
   (Đảm bảo tính nhất quán và cam kết an toàn dữ liệu, không thực hiện ẩn danh hóa thiếu site).
4. Khởi động lại Node B (`npm run node-b`) để phục hồi hệ thống về trạng thái bình thường.

---

## 5. Cấu trúc cây phân cấp Generalization Hierarchy

Hệ thống đánh giá tổng cộng 20 tổ hợp giữa 4 mức tuổi (Age) và 5 mức ZipCode để tìm ra phương án tối ưu nhất.

| Age Level | Mô tả mức ẩn danh | Ví dụ: Tuổi gốc `25` |
|:---:|---|---|
| 0 | Giữ nguyên | `25` |
| 1 | Khoảng 10 năm | `20-29` |
| 2 | Khoảng 20 năm | `20-39` |
| 3 | Ẩn hoàn toàn (Suppress) | `*` |

| Zip Level | Mô tả mức ẩn danh | Ví dụ: Zip gốc `70001` |
|:---:|---|---|
| 0 | Giữ nguyên | `70001` |
| 1 | Ẩn 1 chữ số cuối | `7000*` |
| 2 | Ẩn 2 chữ số cuối | `700**` |
| 3 | Ẩn 3 chữ số cuối | `70***` |
| 4 | Ẩn hoàn toàn (Suppress) | `*****` |

---

## 6. Công thức tính mất mát thông tin (Information Loss - IL)

Chỉ số Information Loss tổng thể được tính dựa trên độ rộng của khoảng ẩn danh trên mỗi cell dữ liệu quasi-identifier và tỉ lệ suppression:

$$\text{IL}_{\text{age}} = \frac{\text{Độ rộng khoảng tuổi ẩn danh}}{\text{Miền giá trị tuổi tối đa (39)}}$$
$$\text{IL}_{\text{zip}} = \frac{\text{Cấp độ ẩn danh ZipCode}}{5}$$
$$\text{IL}_{\text{sup}} = \frac{\text{Số lượng bản ghi bị loại bỏ}}{\text{Tổng số lượng bản ghi}}$$
$$\text{Information Loss Overall} = \frac{\text{IL}_{\text{age}} + \text{IL}_{\text{zip}} + \text{IL}_{\text{sup}}}{3} \times 100\%$$

---

## 7. Triển khai với Docker (Docker Deployment)

Hệ thống hỗ trợ đóng gói hoàn chỉnh bằng Docker Compose:

1. **Khởi dựng dữ liệu mẫu trên host**:
   ```bash
   npm run generate
   ```
2. **Build các Docker Images**:
   ```bash
   npm run docker:build
   ```
3. **Chạy các container**:
   ```bash
   npm run docker:up
   ```
   Sau khi khởi động, Coordinator sẽ mở cổng `3000` trên host, Node A mở cổng `3001`, Node B mở cổng `3002`. Dữ liệu SQLite được đồng bộ và lưu trữ lâu dài bằng Docker Named Volumes.
4. **Dừng hệ thống**:
   ```bash
   npm run docker:down
   ```
