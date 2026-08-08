import uuid

from pydantic import BaseModel, EmailStr, Field

from app.db.models.user import Role


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
    role: Role
    partner_project_id: uuid.UUID | None

    model_config = {"from_attributes": True}
