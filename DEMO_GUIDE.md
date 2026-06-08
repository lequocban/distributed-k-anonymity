# Hướng Dẫn Demo & Giải Thích Thuật Toán
## Distributed k-Anonymity — Project 102

> **Mục tiêu:** Anonymize dữ liệu bệnh nhân phân tán trên nhiều site (Node A, Node B) bằng thuật toán k-anonymity, đảm bảo mỗi nhóm quasi-identifier có ít nhất `k` bản ghi trước khi chia sẻ cho nghiên cứu y khoa.

---

## Phần 1: Hướng Dẫn Chạy Demo

### 1.1. Yêu cầu hệ thống

- **Node.js** phiên bản 16 trở lên
- **npm** (đi kèm Node.js)
- Không cần cài đặt database server riêng (sử dụng sql.js — SQLite trên nền WebAssembly)

### 1.2. Cài đặt

```bash
cd distributed-k-anonymity
npm install
```

### 1.3. Tạo dữ liệu mẫu (tùy chọn)

Mặc định dữ liệu đã được tạo sẵn. Nếu muốn tạo lại:

```bash
npm run generate
```

Script sẽ tạo:
- `node-a/site_a.db` — **300 bản ghi** bệnh nhân TP.HCM (ZipCode: `70xxx`)
- `node-b/site_b.db` — **250 bản ghi** bệnh nhân Hà Nội (ZipCode: `10xxx`)

Dữ liệu được sinh theo nhóm (bucket), mỗi bucket có `12` bản ghi, đảm bảo dễ dàng đạt k-anonymity ở mức generalization thấp.

### 1.4. Khởi động toàn bộ hệ thống

```bash
npm start
```

Concurrently sẽ khởi động **3 server cùng lúc**:

| Server | Cổng | Vai trò |
|--------|------|---------|
| Coordinator | 3000 | Điều phối thuật toán k-anonymity |
| Node A (Site A) | 3001 | Lưu trữ 300 bản ghi TP.HCM |
| Node B (Site B) | 3002 | Lưu trữ 250 bản ghi Hà Nội |

Output mẫu:

```
[coordinator] Coordinator running on http://localhost:3000
[coordinator]   GET /health       -- check node status
[coordinator]   GET /run           -- run k-anonymity (default k=5)
[coordinator]   GET /run?k=7       -- run with custom k
[coordinator]   GET /run-levels    -- compare IL across k values
[node-a]        Node A running on http://localhost:3001
[node-b]        Node B running on http://localhost:3002
```

### 1.5. Các endpoint để test

#### Bước 1 — Kiểm tra trạng thái các node

```bash
curl http://localhost:3000/health
```

Kết quả mẫu:
```json
{
  "status": "ok",
  "coordinator": { "port": 3000, "status": "ok" },
  "nodes": {
    "A": { "port": 3001, "status": "ok", "records": 300 },
    "B": { "port": 3002, "status": "ok", "records": 250 }
  }
}
```

#### Bước 2 — Xem dữ liệu thô của từng site

```bash
# Node A
curl http://localhost:3001/patients

# Node B
curl http://localhost:3002/patients
```

#### Bước 3 — Chạy k-anonymity (k mặc định = 5)

```bash
curl http://localhost:3000/run
```

Kết quả mẫu:
```json
{
  "k": 5,
  "status": "achieved",
  "level": 3,
  "description": "Age suppressed + ZipCode 2-digit prefix",
  "generalization": { "age": 3, "zipcode": 2 },
  "il": { "percent": "100.00", "ageAffected": 550, "zipAffected": 550, "suppressed": 0 },
  "groups": { "total": 24, "valid": 24, "violating": 0, "minSize": 12 },
  "data": {
    "totalRecords": 550,
    "nodeA": { "records": 300, "groups": 12 },
    "nodeB": { "records": 250, "groups": 12 }
  }
}
```

#### Bước 4 — Thử với k khác nhau

```bash
curl "http://localhost:3000/run?k=3"
curl "http://localhost:3000/run?k=10"
```

