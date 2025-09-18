# Issue #245 — Unit module directory refactor

## Goal
Prepare the codebase for a dedicated `src/unit/` directory without breaking existing imports.

## Required migrations
- [ ] Relocate the existing `src/unit.ts` barrel so the filesystem can host a `src/unit/` folder.
  - Move its exports into `src/unit/index.ts` and delete the top-level barrel file once consumers compile against the new location.
  - Update `src/game.ts`, `src/render/renderer.ts`, and any other imports or test mocks (e.g. `src/game.test.ts`) to reference `./unit/index.ts` until the new directory lands.
- [ ] Audit remaining references to `src/unit.ts` to ensure no stale imports linger before introducing the folder.

## Follow-on structure
- [ ] Introduce the `src/unit/` directory for the reorganized modules after the barrel relocation completes.
  - Keep `src/unit/index.ts` as the authoritative barrel so downstream modules retain a single import target while the refactor settles.

## Notes for implementers
- Preserve the existing re-export surface exposed by the barrel to avoid cascading refactors across the game loop and renderer while the new folder takes shape.
- Once the directory exists, prefer relative imports such as `import { Unit } from './unit/index.ts';` until follow-up work smooths the paths (for example, by normalizing to `./unit/index.ts` or `./unit/mod.ts`).
- Verify that dynamic import sites (like `src/buildings/effects.ts`) still resolve the factory module after the move.
