---
description: "Use when creating or modifying frontend Vue code. Prefer existing Vuetify components and avoid unnecessary post-change builds."
name: "Frontend Vuetify Rules"
applyTo: "frontend/**/*.{vue,ts,js,css,scss}"
---

# Frontend Rules

- Use a Vuetify component whenever Vuetify already provides the required UI element or behavior. Do not recreate it with raw HTML, custom CSS, or custom state management.
- Prefer components such as `v-data-table`, `v-form`, `v-text-field`, `v-select`, `v-autocomplete`, `v-dialog`, `v-btn`, `v-icon`, `v-alert`, `v-tabs`, `v-pagination`, `v-switch`, `v-checkbox`, `v-snackbar`, and Vuetify layout utilities where applicable.
- Reuse the configured Vuetify theme, variants, density, validation, loading, empty, pagination, sorting, responsive, and accessibility behavior before adding custom implementations.
- Use the configured Vuetify/MDI icon system for interface icons instead of text glyphs or hand-drawn icons.
- Use native HTML or custom components only when Vuetify has no suitable equivalent or project requirements cannot be met with Vuetify. Keep any custom CSS narrowly scoped to product-specific presentation.
- After completing a frontend feature, check editor diagnostics for changed files. Do not automatically run `npm run build`, start the development server, or perform browser testing; the user will test the feature unless they explicitly request those actions.