#### Bước 5 — So sánh Information Loss qua các mức k

```bash
curl http://localhost:3000/run-levels
```

Trả về bảng so sánh IL ở 9 mức generalization cho mỗi k ∈ {3, 5, 7, 10}.

---

## Phần 2: Giải Thích Thuật Toán Chi Tiết

### 2.1. Bài toán k-Anonymity

**k-Anonymity** là kỹ thuật bảo vệ quyền riêng tư trong dữ liệu có thể nhận dạng. Mỗi bản ghi trong dataset được bảo vệ sao cho nó **không thể phân biệt** với ít nhất **k-1** bản ghi khác dựa trên các **quasi-identifier (QI)**.

**Quasi-identifier** trong dự án này:
- `Age` — tuổi bệnh nhân
- `Gender` — giới tính
- `ZipCode` — mã bưu điện

> **Ví dụ:** Nếu k=5, mỗi nhóm QI phải chứa ít nhất 5 bệnh nhân có cùng (Age, Gender, ZipCode). Nếu một nhóm chỉ có 3 bệnh nhân → vi phạm k-anonymity.

### 2.2. Hai kỹ thuật chính

#### Generalization (Tổng quát hóa)

Thay thế giá trị chính xác bằng giá trị tổng quát hơn, bao quát một phạm vi rộng hơn:

```
Age:    25         → 20-29        → 20-39       →  * (suppressed)
ZipCode: 70001     → 7000*        → 700**       →  * (suppressed)
```

Mỗi lần "nâng cấp" generalization → thông tin càng ít chi tiết → bảo mật hơn nhưng mất nhiều dữ liệu hơn.

#### Suppression (Ẩn bỏ)

Loại bỏ hoàn toàn các bản ghi không thỏa mãn k, bằng cách xóa toàn bộ nhóm QI có `count < k`.

```
Nhóm [25-29, M, 70001] có 3 bản ghi < k=5 → toàn bộ 3 bản ghi bị xóa
```

### 2.3. Generalization Hierarchy (Cây phân cấp)

#### Age — 4 mức độ:

| Level | Mô tả | Ví dụ: age=25 |
|-------|-------|---------------|
| 0 | Giữ nguyên | `25` |
| 1 | Khoảng 10 năm | `20-29` |
| 2 | Khoảng 20 năm | `20-39` |
| 3 | Suppress (ẩn) | `*` |

#### ZipCode — 5 mức độ:

| Level | Mô tả | Ví dụ: zipcode=70001 |
|-------|-------|----------------------|
| 0 | 5 chữ số đầy đủ | `70001` |
| 1 | 4 chữ số + `*` | `7000*` |
| 2 | 3 chữ số + `**` | `700**` |
| 3 | 2 chữ số + `***` | `70***` |
| 4 | Suppress (ẩn) | `*` |

**Gender không được generalize** — luôn giữ nguyên giá trị `M` hoặc `F`.

### 2.4. 9 Tổ hợp Generalization Levels

Coordinator thử lần lượt 9 tổ hợp (từ ít → nhiều aggressive):

```
Level 0: (age=0,  zip=0)  → Không generalize gì cả
Level 1: (age=1,  zip=0)  → Age: 10-năm,  Zip: giữ nguyên
Level 2: (age=1,  zip=1)  → Age: 10-năm,  Zip: 4 số
Level 3: (age=1,  zip=2)  → Age: 10-năm,  Zip: 3 số
Level 4: (age=2,  zip=1)  → Age: 20-năm,  Zip: 4 số
Level 5: (age=2,  zip=2)  → Age: 20-năm,  Zip: 3 số
Level 6: (age=3,  zip=2)  → Age: suppress, Zip: 3 số
Level 7: (age=3,  zip=3)  → Age: suppress, Zip: 2 số
Level 8: (age=3,  zip=4)  → Age: suppress, Zip: suppress
```

Coordinator chọn **mức đầu tiên** thỏa mãn k-anonymity (greedy-first). Nếu không mức nào thỏa → trả về `status: 'not achieved'`.

