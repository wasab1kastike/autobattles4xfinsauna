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
- `npm run check:demo` – verify the README demo link and ensure the live site
  responds with a 200 status and contains the game's
  `<title>Autobattles4xFinsauna</title>` tag.

## Gameplay

- Click on the map to move the selected soldier to that hex.
- Use the build menu to **Build Farm**, **Build Barracks**, **Upgrade Farm**,
  or apply the **Eco Policy**.
- The resource bar shows your current gold and the event log lists recent
  actions.

## Deployment

Pushing to `main` runs a workflow that builds the app and publishes the
contents of `dist/` directly to GitHub Pages using the official deployment
actions. The workflow uploads the Vite build output as a Pages artifact and
releases it without committing generated files back to the repository.

To build locally:

```bash
npm run build
```

The production files are written to `dist/`.

## Live Demo
Experience the latest build at https://artobest.com/?utm_source=chatgpt.com

## Troubleshooting

### Canvas fails to render on artobest.com or other hosts

If the live site loads without showing the canvas or HUD, confirm the hosting
shell matches the expected structure:

1. Ensure the HTML includes both `<canvas id="game-canvas"></canvas>` and a
   `<div id="resource-bar"></div>` element before loading the entry module.
2. Load `src/main.ts` after the DOM has been parsed (for example, place the
   `<script type="module" src="./main.ts"></script>` tag at the end of the
   `<body>` or invoke `init()` after the `DOMContentLoaded` event).
3. Open the browser console to review diagnostics—the bootstrapper now logs a
   descriptive error when either required element is missing.

## Running Tests

```bash
npm test
```

## Contributing

Contributions are welcome! Fork the repository, create a branch, make your
changes, and open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for
guidelines.

