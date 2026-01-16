from sqlmodel import SQLModel


class UserSettings(SQLModel):
    # Appearance
    theme: str = "dark"

    # AI Configuration
    model: str = "llama-3.3-70b-versatile"
    temperature: float = 0.7
    max_tokens: int = 2048
    system_prompt: str = "You are a helpful AI assistant that answers questions based on the provided knowledge base."

    # RAG Settings
    top_k: int = 5
    include_sources: bool = True

    # Chat Preferences
    auto_scroll: bool = True
    send_on_enter: bool = True
    show_timestamps: bool = True


class SettingsUpdate(UserSettings):
    pass