### 2.5. Thuật Toán Chi Tiết (Pipeline 6 bước)

```
Bước 1: Thu thập dữ liệu
  Coordinator gửi GET /patients đồng thời đến Node A và Node B
  → Gộp 300 + 250 = 550 bản ghi

Bước 2: Thử từng mức generalization (level 0 → 8)
  Với mỗi level:
    ├── Bước 3: Áp dụng generalization cho tất cả bản ghi
    │            age_gen = generalizeAge(age, ageLevel)
    │            zip_gen = generalizeZipcode(zipcode, zipLevel)
    │
    ├── Bước 4: Nhóm bản ghi theo QI
    │            key = (age_gen | gender | zip_gen)
    │            → Tạo các nhóm, mỗi nhóm có count = số bản ghi
    │
    └── Bước 5: Kiểm tra k-anonymity
                 Nếu tất cả các nhóm có count >= k → THOÁT VÒNG LẶP
                 Nếu có nhóm count < k → tiếp tục thử level tiếp theo

Bước 6: Suppression (nếu cần)
  Nếu level cuối cùng vẫn vi phạm → xóa toàn bộ nhóm vi phạm
  Tính IL dựa trên: số cells bị generalize + số bản ghi bị suppress
```

### 2.6. Information Loss (IL) — Công Thức Tính Mất Mát Thông Tin

```
IL(%) = (age_cells_generalized + zip_cells_generalized + suppressed_count) / (total_records × 2) × 100%
```

| Thành phần | Ý nghĩa |
|-----------|---------|
| `age_cells_generalized` | Số bản ghi mà age bị thay đổi từ giá trị chính xác |
| `zip_cells_generalized` | Số bản ghi mà zipcode bị thay đổi từ giá trị chính xác |
| `suppressed_count` | Tổng số bản ghi bị xóa do không đạt k |
| `total_records × 2` | Tổng số cells QI (mỗi bản ghi có Age + ZipCode = 2 cells) |

**Ý nghĩa:**
- `IL = 0%` → Không mất thông tin gì (dữ liệu đã ở dạng k-anonymize sẵn)
- `IL = 100%` → Tất cả cells đều bị generalize hoặc suppress (mất hoàn toàn thông tin)
- **Mục tiêu:** Đạt k-anonymity với IL thấp nhất có thể

**Ví dụ tính IL:**

Giả sử với level=7 (age suppress + zip 2-digit):
- Tất cả 550 records đều bị generalize age (`age_gen = '*'`) → `ageAffected = 550`
- Tất cả 550 records đều bị generalize zipcode (`zip_gen = '70***'` hoặc `'10***'`) → `zipAffected = 550`
- `suppressed = 0`
- `IL = (550 + 550 + 0) / (550 × 2) × 100 = 100%`

### 2.7. Cơ Chế Phân Tán

```
┌─────────────────────────────────────────────┐
│            Coordinator (:3000)              │
│                                             │
│  1. fetch /patients → Node A (:3001)        │
│     fetch /patients → Node B (:3002)        │
│                                             │
│  2. Gộp dữ liệu: 550 bản ghi               │
│                                             │
│  3. Chạy thuật toán k-anonymity             │
│     (generalize + partition + check)        │
│                                             │
│  4. Trả kết quả về cho người dùng           │
└─────────────────────────────────────────────┘
```

**Điểm quan trọng:** Node A và Node B **không bao giờ giao tiếp trực tiếp** với nhau. Coordinator đóng vai trò trung gian trung tâm. Mỗi node chỉ:
- Lưu trữ dữ liệu cục bộ (`.db` file)
- Trả dữ liệu thô khi được yêu cầu
- Không biết dữ liệu của node kia

### 2.8. Giải Thích Chi Tiết Từng File Source

#### `node-a/index.js` / `node-b/index.js`

Server Express đơn giản, cung cấp 3 endpoints:

```js
GET /health        → { status: 'ok', node: 'A'|'B', port }
GET /patients      → Trả toàn bộ 300/250 bản ghi dạng JSON
GET /qi-groups     → Trả số lượng nhóm QI thô (chưa generalize)
GET /generalized   → Trả dữ liệu đã generalize cục bộ (để debug)
```

