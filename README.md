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
- `npm run check:demo` – verify the README demo link and ensure the GitHub Pages
  deployment responds with a 200 status and contains the game's
  `<title>Autobattles4xFinsauna</title>` tag.

## Gameplay

- Click on the map to move the selected soldier to that hex.
- Use the build menu to **Build Farm**, **Build Barracks**, **Upgrade Farm**,
  or apply the **Eco Policy**.
- The resource bar shows your current gold and the event log lists recent
  actions.

## Deployment

Pushing to `main` runs a workflow that builds the app and commits the result to
the repository root so GitHub Pages serves the game. In the repository settings
set **Pages → Source** to `main` and `/`.

To build locally:

```bash
npm run build
```

The production files are written to `dist/`.

## Live Demo
Deployed on GitHub Pages: https://wasab1kastike.github.io/autobattles4xfinsauna/?utm_source=chatgpt.com

## Running Tests

```bash
npm test
```

## Contributing

Contributions are welcome! Fork the repository, create a branch, make your
changes, and open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for
guidelines.

