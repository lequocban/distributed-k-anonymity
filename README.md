# Distributed k-Anonymity for Medical Research Data Sharing

**Project #102 — Cơ Sở Dữ Liệu Phân Tán**

## Overview

Hệ thống triển khai thuật toán **Distributed k-Anonymity** với `k = 5`, đảm bảo danh tính bệnh nhân không bị lộ khi hai bệnh viện chia sẻ dữ liệu nghiên cứu y tế.

- **Quasi-identifiers (QI):** `Age`, `Gender`, `ZipCode`
- **Sensitive attribute:** `Disease`
- **Kỹ thuật:** Generalization và suppression
- **Metric:** Information Loss (IL)

## Architecture

```
Coordinator (:3000)
    | HTTP REST
    v
Node A (:3001) ── SQLite (site_a.db, ZipCode 7xxxx)
Node B (:3002) ── SQLite (site_b.db, ZipCode 1xxxx)
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Generate synthetic dataset (one-time)

```bash
npm run generate
```

This creates:
- `node-a/site_a.db` — 1.000 records (ZipCode 7xxxx)
- `node-b/site_b.db` — 1.000 records (ZipCode 1xxxx)

### 3. Start all servers

```bash
npm start
```

Or run individually:

```bash
npm run node-a    # Terminal 1
npm run node-b    # Terminal 2
npm run coordinator # Terminal 3
```

### 4. Test endpoints

Mở dashboard trong trình duyệt:

```text
http://localhost:3000/
```

Dashboard hỗ trợ:

- Health check coordinator, Node A và Node B.
- Nhập giá trị `k` và chạy thuật toán.
- Hiển thị generalization, Information Loss và thống kê theo node.
- Chuyển giữa bản ghi giữ lại và bản ghi bị suppression.
- Phân trang kết quả với 10, 25, 50 hoặc 100 dòng mỗi trang.
- So sánh kết quả từ endpoint `/run-levels`.

Hoặc gọi trực tiếp các endpoint:

```bash
# Check node status
curl http://localhost:3000/health

# Run k-anonymity (default k=5)
curl http://localhost:3000/run

# Run with custom k
curl "http://localhost:3000/run?k=7"

# Compare IL across k values
curl http://localhost:3000/run-levels
```

`k` phải là số nguyên dương. Ví dụ `k=0`, `k=-1`, hoặc `k=1.5`
sẽ trả về HTTP 400.

### 5. Run regression tests

```bash
npm test
```

### 6. Demo failure scenario

Kill Node B (Ctrl+C in terminal running `node node-b/index.js`), then:

```bash
curl http://localhost:3000/run
# -> 503: "k-anonymity cannot be guaranteed..."
```

Restart Node B:

```bash
npm run node-b
```

## Generalization Levels

Hệ thống đánh giá đầy đủ 20 tổ hợp giữa 4 mức tuổi và 5 mức zipcode.

| Age level | Description | Example |
|-----------|-------------|---------|
| 0 | Original | `25` |
| 1 | 10-year range | `20-29` |
| 2 | 20-year range | `20-39` |
| 3 | Full-domain generalization | `*` |

| Zip level | Description | Example |
|-----------|-------------|---------|
| 0 | Exact 5-digit | `70001` |
| 1 | 4-digit prefix | `7000*` |
| 2 | 3-digit prefix | `700**` |
| 3 | 2-digit prefix | `70***` |
| 4 | Full-domain generalization | `*****` |

Sau generalization, các nhóm QI có kích thước nhỏ hơn `k` bị suppression.
Một mức chỉ hợp lệ khi còn ít nhất một bản ghi và mọi nhóm còn lại đều đạt `k`.

## Information Loss Formula

```text
IL_age = normalized age interval width
IL_zip = zipcode level / 4
IL_sup = suppressed records / total records
Overall IL = (IL_age + IL_zip + IL_sup) / 3 * 100%
```

## Tech Stack

- Node.js (v18+)
- Express.js
- SQLite in-memory engine (`sql.js`)
- Axios
- Concurrently
