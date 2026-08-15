from fastapi import APIRouter

from app.api.routes import auth, candidatos, dashboard, projetos_parceiros, users, vagas

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(vagas.router)
api_router.include_router(candidatos.router)
api_router.include_router(projetos_parceiros.router)
api_router.include_router(dashboard.router)
api_router.include_router(users.router)