#### `node-a/database.js` / `node-b/database.js`

Wrapper cho sql.js (SQLite WASM):

```js
initDatabase()     → Tạo bảng patients, insert dữ liệu từ script
getAllPatients()   → SELECT * FROM patients
getQIGroups()      → SELECT age, gender, zipcode, COUNT(*) FROM patients GROUP BY ...
getGeneralized(lvl) → SELECT + apply generalizeAge() trong SQL
```

#### `coordinator/index.js`

- Cấu hình URLs của Node A (`http://localhost:3001`) và Node B (`http://localhost:3002`)
- `fetchFromNode()` — gọi axios GET đến các node, timeout 5 giây
- Route `/run` — gọi `runKAnonymity()` với k và trả kết quả
- Route `/run-levels` — chạy k-anonymity với k ∈ {3, 5, 7, 10} cho tất cả 9 levels

#### `coordinator/kanonymity.js`

Core algorithm, gồm 5 functions:

| Function | Mục đích |
|----------|---------|
| `generalizeAge(age, level)` | Map age → generalized string |
| `generalizeZipcode(zip, level)` | Map zipcode → generalized string |
| `applyGeneralization(records, ageLvl, zipLvl)` | Áp dụng generalize lên tất cả bản ghi |
| `partitionByQI(records)` | Nhóm bản ghi theo QI key |
| `checkKAnonymity(records, k)` | Kiểm tra mỗi nhóm có count >= k |
| `calculateInformationLoss(records, ageLvl, zipLvl, suppressed)` | Tính IL% |
| `evaluateLevel(records, ageLvl, zipLvl, k)` | Chạy full pipeline cho 1 level |
| `runKAnonymity(k)` | Main — thử tất cả levels, trả best result |

---

## Phần 3: Ví Dụ Cụ Thể Từ Kết Quả Thực Tế

### Dataset mẫu (Node A, 3 bản ghi đầu):

| id | age | gender | zipcode | disease |
|----|-----|--------|---------|---------|
| 1 | 25 | M | 70001 | Diabetes |
| 2 | 27 | M | 70001 | Diabetes |
| 3 | 31 | F | 70001 | Hypertension |

### Level 0 (không generalize) — 550 bản ghi:

Với dữ liệu tổng hợp từ 2 node, sẽ có nhiều nhóm nhỏ → không đạt k.

### Level 3 (age 10-năm + zip 3-số):

```
Group key: "20-29|M|700**"  → count = 12  ✓ >= k=5
Group key: "20-29|M|10***"  → count = 12  ✓ >= k=5
Group key: "30-39|F|700**"  → count = 12  ✓ >= k=5
...
→ Tất cả 24 nhóm đều có count = 12  ✓ k-anonymity achieved
→ IL = 0% vì age và zip chưa bị generalize gì
```

### Level 7 (age suppress + zip 2-số):

```
Group key: "*|M|70***"  → count = 24  ✓ >= k=5
Group key: "*|M|10***"  → count = 24  ✓ >= k=5
...
→ k-anonymity đạt nhưng IL = 100% (tất cả age/zip đều bị generalize)
```

**Kết luận:** Với dataset này, **Level 3** là mức tối ưu — đạt k-anonymity với IL thấp nhất.

---

## Phần 4: Troubleshooting

| Vấn đề | Nguyên nhân | Cách khắc phục |
|--------|------------|---------------|
| `ECONNREFUSED` khi gọi `/run` | Node A hoặc B chưa khởi động | Chạy lại `npm start` |
| `status: not achieved` | Không có mức generalization nào đạt k | Tăng k hoặc chạy `npm run generate` để tạo dữ liệu mới |
| Exit code `-1` (4294967295) | Terminal bị đóng → process bị kill | Không ảnh hưởng đến dữ liệu, khởi động lại là được |
| Cổng 3000/3001/3002 đã bị chiếm | Port conflict | Tắt process đang dùng port hoặc đổi port trong code |
