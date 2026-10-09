# AGENTS.md — Karaoke Party

> Instruções permanentes para agentes de desenvolvimento (Codex, Antigravity e similares).
> Este documento orienta o trabalho no repositório; não substitui a inspeção do código existente.

## 1. Objetivo do produto

Karaoke Party é uma plataforma de karaokê voltada a entretenimento, apresentações e interação entre pessoas. A experiência deve transmitir energia de festa, sem comprometer legibilidade, acessibilidade ou estabilidade.

## 2. Fonte de verdade visual

- Consulte **`branding/README-branding.md`** antes de alterar qualquer interface.
- Utilize **arquivos oficiais de logo** fornecidos em `branding/logos/` (quando disponíveis). Não recrie a marca com CSS, texto estilizado ou símbolos aproximados.
- Se houver divergência entre uma imagem de referência e um arquivo vetorial oficial, preserve o arquivo oficial e peça esclarecimento.
- Reaproveite os tokens e componentes do sistema existente. Não crie temas paralelos por página.
- Não presuma que a estrutura de diretórios, ferramentas ou frameworks descritos em exemplos já existam no projeto: verifique antes de modificar.

## 3. Paleta e comportamento visual

| Papel | Cor de referência | Uso |
| --- | --- | --- |
| Roxo principal | `#8A3FFC` | navegação, estados ativos, seleção |
| Laranja ação | `#FF7A00` | Play, cantar, CTA principal |
| Rosa destaque | `#FF4FD8` | interações sociais e efeitos festivos |
| Fundo principal | `#0E0A14` | base dark |
| Texto principal | `#F5F4FA` | textos e ícones de maior contraste |

A paleta deve ser implementada com **tokens semânticos compartilhados**. Defina tokens adicionais para superfícies, bordas, texto secundário e estados (hover/focus/disabled), testando contraste. Não faça substituição cega de hexadecimais: cores podem pertencer a vídeos, artes, identidades de terceiros ou estados funcionais.

Tipografia de referência: **Montserrat Bold/ExtraBold** para títulos/destaques e **Inter Regular/Medium/Semibold** para elementos de interface. Não altere tipografia embutida na mídia de karaokê.

Evite excesso de gradientes, neon, animações ou glow. O laranja deve sinalizar ações prioritárias, sem competir com o vídeo e as letras.

## 4. Interfaces a considerar

Ao alterar UI, identifique as rotas/componentes reais e confira o impacto em todos os modos disponíveis:

- Cabine do DJ, controles e catálogo de músicas.
- Reprodução em TV e segunda tela.
- Experiências de desktop, tablet e celular.
- Fila, placar, desafios, interação social, diálogos e configurações.
- Estados de carregamento, espera, erro e conexão.

A identidade deve ser consistente, **mas o layout não precisa ser idêntico em diferentes dispositivos**.

### Regras especiais da TV

1. Vídeo e letras têm prioridade absoluta.
2. Não mantenha overlays fixos sobre a área crítica de letras; cuidado com variações de resolução e proporção.
3. Mostre informação de música atual uma vez, evitando redundância.
4. Cabeçalho com áreas bem definidas para marca/sala, reprodução atual e controles; sem sobreposição.
5. Fila resumida e compacta, preferencialmente próxima à borda inferior e respeitando áreas seguras. A fila completa não deve invadir o vídeo.
6. Controles administrativos devem ser discretos e adequados à experiência de TV.

## 5. Segurança funcional

Uma alteração visual **não autoriza** mudanças inadvertidas em:

- Reprodução, decodificação ou sincronização de áudio/vídeo.
- Fila de músicas e ordem de apresentação.
- Tom, volume, Play/Pause e atalhos.
- Identificação de festas, salas, usuários e QR Codes.
- Comunicação em tempo real, APIs, persistência e autenticação.
- Regras e estados das interações da festa.

Evite dependências e reestruturações sem necessidade. Prefira alterações pequenas, revisáveis e compatíveis com a arquitetura atual.

## 6. Fluxo obrigatório de trabalho

1. **Inspecionar:** identifique arquivos reais, rotas, componentes, estilos e implementações duplicadas.
2. **Planejar:** informe escopo, arquivos afetados, riscos e testes propostos.
3. **Pedir aprovação:** para migrações amplas, mudanças estruturais, dependências, publicação/deploy ou alterações de lógica. Não execute essas ações sem autorização explícita.
4. **Preservar trabalho existente:** verifique `git status`, não descarte mudanças do usuário e estabeleça um ponto de recuperação apropriado.
5. **Implementar:** prefira tokens globais e componentes reutilizáveis, mantendo diferenças responsivas necessárias.
6. **Validar:** execute os testes disponíveis e inspecione os modos e resoluções afetados; registre o que não foi possível verificar.
7. **Reportar:** liste arquivos alterados, decisões, testes executados, riscos e pendências.

**Não faça deploy, commit automático, publicação ou alteração de sistemas externos sem solicitação ou aprovação explícita.**

## 7. Critérios de conclusão de mudanças visuais

- As logos oficiais são usadas sem deformação ou reconstrução artificial.
- Os tokens semânticos são consistentes entre interfaces afetadas.
- Contraste, foco visível, áreas de toque e textos são adequados.
- Não há cortes, scroll horizontal acidental ou sobreposição em tamanhos relevantes.
- A reprodução de karaokê permanece prioritária e funcional.
- Nenhuma tela afetada permaneceu com estilos legados por esquecimento; exceções devem ser documentadas.
- Testes realizados e limitações de validação foram comunicados.

## 8. Referências e manutenção

- Manual da marca: `branding/README-branding.md`.
- Logos: `branding/logos/` (a adicionar pelo responsável, mantendo nomes reais de arquivos).
- Guia visual ilustrado: manter em `branding/` quando for incluído no repositório.

Se faltarem os recursos oficiais, **não invente logos**: solicite os arquivos necessários.
