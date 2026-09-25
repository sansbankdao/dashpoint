# Homemade Crypto

A kombucha storefront built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), maintained by Sansbank DAO.

Live site: <https://dashpoint.store>

## 🚀 Project Structure

The project is organized as follows:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── components
│   │   ├── ProductCard.astro
│   │   └── Storefront.astro
│   ├── data
│   │   └── products.ts
│   ├── layouts
│   │   └── Layout.astro
│   ├── pages
│   │   └── index.astro
│   ├── styles
│   │   └── global.css
│   └── types.ts
└── package.json
```

Product data lives in `src/data/products.ts`. The shared `Product` type is defined once in `src/types.ts` and imported wherever it is needed.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`            | Installs dependencies                            |
| `pnpm dev`                | Starts local dev server at `localhost:4321`      |
| `pnpm build`              | Build your production site to `./dist/`          |
| `pnpm preview`            | Preview your build locally, before deploying     |
| `pnpm check`              | Runs `astro check` for type and content errors   |
| `pnpm astro ...`          | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help`    | Get help using the Astro CLI                     |

## 🧾 License

Released under the MIT License. See [LICENSE](./LICENSE).

Copyright (c) 2025 Sansbank DAO.
