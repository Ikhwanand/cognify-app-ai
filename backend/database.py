from sqlmodel import SQLModel, create_engine, Session
from config import settings


# Create engine
engine = create_engine(
    settings.database_url,
    echo=settings.debug,  # Log SQL queries in debug mode
)


def get_db():
    """Dependency to yield a database session."""
    with Session(engine) as session:
        yield session


def init_db():
    """Initialize the database."""
    SQLModel.metadata.create_all(engine)
