# Distributed Database Project Guide

This Markdown file combines the **Student Final Deliverable Checklist** and the **Distributed Database Project Proposal Template** into one clean, AI-readable document.

---

## 1. Student Final Deliverable Checklist

Students must prepare and submit the following final project deliverables:

### 1.1 Project Proposal

Submit a **project proposal** based on the provided proposal template.

The proposal should define:

- Project identity
- Objective and problem statement
- Dataset specification
- System architecture
- Tech stack and implementation plan
- Success metrics and analysis plan
- Project milestones

---

### 1.2 Two-Page Design Document

Submit a **2-page design document** explaining the system design.

The design document should include:

- Overall system architecture
- Number of simulated distributed sites/nodes
- Communication method between nodes
- Data storage method
- Data fragmentation or replication strategy
- Main algorithm/protocol design
- Failure handling strategy
- Important design decisions and justifications

---

### 1.3 Code Repository

Submit the project code through a **GitHub or GitLab repository**.

The repository must include clear `README.md` instructions.

The README should explain:

- Project overview
- Requirements and dependencies
- How to install the project
- How to run each node/site
- How to run the demo scenario
- How to reproduce the failure scenario
- Expected output/results

---

### 1.4 Analysis Report

Submit an **analysis report** justifying the design choices using **Özsu and Valduriez theory**.

The analysis should connect the project implementation with distributed database concepts such as:

- Data fragmentation
- Data allocation
- Data replication
- Distributed transactions
- Concurrency control
- Commit protocols
- Fault tolerance
- Transparency
- Availability
- Consistency
- Performance trade-offs

The report should not only describe what was implemented, but also explain **why the design is appropriate** based on distributed database theory.

---

### 1.5 Proof / Demo Video

Submit a **screen-recording demo video** of around **3-5 minutes**.

The video should show the system handling a specific dataset scenario.

The demo must include:

- Normal execution case
- At least one failure case
- System behavior during failure
- Recovery or fallback behavior, if implemented
- Explanation of the result

Example failure scenario:

> What happens when Node B is killed during execution?

---

## 2. Additional Final Submission Notes

Students should carefully consider the grading categories.

Students **must attend the final exam** and **present their project work**.

All materials must be submitted properly.

The lecturer will provide the official form for project submission.

---

# 3. Distributed Database Project Proposal Template

## Due Date

`[Insert Date - Week 3]`

---

## Project ID & Category

Example format:

```text
#21: Centralized 2PL - Category 3
```

---

## 3.1 Project Identity

### Team Name

`[Catchy Name]`

### Team Members

`[Name 1, Name 2]`

### Project Title

`[A descriptive title for your specific implementation]`

---

## 3.2 Objective & Problem Statement

### The "Why"

Describe the specific distributed database challenge your project is solving.

Example:

```text
We are testing how network latency affects the abort rate of the Wound-Wait protocol.
```

### Core Logic

Briefly explain the primary algorithm or protocol you will implement.

Possible examples:

- Two-Phase Commit (2PC)
- Centralized Two-Phase Locking (Centralized 2PL)
- Distributed Two-Phase Locking
- Timestamp Ordering
- Wound-Wait / Wait-Die deadlock prevention
- Consistent Hashing
- Horizontal Fragmentation
- Replication and failover

---

## 3.3 Dataset Specification

### Source

`[Link to dataset]`

### Size

`[Total rows / Size in MB]`

### Schema

List the key attributes that will be used.

Example:

```text
AccountID, Timestamp, TransactionAmount
```

### Fragmentation Strategy

If applicable, explain how the data will be split across simulated sites.

Possible strategies:

- Horizontal fragmentation
- Vertical fragmentation
- Hybrid fragmentation
- Replication across all sites
- Hash-based partitioning
- Range-based partitioning

Example:

```text
The dataset will be horizontally fragmented by AccountID range:
- Node A stores AccountID 1-1000
- Node B stores AccountID 1001-2000
- Node C stores AccountID 2001-3000
```

---

## 3.4 System Architecture

### Nodes

