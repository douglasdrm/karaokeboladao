# Karaoke Party — Guia de identidade visual

**Versão:** 1.0 — referência de implementação  
**Conceito:** **A festa começa aqui.**  
**Personalidade:** vibrante, musical, social, moderna, acolhedora e marcante.

Este documento orienta o uso da identidade apresentada no manual visual da marca. A referência gráfica original e os arquivos vetoriais oficiais, quando fornecidos, devem ser tratados como fontes primárias para proporção e desenho das logos.

## 1. Posicionamento

Karaoke Party não é apenas um player: é uma experiência de festa em que pessoas cantam, interagem e compartilham momentos. Sua identidade combina **energia de palco**, **neon controlado**, **interação social** e **clareza de produto digital**.

Mensagem de marca exibida no conceito: **“Cante. Conecte. Viva momentos reais.”**

Direção verbal complementar: **“Mais que karaokê. É conexão.”**

Estas frases são referências de comunicação, não textos obrigatórios em todas as telas.

## 2. Paleta oficial de referência

| Token sugerido | HEX | Papel | Aplicação |
| --- | --- | --- | --- |
| `--brand-purple` | `#8A3FFC` | Roxo principal | Navegação, abas, seleções, estados ativos |
| `--brand-orange` | `#FF7A00` | Laranja ação | Cantar Agora, Play, CTAs e ação de maior prioridade |
| `--brand-pink` | `#FF4FD8` | Rosa destaque | Interações sociais, reações, conquistas, detalhes de festa |
| `--brand-bg` | `#0E0A14` | Fundo principal | Base da aplicação dark |
| `--brand-white` | `#F5F4FA` | Branco texto | Títulos, textos e ícones principais |

**Regra de hierarquia:** fundo escuro predominante; roxo como identidade e orientação; laranja em poucas ações realmente importantes; rosa como acento social e expressivo.

Não é obrigatório usar as três cores de destaque no mesmo componente. Não use neon intenso em todos os cards. As proporções são direcionais, não uma quota rígida.

### Tokens complementares

Os tons de superfícies, bordas, texto secundário, hover, pressed, focus e disabled devem ser definidos no projeto após verificação de contraste e legibilidade. Evite criar valores diferentes para o mesmo papel em cada tela. Não altere conteúdos de vídeo ou letras apenas para impor a paleta da marca.

### Exemplo ilustrativo de CSS (adapte à arquitetura existente)

```css
:root {
  --brand-purple: #8A3FFC;
  --brand-orange: #FF7A00;
  --brand-pink: #FF4FD8;
  --brand-bg: #0E0A14;
  --brand-white: #F5F4FA;
}
```

## 3. Tipografia

**Montserrat (Bold/ExtraBold)**
- Títulos de páginas e seções.
- Mensagens de destaque e material institucional.
- Cabeçalhos com caráter expressivo.

**Inter (Regular/Medium/Semibold)**
- Controles, botões, formulários, listas, filas e informações operacionais.
- Microtextos e elementos que exigem leitura rápida.

Use fontes instaladas ou carregadas legalmente pelo projeto; preserve fallback adequado. Evite fontes pesadas em metadados compactos. A fonte das letras já incorporadas ao vídeo não deve ser modificada.

## 4. Sistema de logos

A identidade contempla:

| Versão | Uso recomendado |
| --- | --- |
| **Horizontal** | Header desktop, cabine do DJ, TV, barras horizontais |
| **Vertical** | Aberturas, apresentações, materiais com espaço vertical |
| **Símbolo “K”** | Favicon, ícone de aplicativo, avatar, áreas reduzidas |
| **Monocromática** (se fornecida) | Aplicações de uma cor e contextos especiais |

O símbolo é um **K expressivo com referência integrada ao microfone**, com transições de roxo, rosa e laranja conforme o arquivo oficial. O logotipo usa “Karaoke” em destaque e “PARTY” como complemento.

### Regras de integridade

- Sempre usar os recursos originais; não tentar reproduzir a geometria do K em CSS ou com fonte comum.
- Não esticar, girar, redesenhar ou cortar o símbolo.
- Não acrescentar sombras/glow que reduzam a legibilidade.
- Manter respiro visual, especialmente em header e ícones pequenos.
- Preferir SVG original em interfaces; PNG transparente em resolução adequada é alternativa.
- Não presumir a existência de um arquivo monocromático ou de outra variação até ela ser fornecida.
- Preferir fundo escuro, mas validar versões adequadas para fundos claros quando os arquivos correspondentes existirem.

**Arquivos oficiais:** as versões originais estão preservadas em `branding/logos/`. Use os arquivos individuais abaixo como fonte de verdade; a arte composta `branding/idvisual.png` é somente referência ilustrada.

