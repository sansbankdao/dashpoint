# Homemade Crypto

A kombucha storefront and landing page built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), maintained by Sansbank DAO.

- Landing page: <https://dashpoint.store>
- Storefront demo: <https://dashpoint.store/demo> (also served at <https://demo.dashpoint.store>)
- Hosted storefront: `https://<username>.dashpoint.store` — resolves a Dash Platform username to that identity's store

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
│   ├── lib
│   │   ├── cart.ts
│   │   ├── cart.test.ts
│   │   ├── store-api.ts            client for the dashpoint-api store + items resolver
│   │   ├── store-api.test.ts
│   │   ├── store-host.ts           hostname -> DPNS label parsing/validation
│   │   └── store-host.test.ts
│   ├── middleware.ts               rewrites a store subdomain's `/` to `/store`
│   ├── pages
│   │   ├── index.astro
│   │   ├── demo.astro
│   │   └── store.astro
│   ├── styles
│   │   └── global.css
│   └── types.ts
└── package.json
```

`/` is the landing page, `/demo` is the storefront demo, and `<username>.dashpoint.store/` is a merchant's hosted storefront. All build from this one repo, so the demo cannot drift from what the landing page advertises. `/demo` is prerendered; `/` and `/store` are server-rendered (see `AGENTS.md` for why).

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
| `pnpm test`               | Runs the cart unit tests                         |
| `pnpm audit`              | Scans dependencies for known vulnerabilities     |
| `pnpm astro ...`          | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help`    | Get help using the Astro CLI                     |

## 🧾 License

Released under the MIT License. See [LICENSE](./LICENSE).

Copyright (c) 2025 Sansbank DAO.
