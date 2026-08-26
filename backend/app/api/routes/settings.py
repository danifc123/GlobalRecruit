from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_roles
from app.db.models.app_settings import APP_SETTINGS_ID, AppSettings
from app.db.models.user import Role
from app.schemas.settings import ThemeOut, ThemeUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


async def _get_or_create(db: AsyncSession) -> AppSettings:
    settings = await db.get(AppSettings, APP_SETTINGS_ID)
    if settings is None:
        settings = AppSettings(id=APP_SETTINGS_ID)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.get("/theme", response_model=ThemeOut, dependencies=[Depends(get_current_user)])
async def get_theme(db: AsyncSession = Depends(get_db)) -> AppSettings:
    return await _get_or_create(db)


@router.patch("/theme", response_model=ThemeOut, dependencies=[Depends(require_roles(Role.ADMIN))])
async def update_theme(payload: ThemeUpdate, db: AsyncSession = Depends(get_db)) -> AppSettings:
    settings = await _get_or_create(db)
    for field, value in payload.model_dump().items():
        setattr(settings, field, value)
    await db.commit()
    await db.refresh(settings)
    return settings