How many distributed sites will be simulated?

Minimum requirement:

```text
2 nodes
```

Recommended:

```text
3 nodes
```

Example:

```text
The system will simulate 3 sites: Node A, Node B, and Node C.
```

### Communication Layer

Explain how the sites will communicate.

Possible options:

- HTTP/REST
- WebSockets
- gRPC
- Message queue
- Shared memory
- Local inter-process communication

Example:

```text
Nodes will communicate using HTTP/REST APIs.
```

### Storage

Explain where the data is physically stored.

Possible options:

- Local CSV files
- SQLite instances
- JSON files
- Local PostgreSQL databases
- In-memory dictionaries

Example:

```text
Each node will store its own fragmented data in a local SQLite database.
```

---

## 3.5 Tech Stack & Implementation Plan

### Programming Language

`[e.g., Python, Go, Java, Node.js]`

### Deployment

Possible options:

- Localhost processes
- Docker containers
- Kubernetes

Example:

```text
Each site will run as a separate localhost process.
```

### Libraries / Frameworks

Examples:

- Flask / FastAPI for networking
- Pandas for data handling
- SQLite for local storage
- Requests / HTTPX for inter-node communication
- Docker Compose for multi-node deployment

---

## 3.6 Success Metrics & Analysis

### Quantitative Metric

Define what will be measured.

Possible metrics:

- Total execution time in milliseconds
- Transaction success rate
- Transaction abort rate
- Number of messages exchanged between nodes
- Recovery time after failure
- Throughput in transactions per second
- Latency per request

Example:

```text
We will measure total transaction execution time and the number of aborted transactions.
```

### Failure Scenario

Describe the specific distributed failure that will be simulated.

Examples:

- Kill Node B mid-transaction
- Network delay between nodes
- Coordinator crash during 2PC
- Participant crash before commit
- Lost acknowledgement message
- Site unavailable during query execution

Example:

```text
We will kill Node B during a transaction to test whether the system can detect the failure and recover correctly.
```

---

## 3.7 Project Milestones

### Milestone 1 - Week 5

Environment setup and data fragmentation complete.

Deliverables:

- Project repository initialized
- Dataset selected and cleaned
- Node structure created
- Data split across nodes

### Milestone 2 - Week 8

Core algorithm operational.

Deliverables:

- Main protocol implemented
- Nodes can communicate
- Basic transactions or queries can run
- Logging is available for analysis

### Milestone 3 - Week 12

Failure handling and benchmarking complete.

Deliverables:

- Failure scenario implemented
- Recovery/fallback behavior tested
- Performance metrics collected
- Final report and demo video prepared

---

# 4. AI Reading Instructions

When using this Markdown file with an AI assistant, the AI should understand that the project requires:

1. A proposal following the provided template.
2. A 2-page design document.
3. A working GitHub/GitLab code repository with README instructions.
4. An analysis report based on Özsu and Valduriez distributed database theory.
5. A 3-5 minute screen-recording demo including normal and failure cases.

The AI should help the student produce all deliverables in a way that clearly connects the implementation to distributed database theory and demonstrates a realistic distributed failure scenario.

---

# 5. Suggested Repository Structure

```text
distributed-database-project/
├── README.md
├── proposal.md
├── design_document.md
├── analysis_report.md
├── demo_script.md
├── docker-compose.yml
├── requirements.txt
├── data/
│   ├── raw/
│   └── fragments/
├── node_a/
├── node_b/
├── node_c/
├── coordinator/
└── docs/
```

---

# 6. Suggested Final Submission Checklist

Before submitting, make sure the project includes:

- [ ] Proposal completed
- [ ] 2-page design document completed
- [ ] GitHub/GitLab repository available
- [ ] README contains setup and run instructions
- [ ] Dataset is included or linked
- [ ] Analysis report uses Özsu and Valduriez theory
- [ ] Demo video is 3-5 minutes
- [ ] Demo includes normal case
- [ ] Demo includes failure case
- [ ] Final presentation prepared
- [ ] All files submitted through the official form
