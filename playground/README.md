# Playground

This directory is for debugging `npm-hono-proxy`.

## How to use

1. Start the proxy server using one of the **VS Code Tasks** or **npm scripts** below.
2. Open another terminal in `playground/test-project`.
3. Run `npm install`.

## Running the Server

You can run these tasks via VS Code's "Run Task" command or directly via npm in the project root.

| VS Code Task | npm Script | Description |
| :--- | :--- | :--- |
| **Playground: Dev Server** | `npm run play:dev` | Runs the server in development mode (`npm run dev`). |
| **Playground: Bin (Build & Run)** | `npm run play:bin` | Builds and runs the server using the CLI script (`node bin/cli.js`). |
| **Playground: NPX (Build & Run)** | `npm run play:npx` | Builds and runs the server using `npx .` (simulating installed package). |

## Helper Scripts

These scripts help you verify the proxy behavior.

| npm Script | Description |
| :--- | :--- |
| `npm run play:reset` | Deletes `node_modules` and `package-lock.json` in `test-project`. |
| `npm run play:verify` | Checks if `is-odd` was successfully installed in `test-project`. |

## Test Project

The `test-project` directory contains a `package.json` and an `.npmrc` configured to use the local proxy (`http://localhost:4873`).
