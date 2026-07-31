# Figma specs — App Shell spine (Batch 1)

Extracted from Figma "App Shell v2". Ground truth for the Phase-1 audit.

## Product Bar
Persistent top-level bar: product context, global actions, key navigation.
Anatomy: **Branding (48×48)** + Product name + vertical divider + **Tabs** + Content.
Responsive: **Layout=Large** (full width, 48px tall) / **Layout=Small** (375px, compact).
Surface: product-bar bg `#ffffff`, product-block `#8500cc` (brand), product-text `#18191a`,
product-nav active `#f8ebff`, active-text/icon `#8500cc`.

## Product Navigation v2 — 4 states (= `-> navigation_v2` collection)
| token | Collapsed | Expanded(Hover) | Pinned | Settings |
|---|---|---|---|---|
| width | 40 | 320 | 320 | 320 |
| padding | 0 | 8 | 8 | 8 |
| brand-rounding | 0 | 16 | 16 | 16 |
| isMaximised | false | true | true | true |
| hasChildItems | false | true | true | true |
| hasSearchInput | false | true | true | true |
| hasSearchButton | true | false | false | false |
| header-label | Product name | (same) | (same) | **Settings** |
| search-placeholder | Search navigation items... | (same) | (same) | **Search settings items...** |
| pin-button | default | default | active | active |
| setting-button | default | default | default | active |
| fill | #fafafa | #fafafa | #fafafa | **#f2f2f2** |
| shadow | none | x12 y12 blur32 spread-4 | none | none |

Header buttons: **Settings · Pin · Search · Home · Recent views · Favorite views**.
List: Recents = **last 5 selected** items (not breadcrumb history); Favorites; tagged items;
collapsed groups/subgroups; "collapsed nav dot" when a collapsed group holds a tagged item;
search matches / no-matches / result-selected states. Item = Item Name + Tag. SECTION headers,
Groups, Subgroups.

## App Header
Title + breadcrumbs (delegate to sherpa-breadcrumbs) + favourite toggle + back + slots
(app-actions, filters=QFT, view-actions, title-icon). Already largely rebuilt.

## View Header
Owns ONLY: title, breadcrumbs (delegated), favourite toggle, export/back.
View SELECTION lives in the QFT View scope — view-header must NOT re-implement a picker.
(Inline picker was removed in commit 199018f.)
