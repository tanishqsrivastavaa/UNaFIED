<div align="center">

# 🚀 UNaFIED

**Real-time chat with an AI that actually listens.**

A high-performance chat platform where an agentic AI silently observes conversations and proactively recommends — movies, books, music — exactly when the moment is right.

![FastAPI](https://img.shields.io/badge/FastAPI-async%20%2B%20WebSockets-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Postgres-pgvector-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Pub%2FSub%20%2B%20Celery-DC382D?logo=redis&logoColor=white)
![PydanticAI](https://img.shields.io/badge/Agent-PydanticAI-E92063)

</div>

---
**A High-Performance Real-Time Chat Application with Proactive Agentic AI**

Unafied is a backend-heavy chat platform that goes beyond standard messaging. It integrates an autonomous **Agentic AI** that acts as a silent observer ("Listener") and a proactive helper ("Recommender"). By utilizing **RAG (Retrieval Augmented Generation)** and **Vector Search**, the system analyzes semantic context in real-time to push relevant content recommendations (movies, books, music) without explicit prompts.

---

## 🎯 Core Objectives

- **Backend Mastery:** Implementation of advanced distributed system patterns including Concurrency, WebSockets, Pub/Sub messaging, and Asynchronous Task Queues.
- **Agentic AI:** Moving from reactive chatbots to autonomous agents using **Pydantic-AI** and **pgvector** for context-aware interactions.
- **Scalability:** A non-blocking I/O architecture built on **FastAPI** and **Redis**, designed to handle concurrent WebSocket connections and background processing.

---

## 🛠 Tech Stack

| Category | Technology |
| :--- | :--- |
| **Language** | Python 3.12+ (managed via `uv`) |
| **Framework** | FastAPI (Async/Await, WebSockets) |
| **Database** | PostgreSQL (NeonDB) with `pgvector` extension |
| **ORM** | SQLModel (SQLAlchemy + Pydantic) |
| **Migrations** | Alembic |
| **Async Tasks** | Celery |
| **Broker/Cache** | Redis (Task Queue & Pub/Sub) |
| **AI Framework** | Pydantic-AI + OpenAI API |
| **Auth** | Stateless JWT (pyjwt) + bcrypt |
| **Infrastructure** | Docker, AWS (EC2/RDS) |

---

The Agentic Workflow

Real-Time Layer: Users communicate via WebSockets. Messages are persisted to Postgres and broadcast via Redis Pub/Sub immediately.

The "Listener" Agent: Every message triggers a background Celery task. This task generates a 1536-dimensional vector embedding of the content and stores it in the MessageEmbedding table.

The "Recommender" Agent: The background worker performs Vector Similarity Search to understand the conversation history. If a specific intent (e.g., boredom, need for focus) is detected, the agent generates a structured recommendation and pushes it back to the client asynchronously.

🗄 Database Schema

The data layer is managed via SQLModel and PostgreSQL.

    User: Identity management.

        id (UUID), email (Unique), hashed_password

    Conversation: Groups messages.

        id (UUID), user_id (FK), title

    Message: Standard chat data.

        id (UUID), conversation_id, role (user/assistant), content

    MessageEmbedding: Vector store for RAG.

        id, message_id (FK - One-to-One), embedding (Vector[1536])

📂 Directory Structure
Plaintext
```
unafied-backend/
├── alembic/                # Database migrations
├── app/
│   ├── api/
│   │   ├── v1/             # Route handlers (auth, chat, users)
│   │   └── websockets.py   # WebSocket connection manager
│   ├── core/
│   │   ├── config.py       # Env vars and settings
│   │   └── security.py     # JWT and Password hashing
│   ├── db/                 # Database session & base models
│   ├── models/             # SQLModel database tables
│   ├── services/           # Business logic
│   │   ├── chat_service.py
│   │   └── recommendation_agent.py # Pydantic-AI logic
│   ├── worker.py           # Celery app configuration
│   └── main.py             # App entry point
├── tests/
├── docker-compose.yml
├── pyproject.toml          # uv dependency management
└── README.md
```
⚡ Getting Started
Prerequisites

    Python 3.12+

    Docker & Docker Compose

    Access to an OpenAI API Key

    Postgres Database (Local or NeonDB)

Local Setup

    Clone the repository:
    Bash

git clone [https://github.com/yourusername/unafied.git](https://github.com/yourusername/unafied.git)
cd unafied

Set up environment variables: Create a .env file:
Code snippet

DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/unafied
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your_secret_key
OPENAI_API_KEY=sk-...

Install dependencies using uv:
Bash

uv sync

Run Infrastructure (Redis/DB):
Bash

docker-compose up -d redis db

Apply Migrations:
Bash

uv run alembic upgrade head

Run the Server & Worker:
Bash

    # Terminal 1: API Server
    uv run uvicorn app.main:app --reload

    # Terminal 2: Celery Worker
    uv run celery -A app.worker worker --loglevel=info

🛡 License

This project is licensed under the MIT License.
