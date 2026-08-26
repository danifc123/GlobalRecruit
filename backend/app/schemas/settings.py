from pydantic import BaseModel


class ThemeOut(BaseModel):
    primary_color: str | None
    accent_color: str | None
    success_color: str | None
    warning_color: str | None
    danger_color: str | None

    model_config = {"from_attributes": True}


class ThemeUpdate(BaseModel):
    primary_color: str | None = None
    accent_color: str | None = None
    success_color: str | None = None
    warning_color: str | None = None
    danger_color: str | None = None
