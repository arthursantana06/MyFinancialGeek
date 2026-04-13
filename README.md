<div align="center">
  <img src="public/logocomtextosemfundo.png" alt="MyFinancialGeek Logo" width="300" />
</div>

# MyFinancialGeek

Bem-vindo ao **MyFinancialGeek**, um aplicativo completo e moderno de gestão financeira, projetado para ajudar os usuários a controlar transações, acompanhar despesas através de múltiplas contas e cartões de crédito e visualizar resumos de receitas e gastos diários. 

## Arquitetura do Projeto e Tecnologias

Este projeto foi construído utilizando as ferramentas mais modernas do ecossistema React, para garantir boa performance, código tipado e reativo, além de boa responsividade para uso mobile.

- **Vite:** Ferramenta de build super rápida e ambiente de desenvolvimento.
- **React (TSX):** Biblioteca para interfaces de usuário, utilizando React Contexts para estados globais (como autenticação, idioma e UI).
- **TypeScript:** Para garantir tipagem forte e evitar erros de código durante a execução.
- **Tailwind CSS + shadcn-ui:** Utilizado extensivamente para o design system do projeto. Interfaces com aspecto moderno "glassmorphism", dark mode focado e componentes prontos acessíveis.
- **Radix UI:** Biblioteca de componentes não-estilizados usada sob o capô pelo shadcn-ui.
- **Supabase:** Plataforma Backend-as-a-Service, utilizado para:
  - Autenticação de Usuários (`src/contexts/AuthContext.tsx`)
  - Banco de Dados Postgres e regras de acesso `RLS`.
- **React Query (Tanstack Query):** Camada de dados responsável pelo estado remoto da aplicação. Garante que os componentes acessem os dados bancários apenas quando necessário, utilizando as opções de mutação para atualizar o servidor.

## Como a Lógica de Dados (Hooks) Funciona

Para garantir que a lógica do banco de dados (Supabase) não se misture fortemente com os componentes de view (UI), todas as ações para buscar ou alterar dados estão abstraídas dentro de _Custom Hooks_ na pasta `src/hooks/`. Eles usam diretamente as query e mutações do `React Query`:

- **`useTransactions`**: Busca e lista de todas as transações (Receitas e Despesas). Disponibiliza mutações para adicionar (`addTransaction`), atualizar (`updateTransaction`) e deletar (`deleteTransaction`).
- **`useWallets`**: Gerencia "Carteiras" (Contas bancárias normais e Cartões de Crédito). Ele traz o saldo de cada conta.
- **`useCategories`**: Reúne a lista global ou pessoal de categorias de despesa/receita, agrupadas também por cores/ícones.
- **`useDebtors` & `useDebts`**: Usado para o fluxo "Módulo de Devedores", onde é possível cadastrar uma pessoa (Debtor) e amarrar débitos/créditos (Debts) a ela, visualizando o saldo final.
- **`usePaymentMethods`**: Possibilita o usuário adicionar métodos de pagamento personalizados (ex: Ticket Restaurante, Pix específico, etc).

Em praticamente qualquer componente, para buscar as transações a sintaxe se parece com: `const { transactions, isLoading } = useTransactions();`

## Estrutura de Arquivos

A estrutura do projeto está centralizada na pasta `src/`, organizada da seguinte forma:

```text
src/
├── components/          # Componentes reusáveis (Ex: Botões, Drawers, Gráficos)
│   └── ui/              # Componentes de base gerados pelo shadcn-ui (ex: input.tsx, drawer.tsx)
├── contexts/            # React Contexts globais (ex: AuthContext.tsx, LanguageContext.tsx)
├── hooks/               # Custom Hooks e conexão com banco de dados usando React Query
├── i18n/                # Configurações e dicionários de tradução (Português/Inglês)
├── integrations/        # Integração e tipagens estritas geradas pelo Supabase
├── lib/                 # Funções utilitárias globais
├── pages/               # Páginas roteáveis da aplicação (ex: Dashboard, ProfilePage, SettingsPage)
├── App.tsx              # Ponto de entrada das rotas principais usando react-router-dom
└── index.css            # Variáveis CSS globais, definições do Tailwind e as classes customizadas de Glassmorfismo
```

## Como usar o app

1. **Autenticação:** Crie sua conta ou faça login de forma segura para acessar seus dados financeiros.
2. **Dashboard Inicial:** Tenha uma visão imediata do seu saldo total, além do resumo de entradas e saídas.
3. **Gestão de Carteiras (Wallets):** Cadastre todas as suas contas bancárias e cartões de crédito para segmentar seus saldos.
4. **Registro de Transações:** Adicione receitas ou despesas rapidamente, especificando a carteira afetada, a data e a categoria.
5. **Módulo de Devedores:** Controle o dinheiro que você emprestou ou pegou emprestado cadastrando as pessoas e os valores correspondentes.
6. **Identificação Personalizada:** Gerencie categorias com cores/ícones customizados e defina métodos de pagamento específicos da sua rotina.

## Como rodar o projeto localmente

Para trabalhar localmente no seu ambiente de desenvolvimento, siga estes passos. É necessário possuir o ambiente Node.js instalado.

```sh
# Passo 1: Clone este repositório
git clone https://github.com/arthursantana06/MyFinancialGeek.git

# Passo 2: Entre no diretório
cd MyFinancialGeek

# Passo 3: Instale as dependências
npm install

# Passo 4: Crie o arquivo .env baseando-se nas credenciais do Supabase
# Ex: VITE_SUPABASE_URL=xxx e VITE_SUPABASE_ANON_KEY=xxx

# Passo 5: Inicialize servidor local na porta 8080
npm run dev
```

Este comando subirá a aplicação juntamente com hot-reloading em `http://localhost:8080`.

## Detalhes de Responsividade (Forms)

O aplicativo é 100% responsivo. Recentemente, a interface dos componentes de "Drawer" (menus puxáveis de baixo para cima no mobile) responsáveis pela adição de contas e transações sofreram atualizações utilizando o utilitário `text-base` juntamente com focos de borda nativos (`focus:ring-1 focus:ring-primary/50`) para prevenir o efeito nativo de _Zoom_ irritante do iOS (Safari) ao focar em inputs, garantindo uma estética 100% profissional e similar a um app nativo em qualquer tela.
