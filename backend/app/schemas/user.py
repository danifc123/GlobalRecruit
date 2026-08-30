import uuid

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.db.models.user import Role
from app.schemas.projeto_parceiro import ProjetoParceiroMini


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Role
    project_ids: list[uuid.UUID] = Field(default_factory=list)

    # recrutador pode ser criado sem projeto ainda (ex.: nenhum projeto
    # parceiro cadastrado no sistema no momento) — o admin vincula depois
    # via PATCH /users/{id}/projetos. Só o inverso continua proibido: papel
    # que não é recrutador não pode carregar vínculo de projeto nenhum.
    @model_validator(mode="after")
    def only_recruiter_has_projects(self) -> "UserCreate":
        if self.role != Role.RECRUITER and self.project_ids:
            raise ValueError("project_ids só se aplica a role=recruiter")
        return self


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    nome: str | None
    role: Role
    projetos: list[ProjetoParceiroMini]
    is_active: bool

    model_config = {"from_attributes": True}


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserProjetosUpdate(BaseModel):
    project_ids: list[uuid.UUID]
