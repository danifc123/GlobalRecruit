import uuid

from pydantic import BaseModel, EmailStr, Field

from app.db.models.user import Role
from app.schemas.projeto_parceiro import ProjetoParceiroMini


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class CurrentUserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    nome: str | None
    role: Role
    projetos: list[ProjetoParceiroMini]

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    nome: str | None = None
    email: EmailStr


class PasswordChange(BaseModel):
    senha_atual: str = Field(min_length=8, max_length=72)
    nova_senha: str = Field(min_length=8, max_length=72)
