from fastapi import APIRouter, Depends, status
from sqlmodel import Session
from typing import List

from database import get_db
from schemas.skill import SkillCreate, SkillUpdate, SkillResponse
from services import skills as skill_service

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.post("/", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
def create_skill(skill: SkillCreate, db: Session = Depends(get_db)):
    """Create a new agent skill."""
    return skill_service.create_skill(db=db, skill=skill)


@router.get("/", response_model=List[SkillResponse])
def get_skills(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieve all skills."""
    return skill_service.get_skills(db=db, skip=skip, limit=limit)


@router.get("/active", response_model=List[SkillResponse])
def get_active_skills(db: Session = Depends(get_db)):
    """Retrieve only active skills to be injected into the agent."""
    return skill_service.get_active_skills(db=db)


@router.get("/{skill_id}", response_model=SkillResponse)
def get_skill(skill_id: str, db: Session = Depends(get_db)):
    """Get a specific skill by ID."""
    return skill_service.get_skill(db=db, skill_id=skill_id)


@router.put("/{skill_id}", response_model=SkillResponse)
def update_skill(skill_id: str, skill: SkillUpdate, db: Session = Depends(get_db)):
    """Update a specific skill."""
    return skill_service.update_skill(db=db, skill_id=skill_id, skill_update=skill)


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(skill_id: str, db: Session = Depends(get_db)):
    """Delete a specific skill."""
    skill_service.delete_skill(db=db, skill_id=skill_id)
    return None
