import os
import shutil
import re
from sqlmodel import Session, select
from models.skill import Skill
from schemas.skill import SkillCreate, SkillUpdate
from fastapi import HTTPException


def sync_skills_to_disk(db: Session):
    """Synchronize active skills to the disk so Agno LocalSkills can load them."""
    skills_dir = os.path.join(os.path.dirname(__file__), "..", "..", "agent_skills")
    if os.path.exists(skills_dir):
        shutil.rmtree(skills_dir)
    os.makedirs(skills_dir, exist_ok=True)

    active_skills = get_active_skills(db)
    for sk in active_skills:
        # Generate safe name: lowercase alphanumeric with hyphens only
        safe_name = re.sub(r"[^a-z0-9-]", "-", sk.name.lower())[:64].strip("-")
        if not safe_name:
            safe_name = f"skill-{sk.id}"

        skill_path = os.path.join(skills_dir, safe_name)
        os.makedirs(skill_path, exist_ok=True)

        safe_desc = (sk.description or sk.name).replace("\n", " ")[:1024]

        md_content = f"---\nname: {safe_name}\ndescription: {safe_desc}\n---\n\n{sk.instructions}\n"
        with open(os.path.join(skill_path, "SKILL.md"), "w", encoding="utf-8") as f:
            f.write(md_content)


# Create a new skill
def create_skill(db: Session, skill: SkillCreate) -> Skill:
    db_skill = Skill.model_validate(skill)
    db.add(db_skill)
    db.commit()
    db.refresh(db_skill)
    sync_skills_to_disk(db)
    return db_skill


# Get all skills
def get_skills(db: Session, skip: int = 0, limit: int = 100) -> list[Skill]:
    statement = (
        select(Skill).offset(skip).limit(limit).order_by(Skill.created_at.desc())
    )
    results = db.exec(statement).all()
    return results


# Get an active skills
def get_active_skills(db: Session) -> list[Skill]:
    statement = select(Skill).where(Skill.is_active == True)
    results = db.exec(statement).all()
    return results


# Get a particular skill
def get_skill(db: Session, skill_id: str) -> Skill:
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


# Update skill
def update_skill(db: Session, skill_id: str, skill_update: SkillUpdate) -> Skill:
    db_skill = get_skill(db, skill_id)

    update_data = skill_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_skill, key, value)

    db.add(db_skill)
    db.commit()
    db.refresh(db_skill)
    sync_skills_to_disk(db)
    return db_skill


# Delete a skill
def delete_skill(db: Session, skill_id: str) -> bool:
    db_skill = get_skill(db, skill_id)
    db.delete(db_skill)
    db.commit()
    sync_skills_to_disk(db)
    return True
