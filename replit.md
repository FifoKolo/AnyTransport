# AnyTransport

A static web platform for requesting and managing transport and removal quotes (house removals, piano transport, vehicle shipping, etc.).

## Tech Stack

- **Frontend:** Pure HTML5, CSS3, and Vanilla JavaScript (ES6+) — no framework
- **Maps:** Mapbox GL JS (v2.14.1) for route visualization
- **Data storage:** `localStorage` (client-side mock backend)
- **Package manager:** None (no build step required)

## Project Layout

```
/
├── index.html              # Landing page
├── create-job.html         # Job creation / quote request form
├── dashboard.html          # User dashboard
├── css/                    # Modular stylesheets
│   ├── style.css
│   ├── navbar.css
│   ├── create-job.css
│   ├── house-removal.css
│   └── sticky-next-btn.css
├── js/                     # Application logic
│   ├── create-job.js       # Main form controller (~22700 lines)
│   ├── multi-items-handler.js  # Piano & vehicle multi-item storage
│   ├── house-removal.js    # House removal room inventory
│   ├── auth.js
│   └── cache-maintenance.js
└── assets/                 # Static assets (logo.jpeg, floors.png)
```

## Running Locally

The site is served as a static site using `npx serve`:

```bash
npx serve . -l 5000
```

Workflow: **Start application** — serves static files on port 5000 (webview).

## Deployment

Configured as a **static** deployment with `publicDir: "."`.

## Architecture Notes (create-job.js)

### Vehicle/Piano Field ID Convention

Hidden inputs for vehicle/piano fields follow the pattern:
- `{type}-{field}-entry-hidden` for hidden value storage (e.g. `car-value-entry-hidden`, `piano-type-entry-hidden`)
- `{type}-{field}-entry-nav` CSS class for the option-nav wrapper
- `data-option-nav-for="{type}-{field}-entry-hidden"` attribute on option-nav divs

Make/model text inputs use: `{type}-make-model-entry` (e.g. `car-make-model-entry`)
Year hidden inputs use: `{type}-year-entry-hidden` (e.g. `car-year-entry-hidden`)
JSON storage: `{type}s-json-hidden` (e.g. `pianos-json-hidden`, `cars-json-hidden`)

### Service selector
- `cjHidden` = `document.getElementById('item-description-hidden')` (the service selector hidden input)
- `getActiveServiceValue()` returns the current service label

### setFormStep
- Only ONE `setFormStep` block exists, guarded by `stepFlowReady` flag
- `isVehicleLikeStepFlowService` includes Boats — uses parking level selectors at steps 2/4

### Option-nav initialization
- `setupOptionNavs()` initializes all `[data-option-nav-for]` navs globally
- `getOptionNavLabel(hiddenId)` reads the selected button text from a nav
- `getOptionNavLabels(hiddenId)` handles multi-select navs (e.g. car transport method)

## Service Status

### Functional (bugfixed)
- House Removals, Piano Transport, Office Removals
- Car Transport, Motorbike Transport
- Trailers & Campervans, Boats
- Clearance
- Customized Items / Other / Specialist & Antiques / Vehicle Parts / Packaging

### Incomplete (awaiting design — DO NOT modify)
- Freight, Industrial, Manpower

## Bug Fix History

### Session 1
- Grammar fix: "Is an lift" → "Is a lift"
- Fixed `syncBoatsTransportLabels` DOM selectors
- Fixed `multi-items-handler.js` for Boats (CVRT skip, seaworthy label)

### Session 2
- Removed duplicate `setFormStep` block (748 lines) that ran unconditionally
- Fixed `jsonFieldIdMap` — all vehicle summary field IDs now use correct `-entry-hidden` pattern
- Deleted dead `initTrailerCampervanDropdowns()` (was logging 6 console errors)
- Fixed `getClearanceStep3MissingRequiredField` to not skip hidden inputs

### Session 3
- Fixed Piano Transport: all JS references to `piano-type-hidden` and `piano-size-hidden` updated to `piano-type-entry-hidden` and `piano-size-entry-hidden` (6 occurrences across `syncPianoCustomFields`, event listeners, summary reads, and the piano item builder)
- Added `data-option-nav-for` attributes to piano type and size option-navs in HTML so `setupOptionNavs()` can initialize them
- Added IDs to piano `(required)` label spans: `piano-size-required`, `piano-custom-name-required`, `piano-custom-length-required`, `piano-custom-width-required`, `piano-custom-height-required`
- Deleted dead `initCarTransportDropdowns()` and `initMotorbikeTransportDropdowns()` functions and their call sites (were logging console.warn for stale dropdown toggle/menu elements)

### Session 4 (latest)
- **Fixed refresh-breaks-form bug (House Removals step 3):** On page refresh, the inventory container (`inventory-card-container`) was permanently hidden because `updateInventoryAndliftVisibility()` required the lift to be selected (`liftRequired && !liftSelected`), but lift is intentionally excluded from restore so users must re-select it each load. Three-part fix:
  1. Exposed `isRestoring` flag via `window.__cjIsRestoring = () => isRestoring` inside the `setupSimpleCreateJobDraft` IIFE, so `updateInventoryAndliftVisibility` can read it cross-scope.
  2. Modified `updateInventoryAndliftVisibility` → `canShowInventory` to bypass the lift check (`|| (_isRestoring && hasSelectedPickupFloors)`) while a restore is in progress and floors are already selected.
  3. Added an explicit inventory-reveal block in the deferred `applyUiState()` callback (the `setTimeout(..., 0)` inside `restoreCreateJobProgress`): if `selectedPickupFloors.size > 0` and the container is still `display:none`, force it open and call `ensureMultiFloorInventoryVisible()`.
- **Exposed `window.renderPickupFloorSelector`**: The pickup floor selector function was a local DOMContentLoaded declaration never assigned to `window`, so `applyUiState`'s `window.renderPickupFloorSelector()` call was always a no-op. Added `window.renderPickupFloorSelector = renderPickupFloorSelector;` after the function definition (matching the pattern already used for `window.renderDeliveryFloorSelector`).

## Known Remaining Items (non-critical)
- Mapbox WebGL fails in Replit env — geocoding is not a priority per user
- `pickup-piano-type-group` referenced in JS but element doesn't exist in HTML — silently no-ops (code path unreachable)
- Sidebar stepper labels are hardcoded and don't update per service type
- `operational` field in `multi-items-handler.js` saved as empty string to JSON (no HTML element) — effectively a missing feature, displays nothing
