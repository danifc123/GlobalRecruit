"""Fakes nomeados para dependências externas nos testes."""

from app.services.traducao.tradutor import FalhaTraducao


class FakeTradutor:
    """Traduz prefixando "PT:"; registra cada chamada; pode simular falha ou desativação."""

    def __init__(self, *, falhar: bool = False, desativado: bool = False) -> None:
        self.chamadas: list[list[str]] = []
        self.falhar = falhar
        self.desativado = desativado

    async def traduzir(self, textos: list[str]) -> list[str] | None:
        if self.desativado:
            return None
        self.chamadas.append(list(textos))
        if self.falhar:
            raise FalhaTraducao("HTTP 456: cota de caracteres esgotada")
        return [f"PT:{texto}" for texto in textos]

    @property
    def textos_enviados(self) -> list[str]:
        return [texto for chamada in self.chamadas for texto in chamada]