| Papel | Arquivo real | Estado |
| --- | --- | --- |
| Horizontal colorida | `branding/logos/logo horizontal.png` | Disponível |
| Vertical colorida | `branding/logos/logo vertical.png` | Disponível |
| Símbolo colorido | `branding/logos/icone.png` | Disponível |
| Horizontal escura | `branding/logos/logo b.png` | Disponível; validar sobre fundo claro |
| Horizontal clara | `branding/logos/logo w.png` | Disponível; validar sobre fundo escuro |

> O guia visual ilustrado mostra as variações, mas a imagem composta **não substitui** arquivos individuais de logo em alta qualidade.

## 5. Interface de produto

### Ações

- **Primárias:** laranja, por exemplo “Cantar Agora”, Play e iniciar ação essencial.
- **Navegação e seleção:** roxo, para aba ativa, foco de navegação e estados selecionados.
- **Sociais:** rosa, para reações, presentes, conquistas e chamadas de interação.
- **Secundárias:** superfícies escuras e contornos discretos.
- **Destrutivas:** não usar laranja automaticamente; prever semântica de risco e confirmação.

### Componentes e estados

- Botões devem ter estilos de hover, focus-visible, pressed, loading e disabled consistentes.
- Cards com cantos arredondados, contraste claro e pouco glow.
- Ícones simples e coerentes; não misturar estilos de ícones arbitrariamente.
- Badges “Ao vivo” podem usar destaque expressivo, sem reduzir legibilidade.
- Estado “online” e outros indicadores funcionais devem usar semântica apropriada, não somente as cores decorativas da marca.

### Fundos e efeitos

- Use `#0E0A14` como base principal, com variações de superfície suficientes para separar blocos.
- Gradientes roxo/rosa/laranja são adequados para campanhas, aberturas e acentos selecionados.
- Evite brilho forte por trás de textos pequenos e controles operacionais.
- Respeite preferências de movimento reduzido quando houver animações.

## 6. Regras por dispositivo

### Cabine do DJ

- Organização operacional antes de efeitos visuais.
- Play e ações primárias em laranja.
- Menus e seleção em roxo; interações em rosa.
- Não deixar o glow competir com o conteúdo do catálogo e a fila.

### TV / segunda tela

- **Vídeo e letra sempre em primeiro lugar.**
- Header com zonas claras: marca/sala, música atual e controles.
- Evitar informações “tocando agora” duplicadas.
- Fila compacta, sem cobrir a área crítica de letras; posicionar perto da borda inferior com área segura suficiente.
- Dar prioridade a informações legíveis à distância; controles auxiliares discretos.
- Testar proporções/resoluções diferentes para prevenir colisões.

### Celular e tablet

- Reorganizar elementos de acordo com espaço e orientação, sem copiar rigidamente a distribuição desktop.
- Garantir áreas de toque, legibilidade e hierarquia consistente.
- Utilizar a versão apropriada da logo conforme o espaço disponível.

## 7. O que evitar

- Azul da identidade antiga como cor estrutural dominante.
- Botões Play amarelos legados quando o novo token laranja já estiver aplicado.
- Roxo, rosa e laranja com brilho forte em todos os elementos.
- Gradientes genéricos usados sem função.
- Logo reconstruída em CSS ou substituída por emoji.
- Texto que invada bordas, overflows ou controles que se sobreponham ao nome da sala.
- Overlays fixos cobrindo letras do karaokê.
- Layout único copiado indiscriminadamente para todos os dispositivos.

## 8. Checklist de revisão

- [ ] Logos oficiais corretas, com proporções preservadas.
- [ ] Tokens globais aplicados sem criar temas divergentes.
- [ ] Ações principais laranja; seleção roxa; social rosa.
- [ ] Contraste e texto legíveis em telas pequenas e TVs.
- [ ] Estados hover/focus/disabled funcionais e consistentes.
- [ ] Nenhuma interface relevante esquecida na migração.
- [ ] Reproduções, fila e sincronização preservadas.
- [ ] Não há sobreposição no header ou na região das letras.
- [ ] Arquivos e validações realizados documentados.

## 9. Como utilizar no repositório

1. Mantenha este arquivo em `branding/README-branding.md`.
2. Inclua a arte completa da identidade em `branding/` como referência ilustrada.
3. Preserve as logos separadas e oficiais em `branding/logos/`.
4. Ao adicionar ou substituir um ativo oficial, atualize a tabela de nomes reais na seção 4 e o registro de integridade em `branding/BASELINE.md`.
5. Mantenha `AGENTS.md` na raiz, apontando para este documento.
6. Peça ao agente para auditar antes de migrar; alterações amplas só após aprovação.

**Status:** identidade aplicada ao produto. Os ativos públicos derivados ficam em `Assets/brand/`; os originais deste diretório permanecem como fonte de verdade. Tokens e compatibilidade estão centralizados em `App/karaoke-theme.css`.
