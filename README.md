# SAAME — Sistema de Aplicação e Análise de Métodos de Espaçamento

**SAAME** (Spacing Application and Analysis Method Engine) é uma ferramenta *open-source* voltada ao ensino e à aplicação prática do espaçamento tipográfico (*character spacing*). O sistema converte fundamentos teóricos clássicos do *type design* — os métodos de **Walter Tracy (1986)** e **Miguel Sousa (2005, apud Vargas, 2007)** — em uma interface web interativa, permitindo importar, analisar, ajustar e exportar fontes com métricas de espaçamento aplicadas automaticamente.

O projeto foi desenvolvido como protótipo experimental de pesquisa aplicada em Design, com o objetivo de reduzir a dependência de softwares proprietários (como Glyphs App) no ensino de tipografia, oferecendo uma alternativa acessível e gratuita para estudantes e pesquisadores.

🔗 **Protótipo online:** [saame-vercel.vercel.app](https://saame-vercel.vercel.app/)

---

## Índice

- [Sobre o projeto](#sobre-o-projeto)
- [Fundamentação teórica](#fundamentação-teórica)
- [Arquitetura e stack tecnológica](#arquitetura-e-stack-tecnológica)
- [Funcionalidades](#funcionalidades)
- [Modos de operação](#modos-de-operação)
- [Módulo de ajuste de métricas](#módulo-de-ajuste-de-métricas)
- [Análise comparativa](#análise-comparativa)
- [Processo de desenvolvimento](#processo-de-desenvolvimento)
- [Instalação e execução local](#instalação-e-execução-local)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Limitações conhecidas](#limitações-conhecidas)
- [Roadmap / trabalhos futuros](#roadmap--trabalhos-futuros)
- [Uso de Inteligência Artificial no desenvolvimento](#uso-de-inteligência-artificial-no-desenvolvimento)
- [Licença](#licença)
- [Referências teóricas](#referências-teóricas)
- [Citação](#citação)

---

## Sobre o projeto

O espaçamento tipográfico consiste na configuração das **proteções laterais** (*side bearings*) de cada caractere — o espaço em branco entre o desenho do glifo e a margem de sua caixa (*glyph box*). Cada glifo possui uma proteção lateral esquerda (**LSB** — *left side bearing*) e uma proteção lateral direita (**RSB** — *right side bearing*); o espaço visível entre dois caracteres sequenciais é dado pela soma do RSB do primeiro glifo com o LSB do glifo seguinte.

Em uma família tipográfica composta apenas por caracteres alfabéticos latinos (mínimo de 52 caracteres), esse processo resulta em mais de **2.700 combinações possíveis de pares**, tornando o espaçamento manual uma atividade extensa e tecnicamente exigente. O SAAME busca transferir parte dessa carga teórica para o sistema, reservando ao designer o papel de refinamento e validação visual.

## Fundamentação teórica

O sistema implementa dois métodos clássicos de espaçamento, escolhidos por sua abordagem didática e complementaridade:

### Método de Tracy (1986)

Baseado na definição de três caracteres-chave associados a formas geométricas primitivas:

| Forma | Referência (caixa-alta) | Referência (caixa-baixa) |
|---|---|---|
| Quadrada | H | n |
| Curva | O | o |
| Triangular | — (caso particular, limites mínimos variáveis) | — |

### Método de Sousa (2005, apud Vargas, 2007)

Propõe a organização dos caracteres em **grupos de previsibilidade**, propagando valores de *side bearings* por relações de similaridade entre glifos.

**Caixa-baixa:**
- **Grupo 1** (alta previsibilidade): `b, d, h, i, l, m, n, o, p, q, u`
- **Grupo 2** (previsibilidade parcial): `a, c, e, f, j, k, r, t`
- **Grupo 3** (sem correspondência estrutural direta): `g, s, v, w, x, y, z`

**Caixa-alta:**
- **Alta previsibilidade:** `B, D, E, F, H, I, N, O, Q`
- **Previsibilidade parcial:** `C, G, J, K, L, P, R`
- **Maior complexidade visual:** `A, M, S, T, U, V, W, X, Y, Z`

## Arquitetura e stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework / Interface | React + Next.js |
| Linguagem | TypeScript |
| Estilização | Tailwind CSS |
| Manipulação de fontes | [OpenType.js](https://github.com/opentypejs/opentype.js) |
| Renderização visual e testes comparativos | Canvas API (HTML5) |
| Ambiente de desenvolvimento | Visual Studio Code |
| Controle de versão | Git / GitHub |
| Hospedagem | Vercel |
| Prototipagem assistida por IA | Google AI Studio (modelo Gemini) |

### Formatos suportados

- **Importação:** OTF, TTF
- **Exportação:** OTF (fonte espaçada), PDF (relatório de manchas de texto)

## Funcionalidades

### Modos de operação

O fluxo inicial do sistema oferece dois modos:

1. **Modo Laboratório** *(foco principal da ferramenta)* — permite manipulação direta da fonte: importação, ajuste de métricas e análise comparativa dos espaçamentos aplicados.
2. **Modo Comparação** — permite comparar duas fontes diferentes sem edição direta.

Fluxo do Modo Laboratório:

```
Início do sistema (escolha do modo de uso)
        │
        ▼
Modo Laboratório (manipulação e exportação)
        │
        ▼
Importação da fonte (OTF/TTF)
        │
        ▼
Módulo de ajuste de métricas
        │
        ▼
Análise comparativa
        │
        ▼
Exportação da fonte espaçada (OTF)
```

## Módulo de ajuste de métricas

Estruturado em quatro subseções operacionais:

- **Fonte Original** — visualização das métricas da fonte importada, servindo como base comparativa.
- **Original Customizada** — manipulação manual e direta dos *side bearings*, preservando os demais espaçamentos originais da fonte.
- **Método de Tracy** — espaçamento automático a partir da definição de glifos-chave (H, O, n, o).
- **Método de Sousa** — espaçamento automático via propagação por grupos de previsibilidade.

## Análise comparativa

Módulo dedicado à avaliação visual e técnica dos resultados gerados:

- **Visualização de mancha de texto** — renderização de blocos de texto com as métricas aplicadas.
- **Visualização em Overlay** — sobreposição dos contornos de diferentes métodos de espaçamento para comparação direta de ritmo e textura.
- **Exportação de relatório em PDF** — manchas de texto geradas, com métricas aplicadas, prontas para impressão.
- **Diagrama de espaçamentos** — visualização gráfica dos valores de *side bearings* gerados.
- **Exportação da fonte final** — arquivo OTF com as métricas espaçadas aplicadas.

## Processo de desenvolvimento

O desenvolvimento do SAAME foi conduzido por meio de **prototipação assistida por IA** (abordagem descrita na literatura recente como *vibe-coding* — Fawzy, Tahir e Blincoe, 2025), na qual requisitos teóricos e funcionais foram traduzidos em prompts estruturados via Google AI Studio / Gemini.

Técnicas de *prompt engineering* aplicadas no desenvolvimento:

| Técnica | Aplicação no sistema |
|---|---|
| Zero-Shot Prompting | Extração direta de conceitos tipográficos (interface, cores, fluxo de trabalho) |
| Few-Shot Prompting | Alimentação da IA com casos práticos de espaçamento para estruturar regras de propagação |
| Role Prompting | IA configurada no papel de um tipógrafo especialista para verificação conceitual |
| Style Prompting | Definição de requisitos não funcionais (cores, estilos, aspectos de interface) |
| Chain-of-Thought (CoT) | Estruturação do fluxo do sistema, do upload da fonte à exportação final |
| Least-to-Most Prompting | Quebra de regras tipográficas em subproblemas (ex.: isolar 'H/O' antes das demais maiúsculas) |
| Answer Engineering | Definição do formato de exportação, métrica de cálculo e propagação de espaçamentos |
| Answer Space | Restrição das respostas da IA a resultados matematicamente precisos e teoricamente fundamentados |
| Self-Refine | Revisão e refinamento iterativo de interface e funcionamento interno |
| Multimodal / Image-as-Text | Interpretação de diagramas e infográficos relacionados ao espaçamento |

**Ciclo de verificação e ajuste**, conduzido pelo desenvolvedor a cada iteração:

- Checagem geral dos resultados a cada interação
- Verificação de alucinações
- Inspeção de leitura dos arquivos de fonte gerados (com auxílio do FontForge)
- Análise preliminar do fluxo do sistema antes da validação com especialistas
- Em caso de problemas: ajuste via programação manual ou assistida

> **Nota de transparência:** por se tratar de um processo de geração de código a partir de expressão de intenções em linguagem natural, com verificação concentrada majoritariamente no comportamento funcional do sistema (e não em auditoria sistemática linha a linha), reconhece-se que o desenvolvimento se aproxima da prática de *vibe-coding*, com os riscos associados de rastreabilidade técnica que essa abordagem implica. Ver seção "Limitações conhecidas".

## Instalação e execução local

```bash
# Clonar o repositório
git clone https://github.com/emanuelfrx/SAAME-Vercel-.git
cd SAAME-Vercel-

# Instalar dependências
npm install

# Executar em ambiente de desenvolvimento
npm run dev

# Build de produção
npm run build
npm start
```

Acesse `http://localhost:3000` após iniciar o servidor de desenvolvimento.

### Requisitos

- Node.js (versão LTS recomendada)
- npm ou yarn
- Navegador com suporte a Canvas API (HTML5)

## Estrutura do repositório

```
SAAME-Vercel-/
├── app/                  # Rotas e páginas (Next.js App Router)
├── components/           # Componentes React reutilizáveis
├── lib/                  # Lógica de manipulação tipográfica (OpenType.js)
├── public/                # Assets estáticos
├── styles/               # Configuração Tailwind CSS
├── types/                # Definições TypeScript
├── package.json
└── README.md
```

> Ajuste esta seção conforme a estrutura real de pastas do repositório.

## Limitações conhecidas

- **Amostra de validação reduzida:** a avaliação de usabilidade foi conduzida com 3 especialistas em tipografia, o que limita a generalização dos achados e não mede a curva de aprendizado de estudantes.
- **Dependência de conectividade:** o sistema não possui modo offline.
- **Curva de aprendizado inicial:** densidade de informações técnicas na interface pode sobrecarregar usuários iniciantes (efeito relacionado à carga cognitiva).
- **Ausência de módulo de kerning:** o sistema atualmente trata apenas do espaçamento por *side bearings*, sem ajuste de pares específicos (kerning).
- **Questões éticas de desenvolvimento assistido por IA:**
  - Atribuição e responsabilidade técnica sobre código gerado por IA
  - Dependência de infraestrutura proprietária de IA (Google AI Studio / Gemini) e implicações para reprodutibilidade
  - Custo ambiental associado ao uso de LLMs
  - Risco de distorções sutis em relação às teorias tipográficas não captadas nas etapas de verificação
  - Direitos autorais sobre fontes preexistentes manipuladas pelo sistema
  - Riscos de rastreabilidade técnica associados à abordagem de *vibe-coding* utilizada no desenvolvimento

## Roadmap / trabalhos futuros

- [ ] Módulo de kerning
- [ ] Modo offline
- [ ] Avaliação de usabilidade com estudantes via escala SUS (System Usability Scale)
- [ ] Ampliação do suporte teórico embutido na interface (conteúdo pedagógico)
- [ ] Refinamento de affordances visuais (destaque de botões de ação, ex.: exportação e Modo Overlay)
- [ ] Padronização de nomenclatura entre módulos (ex.: "Original Customizada" vs. "Custom")
- [ ] Auditoria técnica mais granular do código gerado por IA

## Uso de Inteligência Artificial no desenvolvimento

Em conformidade com diretrizes de transparência e integridade acadêmica:

- **Ferramentas utilizadas:** Google AI Studio, com suporte do modelo Gemini, como apoio técnico ao desenvolvimento da lógica do sistema e à prototipagem de fluxos de interação.
- **Supervisão e responsabilidade:** todo o código gerado com suporte de IA foi revisado e validado pelo(s) desenvolvedor(es), que mantêm responsabilidade final sobre o conteúdo do repositório. A IA não formulou conclusões nem substituiu decisões de autoria.

## Licença

Este projeto é distribuído como *software* de código aberto, sem fins lucrativos, voltado à comunidade acadêmica.

> Adicione aqui o arquivo `LICENSE` correspondente (ex.: MIT, GPL-3.0, Apache 2.0) conforme a licença escolhida para o repositório.

## Referências teóricas

- HENESTROSA, Cristobal; MESEGUER, Laura; SCAGLIONE, José. **Como criar tipos: esboço à tela**. Brasília: Estereográfica, 2014.
- TRACY, Walter. **Letters of credit: a view of type design**. Boston: David R. Godine, 1986.
- VARGAS, F. de M. **Approaches to applying spacing methods in serifed and sans-serif typeface designs**. 2007. Dissertação (Mestrado) — University of Reading, Reino Unido, 2007.
- FAWZY, Ahmed; TAHIR, Amjed; BLINCOE, Kelly. **Vibe Coding in Practice: Motivations, Challenges, and a Future Outlook — a Grey Literature Review**. arXiv preprint, arXiv:2510.00328, 2025. Disponível em: [arxiv.org/abs/2510.00328](https://arxiv.org/abs/2510.00328).

## Citação

Se este projeto ou a pesquisa associada forem utilizados em trabalhos acadêmicos, cite:

```
[AUTORES]. IA Generativa aplicada ao ensino de espaçamento tipográfico: a construção
e avaliação da ferramenta SAAME. In: 16º Congresso Brasileiro de Pesquisa e
Desenvolvimento em Design (P&D 2026), Recife, PE, 2026.
```

---

**Repositório:** [github.com/emanuelfrx/SAAME-Vercel-](https://github.com/emanuelfrx/SAAME-Vercel-.git)
**Protótipo:** [saame-vercel.vercel.app](https://saame-vercel.vercel.app/)
