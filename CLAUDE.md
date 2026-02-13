# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Our Garden is a Next.js 16 application built with React 19, TypeScript 5, and Tailwind CSS v4. It is in early development (v0.1.0), scaffolded from `create-next-app`.

## Commands

- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint (uses `eslint-config-next` with core-web-vitals and TypeScript rules)

## Architecture

- **Routing:** Next.js App Router (all routes in `app/` directory)
- **Styling:** Tailwind CSS v4 with PostCSS; global styles in `app/globals.css` using CSS variables for light/dark theme
- **Fonts:** Geist Sans and Geist Mono via `next/font`
- **Path aliases:** `@/*` maps to the project root
- **Static assets:** `public/flowers/` contains SVG flower illustrations (naming: `{flower}-{color-theme}.svg`, themes: earth, forest, ocean, pastel, sunset)

## Key Conventions

- TypeScript strict mode is enabled
- No custom Next.js config — relies on framework defaults
- No backend layers (database, auth, API routes) are configured yet
- No component library or state management — plain HTML elements with Tailwind utility classes
