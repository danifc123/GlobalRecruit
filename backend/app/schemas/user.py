import uuid

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.db.models.user import Role


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Role
    partner_project_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def partner_requires_project(self) -> "UserCreate":
        if self.role == Role.PARTNER and self.partner_project_id is None:
            raise ValueError("partner_project_id é obrigatório para role=partner")
        if self.role != Role.PARTNER and self.partner_project_id is not None:
            raise ValueError("partner_project_id só se aplica a role=partner")
        return self


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: Role
    partner_project_id: uuid.UUID | None
    is_active: bool

    model_config = {"from_attributes": True}
