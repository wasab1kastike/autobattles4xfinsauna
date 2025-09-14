# autobattles4xfinsauna

Prototype of a small autobattler/4X experiment built with Vite and
TypeScript.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- `npm`

## Setup

```bash
npm install
```

## Available Commands

- `npm run dev` – start a development server with hot reloading.
- `npm run build` – compile TypeScript and bundle the production build.
- `npm run preview` – preview the built app locally.
- `npm test` – run the test suite with Vitest.

## Gameplay

- Click on the map to move the selected soldier to that hex.
- Use the build menu to **Build Farm**, **Build Barracks**, **Upgrade Farm**,
  or apply the **Eco Policy**.
- The resource bar shows your current gold and the event log lists recent
  actions.

## Deployment

The site is published to GitHub Pages and available at:

https://wasab1kastike.github.io/autobattles4xfinsauna/

The Vite configuration automatically sets the correct base path for the build
using the repository name. This ensures asset URLs resolve properly on GitHub
Pages and prevents the site from rendering as plain text. If you fork or rename
the repository, update the `name` field in `package.json` so the build step
continues to point to the right base path.

## Live Demo
Deployed on GitHub Pages: https://wasab1kastike.github.io/autobattles4xfinsauna/?utm_source=chatgpt.com

## Running Tests

```bash
npm test
```

## Contributing

Contributions are welcome! Fork the repository, create a branch, make your
changes, and open a pull request.

