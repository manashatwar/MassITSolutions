# Mass IT Solutions

This is the front-end codebase for the Mass IT Solutions web application demo. 

## Getting Started

To run the local demo:

1. Make sure you have Node.js and Yarn installed.
2. Enable corepack if you haven't already: `corepack enable`
3. Run `npx corepack yarn install` to fetch dependencies.
4. Run `npx corepack yarn start` to start the web application.

## Architecture

This project is built on [React](https://reactjs.org/) using a micro-frontend architecture powered by Yarn Workspaces.
The data is currently mocked locally via `GqlContext` for demonstration purposes.

## Packages

The frontend is divided into multiple feature packages located in the `frontend/packages` directory:
- `host`: The main shell application
- `common`: Shared UI components, icons, and hooks
- `system`, `inventory`, `dashboard`, etc.: Feature modules

## Storybook

This project uses [Storybook](https://storybook.js.org/) for UI component development and testing in isolation.

To run Storybook locally:
1. Navigate to the frontend directory: `cd frontend`
2. Start the Storybook server: `npx corepack yarn storybook`
3. Open your browser to the URL provided in the terminal (usually `http://localhost:6006`) to view and interact with the component library.
