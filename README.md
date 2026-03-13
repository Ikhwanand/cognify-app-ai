# 🧠 Cognify AI

A personal knowledge assistant powered by RAG (Retrieval Augmented Generation). Upload your documents and chat with AI that understands your personal knowledge base.

![Cognify AI](https://img.shields.io/badge/Cognify-AI%20Assistant-purple)
![Python](https://img.shields.io/badge/Python-3.11+-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- 📄 **Document Upload** - Upload PDF, DOCX, TXT, and Markdown files
- 💬 **AI Chat** - Ask questions about your uploaded documents
- 🔍 **RAG Search** - Semantic search across your knowledge base
- 🤖 **Agentic Modes** - Data Analyst and Software Engineer modes
- 🔌 **MCP Server Integration** - Local system access via our custom MCP Server
- 🧠 **Agent Skills** - Customizable skillsets synced directly to the isolated `agent_skills` folder
- 🎨 **Dark/Light Mode** - Beautiful UI with theme support
- ⚙️ **Configurable Models** - Switch between Groq and Nvidia NIM models
- 📊 **Chat History** - Persistent conversation history
- 🔧 **Customizable Settings** - Temperature, system prompts, and more
- 🎤 **Live Talk** - Real-time voice chat with AI'
- 👁️ **Live Vision** - Real-time vision chat with AI
- 🗣️ **Voice Cloning** - Clone your voice and use it for AI responses

## 🛠️ Tech Stack

### Backend

- **FastAPI** - Modern Python web framework
- **Agno** - AI agent framework with RAG capabilities and MCP tools
- **PostgreSQL + PgVector** - Vector database for embeddings
- **SQLModel** - SQL database ORM
- **Groq / Nvidia NIM** - LLM providers

### Frontend

- **React 19** - UI library
- **Vite** - Build tool
- **TailwindCSS v4** - Styling
- **Radix UI** - Accessible components
- **Lucide Icons** - Icon library

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL with pgvector extension
- Groq API key and/or Nvidia API key

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/ikhwanand/cognify-app-ai.git
cd cognify-app-ai
```

### 2. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file and configure
cp .env.example .env
# Edit .env with your API keys and database URL

# Run the server
uvicorn main:app --reload
```

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run development server
npm run dev
```

### 4. Setup Database

Make sure PostgreSQL is running with pgvector extension:

```sql
CREATE DATABASE knowledge_app;
\c knowledge_app
CREATE EXTENSION IF NOT EXISTS vector;
```

## ⚙️ Configuration

### Backend Environment Variables (.env)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5433/knowledge_app

# API Keys
GROQ_API_KEY=your_groq_api_key
NVIDIA_API_KEY=your_nvidia_api_key

# Server
HOST=0.0.0.0
PORT=8000

# AI Defaults
DEFAULT_MODEL=llama-3.3-70b-versatile
DEFAULT_TEMPERATURE=0.7
```

### Frontend Environment Variables (.env)

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## 📁 Project Structure

```
cognify-app/
├── agent_skills/        # Dynamic storage for custom AI Agent Skills
├── agent_workspace/     # Safe isolated sandbox for AI generated files and python execution
├── backend/
│   ├── main.py              # FastAPI application entry
│   ├── config.py            # Configuration management
│   ├── database.py          # Database connection
│   ├── mcp_servers/         # Contains our custom `cognify_mcp.py` MCP server
│   ├── models/              # SQLModel database models
│   ├── routers/             # API route handlers
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # Business logic (RAG, Agents, MCP Integration, Skills)
│   └── requirements.txt     # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── ui/          # Shadcn UI components
│   │   │   ├── ChatArea.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── SettingsModal.jsx
│   │   ├── services/        # API service layer
│   │   ├── lib/             # Utilities
│   │   ├── App.jsx          # Main application
│   │   └── index.css        # Global styles
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## 🎯 API Endpoints

### Chat

- `GET /api/chat/sessions` - Get all chat sessions
- `GET /api/chat/sessions/{id}` - Get session with messages
- `POST /api/chat/sessions` - Create new session
- `DELETE /api/chat/sessions/{id}` - Delete session
- `POST /api/chat/message` - Send message and get AI response

### Documents

- `GET /api/documents/` - List all documents
- `POST /api/documents/upload` - Upload document
- `DELETE /api/documents/{id}` - Delete document

### Settings

- `GET /api/settings/` - Get user settings
- `POST /api/settings/` - Update settings
- `POST /api/settings/reset` - Reset to defaults

## 🤖 Supported Models

### Groq

- Llama 3.3 70B (Versatile)
- Llama 3.1 8B (Instant)
- Mixtral 8x7B
- Gemma 2 9B
- Qwen 3 32B

### Nvidia NIM

- Llama 3.1 405B
- Llama 3.1 70B
- Mixtral 8x22B
- Nemotron 4 340B
- Kimi K2 Thinking

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Agno](https://github.com/agno-agi/agno) - AI agent framework
- [Groq](https://groq.com/) - Fast LLM inference
- [Nvidia NIM](https://build.nvidia.com/) - Enterprise AI models
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components

---

Made with ❤️ using Agno + React
