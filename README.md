# Distributed k-Anonymity for Medical Research Data Sharing

**Project #102 — Cơ Sở Dữ Liệu Phân Tán**

## Overview

Hệ thống triển khai thuật toán **Distributed k-Anonymity** với `k = 5`, đảm bảo danh tính bệnh nhân không bị lộ khi hai bệnh viện chia sẻ dữ liệu nghiên cứu y tế.

- **Quasi-identifiers (QI):** `Age`, `Gender`, `ZipCode`
- **Sensitive attribute:** `Disease`
- **Kỹ thuật:** Generalization (tổng quát hóa khoảng tuổi)
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
- `node-a/site_a.db` — 300 records (ZipCode 7xxxx)
- `node-b/site_b.db` — 250 records (ZipCode 1xxxx)

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

### 5. Demo failure scenario

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

| Level | Description  | Example       |
|-------|-------------|---------------|
| 0     | Original    | `25`          |
| 1     | 10-year range | `20-29`     |
| 2     | 20-year range | `20-39`     |
| 3     | Suppressed  | `*`           |

## Information Loss Formula

```
IL = (cells generalized / total QI cells) * 100%
```

## Tech Stack

- Node.js (v18+)
- Express.js
- SQLite (`better-sqlite3`)
- Axios
- Concurrently
