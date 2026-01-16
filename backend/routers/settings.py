from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas.settings import UserSettings, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

# In-memory settings storage (can be moved to database later)
_user_settings = UserSettings()


@router.get("/", response_model=UserSettings)
async def get_settings():
    """Get user settings"""
    return _user_settings


@router.post("/", response_model=UserSettings)
async def update_settings(settings: SettingsUpdate):
    """Update user settings"""
    global _user_settings
    _user_settings = UserSettings(**settings.model_dump())
    return _user_settings


@router.post("/reset", response_model=UserSettings)
async def reset_settings():
    """Reset settings to defaults"""
    global _user_settings
    _user_settings = UserSettings()
    return _user_settings
