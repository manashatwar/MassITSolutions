# Mass IT Solutions

This is the front-end codebase for the Mass IT Solutions web application demo. 

## Getting Started

To run the local demo:

1. Make sure you have Node.js and Yarn installed.
2. Enable corepack if you haven't already: `corepack enable`
3. Run `yarn install` to fetch dependencies.
4. Run `yarn start-demo` in the `client` folder to start the web application.

## Architecture

This project is built on [React](https://reactjs.org/) using a micro-frontend architecture powered by Yarn Workspaces.
The data is currently mocked locally via `GqlContext` for demonstration purposes.

## Packages

The frontend is divided into multiple feature packages located in the `client/packages` directory:
- `host`: The main shell application
- `common`: Shared UI components, icons, and hooks
- `system`, `inventory`, `dashboard`, etc.: Feature modules

