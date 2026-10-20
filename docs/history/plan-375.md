# 375 — a range is an Advanced condition: the design

Read-only design, 2026-10-20, at HEAD `efff91ca`. Check each line number when you build.

## Will's words

*"For numerical and date fields a 'range' is an advanced filter. To use a range, the user will enable advanced filter mode and then set the condition to 'between'. Other conditions such as not between, contains, does not contain etc. can be used too. 'Contains' and 'Does not contain' for a date should show a select dropdown with: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, Weekdays, Weekends. We no longer need the range toggle as the 'advanced filter' chip will handle this mode switch."*

## Will's answers, 2026-10-20 (they override the design below)

- NUMBERS ONLY for now. Simple is ONE value box; the Range switch goes. Advanced
  is opt-in per filter with the f(x) chip, as for other filters. A number
  compares: Equals, Does not equal, Greater, Less, Between, Not between; no
  Contains. Its menu keeps the word Reset.
- A Between / Not between row: condition select, start box, end box on one
  line, and a range slider under them, full width.
- DATES stay as they are, with the Single / Range switch: TODO 379.
- The grid cell chip on a number replaces the value.
- Old queries: rewrite the test definitions and data; no conversion code.

## Questions for Will (answered above)

### If the Range switch goes, a number or date field with no Advanced has no way to set a range. Do all number and date fields get Advanced?

- **A. Yes, unless the field says advanced:false**: Advanced is on by default for a number and a date. Demos lastSeen and dashboard storage, Starter seats, Gallery seats and health, and every grid number or date column get the f(x) control and Between.
- **B. No, keep it opt-in**: A field that does not say advanced:true cannot set a range at all.

Pick: A

### TODO 20b made the View's Date (in the app header) a range. Under 375 a range is an Advanced Between row. How does the View's Date open?

- **A. On an empty Advanced Between row**: 20b stays: the View's Date is still a range, now as a Between row with two date boxes. Simple, one day, is still there if the reader picks it with f(x).
- **B. Like every date: Simple, one day**: This overturns 20b. A reader who wants a span must switch to Advanced and choose Between.

Pick: A

### In Simple a number holds one typed value. What does the grid's cell filter chip (373) do on a number?

- **A. It replaces the value, as on a date**: A second press on another number puts that number in place of the first. Simple stays one value.
- **B. It adds the value as an OR'd Equals row**: Several numbers become OR'd rows, and the field switches to Advanced.

Pick: A

### The slider exists only for the Range switch. Does it go from the menu?

- **A. It goes**: Between is two typed boxes in an Advanced row. The menu stops importing sherpa-slider, so check:weight falls. sherpa-slider stays as a component.
- **B. A number's Between row draws a slider**: Rows get a second kind of control, in place of the two boxes.

Pick: A

### A reading saved in a browser before this change, with range:true (a saved filter, a saved View, a draft): what happens to it?

- **A. It is refused and reported once**: That field filters nothing and shows nothing. One 'old-range-reading' report names it. No conversion code is kept.
- **B. It is read as a Between row**: The old reading still works, but the conversion code stays in three places for ever.

Pick: A

### Where do the nine words (Monday … Sunday, Weekdays, Weekends) live?

- **A. One list in the data layer, beside the op words**: The menu's select, the chip face and the grid's label read the same list, as they read the op words today.
- **B. In the menu's markup, as options**: The chip face has no DOM, so it would need its own copy of the words. The words would then be in two places.

Pick: A

### Your words were 'For numerical and date fields … not between, contains, does not contain etc. can be used too.' Read literally, a NUMBER gets Contains too. Does it?

- **A. No: a number only compares**: Equals, Does not equal, Greater, Less, Between and Not between. For a date, Contains and Does not contain pick a day, as you said.
- **B. Yes**: A number's Contains matches its digits as text, so 'Contains 5' matches 15 and 500. It needs a typed box and its own rule in the data layer.

Pick: A

### Every number menu now has Advanced, so it is a filter menu, and a filter menu has Clear, not Reset. TODO 134 said a number has Reset because the slider's handles go back to where they started. With no slider, the box is only emptied. Which word does the button use?

- **A. Keep Reset**: Add the Reset button to the filter menu's footer. Your TODO 134 word stays.
- **B. Use Clear**: Remove the CSS rule that hides Clear on a number. The number menu says Clear, like every other menu.

Pick: A

## The design

ONE RULE. On a number or a date, Simple holds ONE value. A range, and every other question, is an Advanced row. The f(x) control is the only mode switch. No other control changes the shape.

HEAD NOTE. TODO 373 is committed (624b7fbe) and the tree is clean, so all line numbers below are from HEAD.

SIMPLE, NUMBER. Simple is one typed value under Equals, in the .body-number-one box. This is the same with or without a value list. A number body never shows ticks: the number branch of filter-menu.ts:114-130 ignores options. data-min, data-max and data-step stay. They now only set the limits of the typed box. A number-TYPED field whose def is a list chip (kind multi or single, with options) is not a number body. It keeps its ticks, and several ticks are still `in`.

SIMPLE, DATE. Simple is one day on the calendar, in single mode, and it means On. The menu never puts its calendar into range mode again. sherpa-calendar keeps its own range type, because that is a feature of the component.

SEVERAL VALUES ON A NUMBER OR DATE BODY (from where {in:[5,9]}, a host's setChipValues, the menu's `set values`, or a grid clause). Simple cannot hold them, so they become OR'd Equals/On rows in Advanced, ONE value per row: rowsFromPicks(picks). They never become one row with two picks: #fillRow writes only picked[0] (sherpa-menu.ts:643) and #dateRowAnswer reads only one day, so the second value would be lost without warning. A def with advanced:false cannot show rows. In that case `set values` with several values sets nothing and calls report() once ('one-value-body'), so nothing changes without a trace.

ADVANCED. Every number and date offers Advanced unless its def says advanced:false (Q1). advancedOf (filter-kind.ts:55) becomes `def.advanced ?? (def.kind === 'number' || def.kind === 'date')`. Its parameter widens from OffersAdvanced to KindSource. There is no recursion, because kindOf returns a declared kind before it calls advancedOf. The OPT-IN docstrings at filter-kind.ts:33-36 and the 'advanced' description at schemas/page.v1.json:58 change to say this: opt-in for a list, opt-out (advanced:false) for a number or a date.

OPS_FOR_TYPE (store.ts:101-106) becomes:
- number: eq ne gt gte lt lte between notbetween. There is no Contains on a number (see Q7).
- date: eq(On) lt(Before) gt(After) between notbetween weekday(Contains) notweekday(Does not contain) last next.
- text: no change.

What each op takes:
- Number between and notbetween: TWO typed boxes. .condition-value is the From end. A new .condition-value-to is the To end. The row's data-takes is 'range'.
- Every other number op: one typed box (data-takes 'text').
- Date between and notbetween: .condition-date plus .condition-date-to (data-takes 'dates').
- Date weekday and notweekday: ONE select, a new .condition-day (data-takes 'weekday'). Its first option is the placeholder this.word('select') ('Select…', sherpa-menu.html:259 and :436) with value ''. Then come the nine sets. If the row holds a set that is not one of the nine (for example where {weekday:[1,3]}), one extra option is added and selected for it, spelled day by day ('Monday, Wednesday'). The row records the reader's choice in row.dataset.want, as list picks do. An untouched select is not an answer (T-an-untouched-select-is-not-an-answer), so choosing Contains does not filter Monday at once. A read before the async populate finishes gets want, not ''.
- Date last and next: count + unit, as now.
- A range row is answered only when BOTH ends are set. rowAnswered (filter-state.ts:230-234) learns this. readingAnswered (query.ts:181-187) checks its rows with rowAnswered, so it no longer holds a one-end row as an answer. The one-end branch of rangeClause (:452-454) goes.

LAYOUT. .condition-row is a 4-track grid (sherpa-menu.css:205). The 'range' and 'weekday' rows join the flex-run selectors at :251-255, with the same flex rules as 'dates'. Their right-end border rules (:257-266) gain .condition-value-to for range and .condition-day for weekday, in the data-only and data-readonly forms.

THE OPS.
- FilterOp gets three new ops: notbetween, weekday and notweekday. They follow the `not` prefix of the grammar (notcontains, notin). There is no aliasing and no reuse of `contains`. A clause carries no field type, so `contains` on a date would substring-match the ISO text in matchesFilter, and filterNeedles (store.ts:359) would highlight it in cells.
- OP_TAKES: notbetween is 'range'. weekday and notweekday are 'list': the row's picked IS the day set.
- OP_LABELS: notbetween 'Not between', weekday 'Contains', notweekday 'Does not contain'. weekday exists only on a date, so DATE_OP_LABELS needs no entry.

JSON CLAUSES.
- ['seats','notbetween',[10,50]]. The ends are sorted by the field's type, as for between.
- ['created','weekday',[6,7]]. The value is always an array of ISO weekdays: Monday is 1 and Sunday is 7 (Temporal's dayOfWeek). One day is [3]. Weekdays is [1,2,3,4,5]. Weekends is [6,7].
- ['created','notweekday',[…]] takes the same value shape.
- A definition writes {created:{weekday:[6,7]}}. where.ts clauseOf (:130-154) accepts the key once it is in OP_TAKES. schemas/page.v1.json:132-150 adds the three keys: notbetween takes a 2-item array, and weekday and notweekday take an array of integers 1-7.
- A definition's where also READS back correctly from commit 1 on. where.ts rowReading (:95-103) sends weekday, notweekday and notbetween to {conditions:[row], mode:'advanced'}, as it already does for last and next. Without this, {weekday:[6,7]} would read as a Simple pick, and fieldState would drop it on a catalogue date field, because the catalogue declares that field's values (field-catalogue.ts:160-163) and 6 and 7 are not among them.

STORE COMPILE (store.ts matchesFilter :383-430, DOM-free).
- notbetween is exactly !between. So a null value matches, as it does for ne, notin and notcontains.
- weekday reads the value's DAY through a new isoDay(value) in format-date.ts. isoDay NEVER throws:
  - A Date gives undefined if getTime() is NaN, else toISOString().slice(0,10).
  - Text gives its first ten characters only if they are YYYY-MM-DD AND plainDate() accepts them. It is in try/catch, because plainDate throws RangeError on a false day such as '2026-02-30' (temporal.ts:98).
  - Anything else gives undefined, which matches nothing.
  One bad row can therefore never stop filterRows.
- isoDay returns the day, and a new isoWeekday(value) gives plainDate(day).dayOfWeek, or undefined. Both import from src/core/ui/temporal.ts. That file uses no DOM globals; lint's DOM-free rule (eslint.config.js:56-90) checks globals and a list of named imports, and temporal.ts is not on that list.
- weekday matches when the array includes the day. notweekday is !weekday.
- ZONE RULE: the day is the day as WRITTEN in the value. A time field's 'YYYY-MM-DDTHH:mm' uses its own date part. An instant ('…Z', or a Date) uses its UTC day. This agrees with formatDate, durationSpan and the 373 cell chip (T-a-date-reads-one-way). The grid's #cellValue regex (sherpa-data-grid.ts:1353) is replaced by isoDay. That gives one rule, and it also removes today's unguarded toISOString on an Invalid Date.

ROW TO CLAUSE (filter-state.ts rowClause :465-490).
- weekday and notweekday become [field, op, picked.map(Number).filter(1..7)]. An empty set gives no clause.
- A 'range' row becomes [field, row.op, [lo,hi]]. rangeClause takes two ends and the op, and stops hard-coding 'between'.
- On a time field, notbetween ends at endOf(to), as between does.
- IdbStore #rangeFor (idb-store.ts:309-360) returns null for the new ops. It then reads all rows and matchesFilter decides.

SERVER. RestStore sends the clause as written (stores.ts:416-425). DATA-SOURCE-RULES.md:64-98 lists the three ops and their where form, and says three more things:
- These are Sherpa's own names. DevExtreme has no not-between (it uses '!') and no weekday op.
- Weekday is the ISO day of week, 1-7, on the day as written. A server must read the date part of the stored text, or the local date. It must not use EXTRACT(ISODOW) on a timestamptz, because that uses the session time zone. JS getUTCDay gives Sunday as 0, so map 0 to 7.
- The OPS whitelist in mcp-server/tools/data.js:293-297 and its description at :257 add the three ops.

THE WORDS.
- There is one list, WEEKDAY_SETS, in store.ts beside OP_LABELS: {days:[1],label:'Monday'} … {days:[7],label:'Sunday'}, {days:[1,2,3,4,5],label:'Weekdays'}, {days:[6,7],label:'Weekends'}, in Will's order (Q6).
- One spelling helper, sayDays(days), in filter-face.ts. It gives the label of a set that matches one of the nine, or else the single-day labels joined by ', '.
- The menu fills .condition-day from WEEKDAY_SETS, as it fills .condition-unit from DATE_UNITS. An option's value is its days joined by ','.
- The DOM-free face (filter-face.ts: filterFace, spellConditions, conditionLines) and the grid's #columnFilterLabel all use sayDays. So a chip reads condition 'Contains', value 'Weekends'.
- The TIP of an Advanced state stays 'N condition(s) applied'. This is Will's rule (T-a-condition-tip-counts-its-rows, filter-face.ts:105). A test therefore checks the face's condition and value, not the tip.
- The SPAN. A range row reads 'a and b'. A face shows its lead row as a span when that row's op takes 'range'. That is the only source of a span now, because Simple has no range. filter-face.ts:76 `dated = state.type === 'date' && !lead` becomes `state.type === 'date'`. An Advanced Between on a date then reads '01 to 31 Mar 2024', not '2024-03-01 to 2024-03-31'.
- The grid's #columnFilterLabel (:931-945) and #reportColumn (:876) find the ends with OP_TAKES[op] === 'range', so a notbetween row reports `from` and `to` and reads 'Not between: 10 - 50'. A weekday row reads 'Contains: Weekends'. Neither falls through to the count form.
- The fixed words on the new boxes are aria-labels in the markup: 'To value' and 'Day'.

THE CHIP'S ON STATE. sherpa-quick-filter.ts `set reading`, date branch (:356-362), works out `current` the same way the number branch does (:345-353). In Advanced, the chip is on when readingRows(next) has rows. A date answered only by rows (a Between row, or a weekday row) is then drawn ON while it filters.

PANEL. sherpa-filter-panel.ts #fill (:992) returns early only when the state answers nothing AND has no mode and no mirror: `!state || (!readingAnswered(state) && !state.mode && !state.mirror)`. A Simple {picked:['12']} (written by savedReading, clauseReading or a definition) still fills the panel's box.

FOOTER. Today a number menu has Reset, not Clear (TODO 134). Only the default template has .reset (sherpa-menu.html:248). The filter template (:426) has only .clear, and sherpa-menu.css:428 hides .clear on a number. Once every number is a filter menu, no number menu could be emptied. Commit 3 adds the same .reset button to the filter template's footer. The CSS at :427-429 then works unchanged. See Q8.

WHAT GOES.
- The Range switch: .body-range in both templates (sherpa-menu.html:148-152 and :311-315) and its 'Range' word, #onRangeSwitch (sherpa-menu.ts:346-363), menu-range-change, data-range, data-from and data-to.
- data-commit-fixed. Its only readers are the switch paths (sherpa-menu.ts:351 and :1241).
- The slider (Q4): .body-number-range and #endsAnswer. The SLIDER and RANGE halves of #numericValues, #setBodyValues, #setNumberBody, #calendarValues, #syncBody and #onClear also go. Their ONE-VALUE halves STAY: `get values` (:1171), #numericValues (the box), #calendarValues (one day) and #setNumberBody(one) are Simple's only read and write. The chip's menu.values, the toolbar's #chipPicks, `set reading` and #onClear (:2063) all use them.
- #setShape. #setBodyValues becomes: one value goes to the body. Several values become OR'd rows, as described above.
- The dead .body-op select (:161, :317). filter-menu sets data-conditions only on filter menus, so it is never shown today. Its five grid test pokes are ported to rows.
- The range-select draft in the menu, and the range-select listeners in the toolbar (:247, :328) and the chip (quick-filter :128, :877-879).
- In filter-menu: the slider import (:26), asRange (:88-104), and the switch import (:27). The toolbar still imports sherpa-switch itself (toolbar.ts:38), so it loses only the slider.
- FilterDef.range, FilterMenuDef.range and FieldFilter.range. The View's range:true (data-source.ts:788-789) is replaced (Q2).
- FieldReading.range, FieldReading.kept, KeptAnswer, FilterState.range, and isRanged with its public export (data.ts:195). There is no alias.
- READING_KEYS loses range and kept. readingAnswered loses its kept clause.
- rowsFromPicks loses its body param. Every pick becomes one eq row, and the rows are OR'd. The 'two days mean Between' rule for dates and the 'gte AND lte' rule for numbers both go.
- savedReading saves { picked } only.
- The grid's READING_OPS between entry (:51) and #readingFromClause (:966-992). The grid instead calls a new exported clauseReading(clause, type) in filter-state.ts, which also replaces where.ts rowReading:
  - ONE value under eq on a number or date is Simple.
  - Several values become OR'd rows in Advanced.
  - Every other op is one Advanced row.
  - On a text field, the reading is the same as today.
- #readColumnFilter's date-range check (:903-905) goes. fieldState already drops an unanswered row.
- The dead panel CSS .qf-number-* and .qf-range-row (sherpa-filter-panel.css:200-216).

OLD STORED READINGS (session Query, view drafts, saved filters and saved Views all reach the source). There is no conversion code. range and kept leave the type.
- The only real risk is an old range:true. Its two picks were ENDS, and reading them as values would change the filter without any warning.
- Every menu-written reading set `range` explicitly (#bodyReading :446-455), and savedReading wrote range:true. So a stored ends-reading always carries the key. A keyless two-pick number reading came only from host or MCP code. Under the new rule its picks are values, which is what such a caller now means.
- One helper, isOldRange(reading) in filter-state.ts, reads the raw key: `(reading as {range?: unknown}).range === true`. It is called at the THREE doors an old reading can pass through, BEFORE anything strips the key:
  - answerOf (query.ts:172). This covers every write into the Query or a draft: data-source.ts:567, :1127 and query-edits.ts:313/:321.
  - fieldState. This covers saved filters (presetClauses) and readingClause.
  - The menu's `set reading`. This covers a host's setChipReading.
- At each door the reading answers nothing, and report() fires ONCE per field, or per picks where the field is not known ('old-range-reading'), deduped by a module Set.
- The UI and the source therefore agree: both show and filter nothing. An Apply cannot write the ends back as a value.
- range:false and kept are simply dropped, because their picks mean what they say.
- A definition's where {between:[…]} is not old. It reads as an Advanced Between row.
- Tests use a unique field per case, because the dedupe Set lives for the whole node:test process.

THE VIEW'S DATE (Q2). The View's date keeps TODO 20b's range, as a row. data-source.ts:788-789 no longer gives range:true. When the field has no reading, the def's state becomes {mode:'advanced', conditions:[{op:'between'}]}. That is an empty Between row, which filters nothing until both days are set. The state is data and needs no new key. Any reading already held wins.

THE CELL CHIP (373, sherpa-data-grid.ts #onCellFilter :1376-1398). It stops writing range:false (:1395). A number now REPLACES the held value, as a date does (`one = at.kind !== 'text' || single`), because Simple holds one value (Q3). #cellValue (:1344-1356) uses isoDay.

TRAPS. T-a-default-is-not-an-override (TRAPS.md:12762) is wholly the range default. It is retired with all six citations: filter-menu.ts:89, sherpa-data-grid.ts:576 and :740, reforged-quick-filter-toolbar.spec.ts:1237 and :1440, and reforged-data-grid.spec.ts:1588. T-a-full-range-is-still-a-range (:12737) is NOT retired. sherpa-slider.ts:109 cites it for the slider's own data-touched rule, so it is rewritten to that rule only, and its five menu citations (sherpa-menu.ts:469, :1184, :1245, :1589, :2053) and the grid spec's :1646 go.

FINDINGS REJECTED:
- 'The 373 work is uncommitted, so commit it first': rejected as stale. HEAD 624b7fbe holds 373 and git status is clean. The line numbers above are corrected to HEAD as that finding asked.

FINDINGS ACCEPTED IN PART:
- 'Q5: only range:true is a risk is wrong': accepted that the old default made keyless two-pick numbers into ends. But no menu, saved filter or grid ever wrote a keyless one, so the refusal stays keyed on range:true. The design now says why, and it puts the check at the three doors so that answerOf cannot strip the key first.

Every other finding is accepted and fixed above or in the commits.

## Commits

### feat(data): 375 — Not between, and a date's weekday: three ops the data layer compiles

src/core/data/store.ts:
- :65-71 FilterOp adds notbetween, weekday and notweekday.
- :74-90 OP_LABELS adds 'Not between', 'Contains' and 'Does not contain'.
- Beside :93, add WEEKDAY_SETS: nine entries in Will's order.
- :114-132 OP_TAKES: notbetween is 'range'; weekday and notweekday are 'list'.
- :383-430 matchesFilter: notbetween = !between; weekday = Array.isArray(value) && value.includes(isoWeekday(actual)); notweekday = !weekday.

src/core/data/format-date.ts adds isoDay(value) and isoWeekday(value). Neither ever throws:
- An Invalid Date gives undefined.
- Text must be YYYY-MM-DD AND pass plainDate() (inside try/catch).
- Anything else gives undefined.
- Imports from ../ui/temporal.js.

src/core/data/filter-state.ts:
- rowAnswered :230-234: a 'range' row needs picked.length >= 2.
- rowClause :465-490:
  - weekday ops give [f, op, days 1-7], or no clause if the set is empty.
  - On a time field, notbetween ends at endOf(to).
  - A range row passes row.op.
- rangeClause :440-455 takes the two ends and the op. Its one-end branch goes.

src/core/data/query.ts:181-187: readingAnswered checks its rows with rowAnswered (query.ts already imports filter-state, so there is no cycle).

src/core/data/where.ts rowReading :95-103: weekday, notweekday and notbetween give {conditions:[row], mode:'advanced'}, as last and next do.

src/core/data/filter-face.ts:
- Add sayDays(days).
- filterFace, spellConditions :143-155 and conditionLines :170-188 spell a weekday row with sayDays.
- notbetween reads 'a and b'.
- :76 dated = state.type === 'date'.
- :77 the span comes from a lead row whose op takes 'range', or from Simple's state.range until commit 4.

Other files:
- schemas/page.v1.json:132-150 adds the three keys.
- mcp-server/tools/data.js:257 and :293-297 add the three ops.
- docs/DATA-SOURCE-RULES.md:64-98 adds the three rows, the ISO 1-7 and day-as-written rule, the time zone warning for EXTRACT(ISODOW) on a timestamptz, the getUTCDay 0-to-7 mapping, and the note that these are not DevExtreme's names.

OPS_FOR_TYPE does NOT change yet, so no menu draws the new ops. This commit is green alone.

**Tests:** Write first:
- test/unit/date-conditions.test.mjs:
  - weekday [6,7] on 'YYYY-MM-DD'
  - weekday [6,7] on 'YYYY-MM-DDTHH:mm' (uses its own date part)
  - a Date at 23:30Z keeps its UTC day
  - Sunday is 7
  - notweekday is the complement
  - '2026-02-30', 'abc', null and an Invalid Date never match, and filterRows over them does not throw
  - on a time field, notbetween ends at T23:59:59.999
- New file test/unit/a-range-is-an-advanced-condition.test.mjs:
  - notbetween excludes both ends
  - a backwards pair is put in order
  - a null value matches notbetween, as ne does
  - ['9','1000'] sorts as numbers
  - a range row with one end is unanswered: no clause, and readingAnswered is false
- test/unit/filter-face.test.mjs: face condition 'Contains' with value 'Weekends'; 'Does not contain Monday'; [1,3] reads 'Monday, Wednesday'; 'Not between 10 and 20'; an Advanced date Between spans '01 to 31 Mar 2024'.
- test/unit/one-way-to-write-a-condition.test.mjs: {weekday:[6,7]} and {notbetween:[10,50]} round-trip through readingsOf and whereOf. Run it WITH catalogue facts that declare the date field's values, and check that the clause survives.
- test/unit/page-definition.test.mjs: the schema accepts the three keys and rejects weekday:[8].
- test/e2e/reforged-idb-store.spec.ts (beside :109-140): a weekday clause reads all rows and matches.

**Gates:** - npm run type-check; lint (the DOM-free boundary passes with the temporal.ts import); test:node.
- check:bench (this is a data-layer commit).
- check:weight: data.js grows by temporal.ts. Record it with --update-baseline and say why in the commit message.
- check:mcp-pack.
- check:map: run map:write on store.ts, format-date.ts, filter-state.ts, filter-face.ts, query.ts and where.ts, then hand-edit the lines (WEEKDAY_SETS, isoDay, isoWeekday, sayDays).
- TRAPS:
  - Add T-a-weekday-is-its-own-op. It says why not `contains`, gives ISO 1-7 and the day as written (UTC for an instant), and says that a bad day never throws. Cite it at matchesFilter, isoDay and rowClause.
  - Amend T-an-operator-decides-pick-or-type: a range needs both ends.
  - Add the TRAPS-INDEX row.
- Never push.

### feat(menu): 375 — a number row answers Between with two boxes, a date row picks a weekday

store.ts:101-106 OPS_FOR_TYPE:
- number gains between and notbetween.
- date becomes eq lt gt between notbetween weekday notweekday last next.

sherpa-menu.html condition-row-tpl (:339-366) adds two controls:
- <sherpa-input-text class="condition-value-to" placeholder="Value" data-clearable aria-label="To value">
- <sherpa-input-text class="condition-day" data-type="select" aria-label="Day">

sherpa-menu.ts:
- #takes (:695-698): a number gives 'range' for a range op and 'text' otherwise. A date gives 'weekday' for the weekday ops, and 'dates' for notbetween too.
- #fillRow (:593-644): a range seed fills both boxes.
- #fillDateRow (:646-660):
  - notbetween fills .condition-date and .condition-date-to.
  - weekday fills .condition-day: the 'Select…' word, then the nine WEEKDAY_SETS, then one extra sayDays option for a held set that is not one of the nine.
  - It records the set in row.dataset.want and selects it AFTER the fill (T-custom-element-upgrade).
  - A change on .condition-day writes want.
- #dateRowAnswer (:663-676): notbetween reads like between. weekday reads row.dataset.want as numbers. Empty want gives no pick.
- get conditions (:757-790): a number range row gives picked [from,to] only when both boxes are typed.

sherpa-menu.css:
- :244-255: per-takes show rules for 'range' (.condition-value-to) and 'weekday' (.condition-day).
- 'range' and 'weekday' join the flex-run selectors at :251-255.
- :257-266: the right-end border rules for data-only and data-readonly.

sherpa-quick-filter.ts set reading, date branch (:356-362): in Advanced, current = readingRows(next).length > 0, as in the number branch.

sherpa-data-grid.ts:
- #reportColumn :876: ends when OP_TAKES[lead.op] === 'range'.
- #columnFilterLabel :941: the same test, with 'Not between' as the name; a weekday row uses sayDays.

The Range switch is untouched in this commit.

**Tests:** Write first:
- test/e2e/reforged-number-advanced.spec.ts, new test 'a number row answers Between and Not between with two boxes'. For the toolbar, the panel and a grid heading: typing '50' and '10' gives ['seats','between',[10,50]]. One empty box gives no clause.
- test/e2e/reforged-date-conditions.spec.ts, new test 'a date's Contains picks a weekday, Weekdays or Weekends':
  - 'Select…' comes first, then the nine sets in order with Will's words.
  - An untouched select gives no clause.
  - Weekends gives ['created','weekday',[6,7]].
  - Does not contain Monday gives notweekday [1].
  - A reading of [1,3] shows 'Monday, Wednesday' and survives an Apply.
  - Not between two days gives a clause.
  - The chip face reads condition 'Contains', value 'Weekends', and is ON. The tip is '1 condition applied'.
- Extend test/e2e/reforged-advanced-rows.spec.ts:44-52 with date:notbetween, date:weekday and number:between. Each row stays on ONE line: check that the boxes share a top.
- Extend test/e2e/reforged-advanced-condition-words.spec.ts with the new op labels.
- test/unit/field-type.test.mjs: OPS_FOR_TYPE per type.

Port tests that break in THIS commit:
- test/e2e/reforged-data-grid.spec.ts:1653: the number conditions add between and notbetween.
- test/e2e/reforged-date-conditions.spec.ts:56: the date labels become On, Before, After, Between, Not between, Contains, Does not contain, In the last, In the next. r.takes and r.shown (:50-55) are unchanged.
- Grid column-filter-change: notbetween reports from and to, and its label.

**Gates:** - npm run type-check, lint, lint:css.
- spec:check: regenerate with node scripts/generate-component-spec.mjs sherpa-menu.
- npm run manifest and reference (docs/components/sherpa-menu.md).
- test:a11y: the new boxes carry aria-labels.
- npm test (3 engines).
- check:weight; check:map (sherpa-menu.ts, sherpa-quick-filter.ts, sherpa-data-grid.ts).
- TRAPS: amend T-ops-follow-the-column-type, and T-a-number-has-advanced-rows (a number row may take two boxes).
- Build, so Demos sees the change.

### feat(filters): 375 — every number and date offers Advanced

src/core/ui/filter-kind.ts:
- :55-57: advancedOf(def: KindSource) returns def.advanced ?? (def.kind === 'number' || def.kind === 'date').
- :33-36: the docstring says opt-in for a list and opt-out for a number or a date.
- schemas/page.v1.json:58 says the same.

sherpa-menu.html: the filter template's footer (beside .clear, :426) gains the same .reset button as the default template (:248-249), Q8. sherpa-menu.css:427-429 then shows Reset on a number filter menu. Its handler is the one the default template already uses.

Callers that follow with no edits:
- filter-menu.ts:125 and :145 (=== true still holds)
- the grid at :695
- the panel at :888, where the f(x) chip (372) now shows on every number and date

A def that says advanced:false keeps today's Simple-only menu. The Range switch is still in both templates in this commit.

Docs: amend T-conditions-are-opt-in-per-field and its TRAPS-INDEX row.

**Tests:** Write first:
- test/unit/field-type.test.mjs:
  - advancedOf({kind:'number'}) is true
  - advancedOf({kind:'date', advanced:false}) is false
  - advancedOf({}) is false
  - advancedOf({kind:'multi', options:[…]}) is false
- reforged-number-filter-reports.spec.ts:318-350: a plain number's filter menu has a Reset button, and it empties the box.

Port tests that break in THIS commit:
- reforged-number-advanced.spec.ts:21 and :70: the plain 'spend' now expects advanced; add a third def with advanced:false that expects {type:null, advanced:false}.
- reforged-menu-calendar.spec.ts:134 and :182: the menu is now type 'filter', and the calendar is still its Simple body.
- reforged-menu-calendar.spec.ts:72 (the header button group), :515 and :638 (the date chip footers): check the header f(x) button and the filter footer. Give a def advanced:false only where the test is about the Simple-only menu.
- reforged-data-grid.spec.ts:1240 (asserts a number heading with no Advanced).
- reforged-chip-tips.spec.ts:16.
- reforged-quick-filter-toolbar.spec.ts:1233 and :1328 are Range-switch tests that commit 4 DELETES. Do not port them. Run them, and if one fails only because of the new default, give its def advanced:false.

**Gates:** - npm run type-check, lint.
- spec:check (sherpa-menu: the reset part is now in both templates); manifest; reference.
- npm test (3 engines); test:a11y.
- check:weight; check:map (filter-kind.ts).
- Build, then run Demos' npm test. Its specs must not depend on lastSeen being Simple-only.

### feat(filters): 375 — the Range switch goes: a range is an Advanced Between

ONE commit, because dropping FieldReading.range is a type error everywhere.

Data layer:
- filter-state.ts:
  - Delete FilterState.range (:100-102), isRanged (:127-132), FieldReading.range and kept (:180-193), and KeptAnswer (:198-199).
  - fieldState (:314, :345-350, :366-369, :382): Simple rows are [{op, picked}].
  - Add isOldRange(reading) and its deduped report('old-range-reading'). fieldState calls it first and answers nothing for an old reading.
  - rowsFromPicks (:281-300) drops its body param. Every pick is an eq row, and the rows are OR'd.
  - savedReading (:415-422) saves {picked}.
  - Add the exported clauseReading(clause, type): one eq value on a number or date is Simple; several values become OR'd rows in Advanced; every other op is an Advanced row.
- where.ts :91-103: rowReading becomes clauseReading.
- query.ts:
  - READING_KEYS :165-168 loses range and kept.
  - readingAnswered loses its kept clause.
  - answerOf :172 calls isOldRange first and returns {} for an old reading.
- source-counts.ts :89 and :164 lose range:false.
- data-source.ts:
  - :788-789: the View's date def gets state {mode:'advanced', conditions:[{op:'between'}]} when it has no reading (Q2).
  - :2008-2011: drop !state.range.
- data-source-types.ts:77-78 drops FieldFilter.range.
- data.ts:195 drops the isRanged export.
- filter-face.ts :77: the span comes only from a lead row whose op takes 'range'.

UI:
- filter-menu.ts:
  - Drop the slider import (:26) and the switch import (:27).
  - Drop range at :44, asRange (:88-104) with its T-a-default-is-not-an-override citation (:89), :118 and :138.
  - Drop data-commit-fixed. defers = def.commit ?? (typed || (!local && !one && !hasOwnBody(kind))).
- filter-def.ts :46-48 and :61-62.
- filters-button.ts :46 drops 'data-range' from DRILL_FLAGS; fix the comment at :302.
- saved-filter-menu.ts:47 drops menu-range-change and range-select.
- sherpa-menu.html:
  - .body-range (:148-152 and :311-315)
  - .body-number-range and .body-op (:154-169 and :316-323)
  - Fires menu-range-change (:111)
- sherpa-menu.ts:
  - Remove: the SherpaSlider and SherpaSwitch types (:35-36); the props data-from, data-to, data-commit-fixed and data-range (:127-142); the switch wiring (:215-217); range-select (:232); #onRangeSwitch (:346-363); #endsAnswer and #setShape; #setBodyOp.
  - #bodyReading (:442-456): a number gives {picked:[one]} or {op, text}; a date gives {picked}.
  - #oneAnswer stays.
  - set reading (:481-503): calls isOldRange first, then writes the one value.
  - KEEP the one-value halves of get values (:1171), #numericValues, #calendarValues and #setNumberBody. Remove only their slider and range halves.
  - #setBodyValues: one value goes to the body. Several values become this.reading = {conditions: rowsFromPicks(next), mode:'advanced'} when Advanced is offered. Otherwise nothing is set, and report('one-value-body') fires.
  - #syncBody (:1530-1590) keeps min, max and step on the box.
  - #syncReadonly drops .body-range (:1617-1621).
  - #onClear drops the sliders (:2026-2050) and keeps the box.
  - Drop the T-a-full-range-is-still-a-range citations at :469, :1184, :1245, :1589 and :2053.
- sherpa-menu.css :82-83, :569 and :596-641.
- sherpa-quick-filter.ts :128, :340-363 (the comments; the date branch stays as in commit 2), :877-879 and :893-927 (no date range).
- toolbar html :10-11, :47-49 and :209-212; toolbar ts :247, :328 and :685-688. The toolbar's own sherpa-switch import (:38) stays.
- panel ts:
  - :351-364 and :413-414.
  - #fill (:989-998): return only when !state || (!readingAnswered(state) && !state.mode && !state.mirror).
- panel css :200-216; panel html :193-195.
- grid ts:
  - :47-52 READING_OPS loses between.
  - #cellKey :573-579 with its citation at :576.
  - #filterDef :740-741 with its citation at :740.
  - #readColumnFilter: drop :903-905.
  - #readingFromClause :966-992 calls clauseReading.
  - #cellValue :1353 uses isoDay.
  - #onCellFilter :1387-1395: no range:false; a number replaces (Q3).

**Tests:** Write first, in test/unit/a-range-is-an-advanced-condition.test.mjs:
- Two picks on a number with no key are `in`, never between.
- where {between} reads as an Advanced Between row; where {in:[5,9]} reads as two OR'd Equals rows.
- An old {picked:[10,50], range:true} answers nothing in fieldState and in answerOf, and reports once. Use a unique field per case.
- rowsFromPicks of one day is one On row.

Also write first:
- e2e: menu.reading = an old range:true reading shows an empty box and leaves the chip OFF; a later Apply writes nothing.
- e2e: menu.values = ['10','50'] on a number gives two OR'd Equals rows in Advanced; on an advanced:false number it sets nothing and reports.
- e2e: the panel fills its number box from {picked:['12']} with no mode.

Delete test/unit/both-shapes-are-kept.test.mjs. The whole file tests the retired rule.

Port these unit tests:
- field-type.test.mjs: :41, :58, :69 and :90 become 'a range is a row'; :78 loses range.
- one-condition-system.test.mjs:50-55: a range is Advanced.
- filter-face.test.mjs :19-46 and :80: the span comes from a Between row.
- one-way-to-write-a-condition.test.mjs :16-35 and :63-68.
- page-definition.test.mjs :189 and :276-289 (Q2).
- a-saved-filter-is-its-readings.test.mjs:46-64.
- one-query-builder.test.mjs:45-58.
- a-live-filter-waits-for-the-moves-to-stop.test.mjs:30: use a typed value, or a between row.
- a-chip-counts-within-the-filters-before-it.test.mjs :62 and :82.
- filters-limit-in-order.test.mjs:33.

Rewrite as Advanced Between: test/e2e/reforged-number-filter-reports.spec.ts :20, :82, :127, :165, :227-306 and :318-361.

Port these e2e tests:
- reforged-quick-filter-toolbar.spec.ts:
  - Delete :1233 and :1328, with their T-a-default-is-not-an-override text (:1237).
  - :1394 becomes 'a number chip waits for Apply on a remote source'.
  - Fix :1440's comment.
  - :1690 becomes the date chip naming its Between row.
- reforged-chip-tips.spec.ts :16, :84, :159 and :194.
- reforged-data-grid.spec.ts:
  - :1544 (Simple one value, Advanced Between); :1588 (citation); :1646 (citation).
  - :1679, :2059-2138, :2729 and :2767-2801.
  - 373's :3182: {picked:[5], mode:'simple'}, plus a second number press that replaces.
  - Port the five .body-op pokes (:1627, :1720, :1812, :1844, :2094) to rows.
- reforged-advanced-condition-words.spec.ts:134-147: between is 'advanced', with the fx icon.
- reforged-number-advanced.spec.ts :17-66, :73-105 and :111-122.
- reforged-date-conditions.spec.ts:61: one day carries over as On.
- reforged-a-calendar-pick-wakes-the-footer.spec.ts:15-18: drop range.

These stay as they are: reforged-menu-calendar.spec.ts:822 and reforged-calendar.spec.ts:540 (the calendar's own range type), and the sherpa-slider specs.

**Gates:** - npm run type-check (READING_KEYS catches a missed key), lint, lint:css (the panel's dead rules go).
- spec:check: regenerate sherpa-menu (data-range, data-from, data-to, data-commit-fixed, menu-range-change and the body-range part go) and sherpa-quick-filter-toolbar (its data-remote doc).
- npm run manifest and reference (sherpa-menu.md :53, :113, :129, :155-156; sherpa-quick-filter-toolbar.md:70).
- test:a11y.
- check:weight: the panel and the grid lose the slider and the switch; the toolbar loses only the slider (it imports the switch at :38). Record the fall.
- check:bench, check:map (every touched file), npm test.
- check:traps. Retire, with every citation removed:
  - T-both-shapes-are-kept :1155
  - T-range-switch-swaps-not-rebuilds :2516
  - T-number-and-date-lead-with-a-range-switch :8180
  - T-a-default-is-not-an-override :12762 (six sites, listed above)
  - the Range half of T-commit-follows-select-mode :694
  - the data-range part of T-drill-flags-travel-and-replace :807
- REWRITE T-a-full-range-is-still-a-range :12737 to the slider's own data-touched rule only. sherpa-slider.ts:109 keeps its citation.
- Rewrite:
  - T-clear-empties-both-body-shapes :5881 and T-a-number-is-reset-not-cleared :2170 (one box; Reset is in both footers)
  - T-grid-slider-spans-real-values :4358 (the ends now set the box's limits)
  - T-a-range-is-bounded-by-the-data :1617 (the calendar half only)
  - T-the-field-type-decides-the-clause :12086
  - T-a-mode-switch-carries-the-answer-over :10853
  - T-one-number-is-a-pick-under-equals :2434
  - T-a-number-waits-for-apply :2189
  - T-a-held-clause-op-is-not-a-reading-op :15125
  - T-a-filter-menu-has-two-modes :10688
  - T-a-panel-date-answers-with-its-days :1131
- Add T-a-range-is-an-advanced-row: the three doors for an old reading, and several values become OR'd rows.
- TRAPS-INDEX rows :56, :96, :402, :432, :499, :511, :547, :553, :563, :584, :668, :880 and :890.
- TODO 375: mark it ✅ and keep its row and section.
- Build at once, because Demos reads dist.

### test(demos): 375 — a range is an Advanced Between (../Sherpa Demos, its own commit)

No app data changes. lastSeen now offers Advanced by default. records-views.json:46 'Renewals' where {between} now opens as a Between row.

Specs only:
- test/e2e/reforged-filter-coordination.spec.ts:
  - :54 the normaliser drops range.
  - :138-150 the slider and switch steps become an Advanced Between row.
  - :178-189 the header Date opens on an empty Between row (Q2).
  - :236 panelSeats is {picked:['12']}.
- test/e2e/reforged-calendar.spec.ts:8-29: the View's Date opens on an empty Between row, and Simple is one day.
- test/e2e/reforged-records-persist.spec.ts:229-255: replace setChipValues('created', [two days]) with setChipReading('created', {mode:'advanced', conditions:[{op:'between', picked:['2024-03-01','2024-03-31']}]}). The want stays {total:14, chip:'on:01 to 31 Mar 2024'}. It holds through the date branch's ON fix (commit 2) and the dated span (commit 1).
- reforged-nav-view-hierarchy.spec.ts:125 and reforged-view-drafts.spec.ts:59: Renewals opens in Advanced.

Gallery: stories/sherpa-menu.stories.js:9 draws the number body without the switch, so no edit is needed. Open it and look. Starter: no change ({gte:50}).

**Tests:** These are the tests, ported as listed. Run Demos' own npm test after the sherpa-ui build. Do not stop Will's :4200 server.

**Gates:** - Run Demos' npm test. It includes check-usage, which rejects any data-range left in markup.
- Look at Gallery's menu story.
- Tell Will what to look at in Records: Seats Between, Date Contains Weekends, the header Date's Between row, and a number menu's Reset.
- Never push.

## The check (the revise above answers it)

- **unsafe:** Commit 2 breaks two tests that the plan only ports in commit 4, or never. (1) test/e2e/reforged-data-grid.spec.ts:1653 expects number conditions toEqual ['eq','ne','gt','gte','lt','lte']; adding between and notbetween to OPS_FOR_TYPE.number (store.ts:103) fails it. (2) test/e2e/reforged-date-conditions.spec.ts:56 expects the date labels to be exactly ['On','Before','After','Between','In the last','In the next']; the new date op list fails it. The plan ports date-conditions only at :61 (commit 4) and grid :1544 only in commit 4.
- **unsafe:** Commit 3 (advancedOf on by default) breaks three tests that the plan does not port in commit 3. (1) test/e2e/reforged-number-advanced.spec.ts:21/:70: a plain 'spend' number expects {type:null, advanced:false}, but the plan ports only :17-66, and in commit 4. (2) test/e2e/reforged-menu-calendar.spec.ts:134/:182: a plain {kind:'date'} chip expects menuType 'calendar', which becomes 'filter' (filter-menu.ts:140-146); this test is not listed at all. (3) test/e2e/reforged-number-filter-reports.spec.ts:322/:347-349: a plain number menu's .reset is queried with '!' and clicked. The filter template has no .reset, so this throws. It is listed only for commit 4.
- **unsafe:** Behaviour regression, against Will's TODO 134 ruling (a number menu has Reset, not Clear). The filter template (sherpa-menu.html:263-437) has no .reset button; only the default template has one (:248). sherpa-menu.css:428 hides .clear on data-body=number. Once every number is a filter menu (commit 3), no number menu can be emptied: no Reset, no Clear. The plan rewrites T-a-number-is-reset-not-cleared but never adds .reset to the filter template.
- **unsafe:** sherpa-quick-filter.ts:356-362, the `set reading` DATE branch, sets `current = days > 0` from next.picked/text only. A date answered by an Advanced row (the View's Date as a Between row under Q2, or any weekday row) therefore draws the chip OFF while it filters. Demos test/e2e/reforged-records-persist.spec.ts:250 expects 'on:01 to 31 Mar 2024', so the planned port fails. The number branch (:345-353) already checks readingRows in Advanced; the date branch needs the same. The plan touches :340-363 only for 'no date range'.
- **unsafe:** filter-face.ts:76 sets `dated = state.type === 'date' && !lead`, so a date's Advanced Between row spans as '2024-03-01 to 2024-03-31', not '01 to 31 Mar 2024'. Moving the span decision to 'op takes range' is not enough. Also filter-face.ts:105: the tip of any Advanced state is 'N condition(s) applied'. So commit 2's new e2e assertion 'the chip tip reads "Contains: Weekends"' fails as written (see filter-face.test.mjs:32 and toolbar spec :2690).
- **unsafe:** Panel #fill guard (sherpa-filter-panel.ts:992). Dropping `state.range == null && !state.kept` and keeping 'mode only' makes #fill return early for a Simple number reading with no mode, such as {picked:['12']}. That is exactly what savedReading, where.ts/clauseReading (one eq value) and a stored definition produce. The panel's inline number box then opens empty while the field filters. The guard must also pass a reading with picks or text for a body field.
- **unsafe:** matchesFilter weekday can throw. plainDate throws RangeError on text that looks like YYYY-MM-DD but is not a real day (temporal.ts:98, e.g. '2026-02-30' or '2026-13-01'). Date.prototype.toISOString throws on an Invalid Date. As designed, isoDay checks only the shape, so one bad row makes filterRows throw and the whole load fails. isoDay or the weekday case must catch this and give no day. The same applies to the grid #cellValue (sherpa-data-grid.ts:1355), which today calls toISOString unguarded.
- **unsafe:** The new .condition-day select is read by its live value. Per T-an-untouched-select-is-not-an-answer (sherpa-menu.ts:779-786), an untouched select reports its first option. So choosing 'Contains' filters Monday at once, and a value read before the async populate settles is ''. A set that is not one of the nine (where {weekday:[1,3]}) cannot be shown and would be replaced by the shown option on the next read. The row needs a 'Select…' placeholder (this.word('select')) and row.dataset.want as its record, as list picks have.
- **unsafe:** Layout: .condition-row is a 4-track grid (sherpa-menu.css:205). Only date, dates and duration rows switch to a flex run (:251-255). A 'range' row with .condition-value plus .condition-value-to, and a 'weekday' row, must join that flex selector, or the extra box wraps onto a second grid line. The plan names only show/hide rules for the new boxes.
- **unsafe:** The old range:true refusal exists only in fieldState, so the UI shows a different answer from the one the source applies. menu `set reading` (number branch, after the rewrite) puts picked[0] into the box. The chip's #state (sherpa-quick-filter.ts:893-927) calls fieldState with menu.reading, which no longer carries range, so the chip reads 'Equals 10' and ON while the source filters nothing. The next Apply then writes {picked:['10']}, which is the silent change Q5 forbids. answerOf (query.ts:172) also strips `range` on every write (data-source.ts:567, :1127; query-edits.ts:313), which erases the marker the refusal depends on.
- **unsafe:** Several values on a number or date become ONE Advanced eq row holding two picks (where.ts rowReading, then clauseReading, and grid #readingFromClause). A number row types one box: #fillRow writes picked[0] (sherpa-menu.ts:643) and `get conditions` returns [typed] (:777-779). A date eq row reads one day (#dateRowAnswer :674). So the second value is dropped silently on the next redraw or Apply. Several picks must become OR'd eq rows, one value each, as rowsFromPicks makes them.
- **unsafe:** check:traps fails as planned. T-a-default-is-not-an-override (TRAPS.md:12762) is entirely the range default. Every site goes: filter-menu.ts:89, sherpa-data-grid.ts:576 and :740, and the test sites reforged-quick-filter-toolbar.spec.ts:1237 and :1440 and reforged-data-grid.spec.ts:1588. The plan neither retires nor rewrites it, so its Site lines name files that no longer cite it. T-a-full-range-is-still-a-range is to be retired 'with every citation removed', but sherpa-slider.ts:109 cites it for the slider's own data-touched rule, a file the plan never touches.
- **unsafe:** Commit 1 is green only because its round-trip test passes no facts. Before clauseReading lands in commit 4, where {weekday:[6,7]} and {notbetween:[…]} read through rowReading (where.ts:91-103) as a Simple {op, picked}. On a real DataSource date field the catalogue declares values (field-catalogue.ts:160-163), so fieldState counts only picks found in that domain. 6 and 7 never are, so the clause is dropped with no report. Move clauseReading into commit 1, or add a facts-bearing test.
- **wrong:** Commit 4 lists '#numericValues, #setBodyValues range, #setShape, #setNumberBody and #calendarValues (:1171-1258)' for deletion. That range includes `get values` (:1171), and #numericValues, #calendarValues and #setNumberBody are Simple's ONLY one-value read and write. The chip's menu.values, the toolbar's #chipPicks, `set reading` and #onClear (:2063) all use them. Deleting them whole breaks Simple. Only their range and slider halves may go.
- **wrong:** Commit 3 says to PORT reforged-quick-filter-toolbar.spec.ts :1233 and :1328, and commit 4 says to DELETE the same two tests. Both are Range-switch tests, so porting them in commit 3 is wasted work, and the plan contradicts itself.
- **wrong:** Commit 4's check:weight claim, 'toolbar, panel and grid entries FALL (no slider or switch)', is half wrong. sherpa-quick-filter-toolbar.ts:38 imports sherpa-switch itself, so the toolbar loses only the slider.
- **wrong:** Q5 says 'Only an old range:true is a risk'. Wrong. fieldState today defaults `range = reading.range ?? (isRanged(type) && !facts.values?.length)` (filter-state.ts:314). Catalogue numbers and grid columns have no values, so a number reading of two picks with NO range key was ENDS (between). After the change it silently becomes `in`, and the refusal cannot see it. Any host-written or MCP-written {picked:[10,50]} changes meaning.
- **wrong:** Q7 pre-picks 'No Contains on a number'. Will's sentence ('Other conditions such as not between, contains, does not contain etc. can be used too') follows 'For numerical and date fields'. Read literally, it gives contains to numbers too. Pick A goes against his literal words, so it must go to Will as a real question, not a default. Q2 pick A likewise overturns Will's TODO 20b ruling (the View's Date is a range), and the design should say that it does.
- **missing:** sherpa-data-grid.ts:931-945 #columnFilterLabel is not in the plan. notbetween and weekday fall through to the count form ('Not between: 2', 'Contains: 2'), and that label reaches the bar's chip through column-filter-change. #reportColumn :876 sets from/to only for op 'between', so notbetween reports from and to as null.
- **missing:** query.ts:181-187 readingAnswered counts any row with a pick, so a one-ended range row is held as an answer while rowAnswered refuses it. The field is held with no clause. It should reuse rowAnswered for its rows.
- **missing:** advancedOf(def: OffersAdvanced) (filter-kind.ts:55) has no `kind` in its type. The new body reads def.kind, so the parameter must widen to KindSource. Also the 'OPT-IN' docstrings at filter-kind.ts:33-36 and the schemas/page.v1.json:58 'advanced' description must say the new default (off only by advanced:false for number and date).
- **missing:** The public setChipValues and menu `set values` with TWO values on a number or date. Today #setBodyValues (sherpa-menu.ts:1203-1235) reads two values as a range. Demos reforged-records-persist.spec.ts:246 calls hb.setChipValues('created', ['2024-03-01','2024-03-31']). The plan never says what two values now mean: is the second dropped, refused or reported? It also gives no API for the port to set a Between row instead.
- **missing:** The TODO 373 work is still uncommitted (sherpa-data-grid.ts, sherpa-menu.ts, the TRAPS and weight baseline). The plan's grid and menu line numbers are from the working tree, not HEAD: #onCellFilter :1376 exists only in the working tree, and data-commit-fixed is read at :1241, not :1240. The html is also off: .body-range is at :148-152, not :141-151, and condition-row-tpl at :339-366. Commit 373 before commit 1.
- **missing:** reforged-menu-calendar.spec.ts:515 and :638 (date chip footers) and :72 (the header button group) build plain {kind:'date'} chips. These chips become filter-template menus in commit 3, with the f(x) button in the header and a different footer template. They are not listed for checking or porting.
- **missing:** The planned 'reports once' unit test is order-dependent. A module-level dedupe Set in fieldState lives for the whole node:test process, so the field must be unique per test or the Set must be resettable.
- **missing:** DATA-SOURCE-RULES server note: Postgres EXTRACT(ISODOW) on a timestamptz uses the session time zone, not 'the day as written'. The note must say a server must read the stored text or local date to agree.

## The map

**Ops:** FILTER OPS TODAY (src/core/data/store.ts:65-71): eq, ne, lt, lte, gt, gte, contains, notcontains, startswith, endswith, in, notin, between, last, next. There is NO nbetween/notbetween and NO ncontains: the grammar spells a negation with a `not` prefix (notcontains, notin), so a new one by that pattern would be `notbetween`. No weekday/dow op exists anywhere (src, test, mcp-server, docs, Demos, Starter, Gallery: zero hits).

WHAT ADVANCED OFFERS (OPS_FOR_TYPE, store.ts:101-106; written into the menu's data-conditions by filter-menu.ts:124-129 / :144-149, and only when the field opts in with advanced:true):
- number: eq ne gt gte lt lte. Between is NOT offered today. A Simple range carries over to Advanced as `gte` AND `lte` rows (filter-state.ts:293), not as a between row.
- date: eq(On) lt(Before) gt(After) between last next (DATE_OP_LABELS store.ts:93). No contains, notcontains, ne, lte or gte.
- text: eq ne contains notcontains startswith endswith.

OP_TAKES (store.ts:114-132): between='range', contains/notcontains='text', last/next='text'. In the menu, #takes (sherpa-menu.ts:695-698) overrides for bodies. A date gives 'duration' (last/next), 'dates' (between: date + date-to boxes) or 'date' (everything else, so a date contains would show a date box). A number is always 'text' via #typesItsPicks (:703), one typed box, so a number Between row has no second box in the row template (sherpa-menu.html:334-359).

HOW A CLAUSE COMPILES (DOM-free, one path). fieldState (filter-state.ts:308-387) makes rows. Simple: `range = reading.range ?? (isRanged(type) && !facts.values?.length)` (:314), so a number or date with no list reads 2 picks as ENDS → [{op:'between'}] (:366-369). Advanced = the reading's answered rows. chainRows → rowClause (:465-490):
- last/next stay relative: [f, 'last', {n, unit}].
- On a `time` field: one day (eq) becomes ['between', [day, day+'T23:59:59.999']], gt becomes [gt, end of day], and between becomes [from, endOf(to)].
- text-takers are cast (numbers to Number).
- 'range' goes to rangeClause (:440-455): numbers sorted numerically, dates sorted as strings, giving ['f','between',[lo,hi]].
- lists go to picksClause: eq/in, ne/notin (store.ts:518-527).

store filterRows/matchesFilter (store.ts:383-430, :529):
- between orders a backwards pair and is inclusive at both ends, through compareValues.
- contains/notcontains are a lower-case SUBSTRING on valueKey, so a date `contains` today would substring-match the ISO text.
- There is no default case: an unknown op matches NO row. That is why mcp-server/tools/data.js:293-297 whitelists ops.
- filterNeedles (store.ts:359) marks contains/startswith/endswith in grid cells, so a reused `contains` on a date would be marked as a needle.
- Because a clause carries no field type, a weekday test cannot reuse `contains` safely in matchesFilter or on a server. It needs its own op, or a value shape the matcher can recognise.

HOW A SERVER READS IT:
- A filter is JSON [field, op, value]. RestStore.load sends absoluteDates(filter) (stores.ts:302-306); only last/next are rewritten, to between with END_OF_DAY. defaultQuery puts it in `filter=` as JSON (stores.ts:416-425), so any new op reaches the server as written. The server must learn it, and DATA-SOURCE-RULES.md:64-80 must list it. That doc says the ops are DevExtreme's names, and DevExtreme has neither notbetween (it negates with '!') nor a weekday op.
- IdbStore #rangeFor (idb-store.ts:309-360) narrows only eq/gt/gte/lt/lte/between on non-strings; any other op returns null and reads all, so new ops are safe there.
- A definition writes ops as `where` keys: where.ts clauseOf (:130-154) accepts any key in OP_TAKES. schemas/page.v1.json:132-150 has additionalProperties:false, so a new key must be added there.

HOW A DATE IS COMPARED:
- Dates are ISO strings (Demos: 'YYYY-MM-DD', records-data.js:83-84). compareValues (store.ts:297-307) compares Date objects by getTime and everything else with Intl.Collator {numeric, sensitivity base} over the text, so ISO order is text order.
- A day bound against a value with a time is made inclusive by END_OF_DAY 'T23:59:59.999' (store.ts:154; filter-state endOf :492-497), only on `time` fields and in absoluteDates.
- Zone: a DAY is read in UTC. durationSpan uses UTC (store.ts:140-150), formatDate parses and formats in UTC (format-date.ts:16-41), and the grid's cell chip takes the ISO day (toISOString for a Date). TRAP T-a-date-reads-one-way.
- For a weekday: temporal.ts plainDate(iso.slice(0,10)).dayOfWeek gives ISO Monday 1..Sunday 7 (temporal.ts:22,50,91-101). The stand-in accepts only 'YYYY-MM-DD', and Temporal.PlainDate.from rejects 'Z' strings, so slice first. Read in UTC to agree with the rest. temporal.ts has no DOM globals (eslint.config.js:56-70 bans only DOM globals in core/data), but it lives in core/ui and nothing in core/data imports it yet.
- Weekday words: Will's nine labels are fixed words, so they go in a menu `<template class="words">` (TRAP T-a-word-is-in-the-markup; the menu's words are at sherpa-menu.html:258-261 / :435-437). Intl weekday names are the platform alternative.

OPEN POINTS FOR WILL / THE PLANNER:
- The View's Date (app header) is a Simple range by TODO 20b: data-source.ts:789, FieldFilter.range, TRAP T-a-range-is-bounded-by-the-data, Demos 'Renewals' where-between. 375 contradicts it.
- Advanced is opt-in per field (filter-kind.ts:55, grid :727, panel :888). Fields without it lose any way to a range: Demos lastSeen and dashboard storage, Starter seats, Gallery seats and health, and grid number/date columns by default. So should every number and date offer Advanced?
- Should number fields also get contains / does not contain (Will's 'etc.')?
- The TODO says 'Simple picks a number's list', but a number has no value list (TRAP T-the-field-type-decides-the-clause): its Simple body is one typed field, plus cell-chip picks.
- Simple date: one day only, or several days as an `in` list? Today the calendar has only single and range types.

- NOTE ON LINE NUMBERS: all sherpa-ui lines are HEAD (efff91ca) EXCEPT src/components/sherpa-data-grid/sherpa-data-grid.ts and test/e2e/reforged-data-grid.spec.ts, which carry uncommitted TODO 373 work (and were being edited during this read). For those the WORKING-TREE line is given, with the HEAD line in brackets where it differs. docs/TODO.md already holds the 375 row (:59) and its section (:1476-1497), also uncommitted.
- == DATA LAYER (DOM-free) ==
- src/core/data/store.ts:65-71 FilterOp union: eq ne lt lte gt gte | contains notcontains startswith endswith | in notin | between | last next. No notbetween/nbetween and no ncontains: the grammar's negation is spelled with a `not` prefix (notcontains, notin). No weekday op.
- src/core/data/store.ts:74-90 OP_LABELS (between 'Between', notcontains 'Does not contain'); :93 DATE_OP_LABELS {eq On, lt Before, gt After}. A 'Not between' label and any date-specific Contains wording would go here.
- src/core/data/store.ts:101-106 OPS_FOR_TYPE: number = eq ne gt gte lt lte (NO between today); date = eq lt gt between last next (no contains/notcontains, no ne); text = eq ne contains notcontains startswith endswith. This is what Advanced offers (filter-menu.ts writes it into data-conditions).
- src/core/data/store.ts:114-132 OP_TAKES: between → 'range', contains/notcontains → 'text', last/next → 'text'. Every reader keys pick-or-type off this table (filter-state, where, filter-face, grid, menu, quick-filter).
- src/core/data/store.ts:140-150 durationSpan (UTC days); :154 END_OF_DAY 'T23:59:59.999'; :159-166 absoluteDates turns last/next into between (for RestStore and the walk).
- src/core/data/store.ts:297-307 compareValues: numbers numerically, Date by getTime, everything else Intl.Collator(numeric, sensitivity base) over valueKey. So ISO date strings compare as text.
- src/core/data/store.ts:358-381 filterNeedles: MARKABLE = contains, startswith, endswith (:359). A date clause that reused `contains` would be marked in grid cells as a substring needle.
- src/core/data/store.ts:383-430 matchesFilter: contains/notcontains = lower-case substring on valueKey (:406-409); between orders its bounds and is inclusive (:421-428); last/next via absoluteDates (:418-420). The switch has NO default, so an unknown op returns undefined and matches no row. notbetween and any weekday op need a case here.
- src/core/data/store.ts:518-527 picksClause: one pick eq, several in; ne → notin. :529-531 filterRows just applies matchesFilter.
- src/core/data/filter-state.ts:100-102 FilterState.range; :127-132 FieldType and isRanged(type) (number or date = picks are ENDS).
- src/core/data/filter-state.ts:180-193 FieldReading.range (the SLIDER gives two ends, a LIST gives two values) and FieldReading.kept (the answer of the shape not in force, for the Range switch; TRAP T-both-shapes-are-kept); :198-199 KeptAnswer type.
- src/core/data/filter-state.ts:281-300 rowsFromPicks(body, simple), the Simple→Advanced carry-over. A date with two picks becomes [{op:'between', picked:[a,b]}] (:286-288, Simple's two days mean Between). A number with range becomes gte AND lte rows, not a between row (:293). Otherwise one value under its op.
- src/core/data/filter-state.ts:308-387 fieldState. :314 `range = reading.range ?? (isRanged(type) && !facts.values?.length)`, so a number or date with no value list reads two picks as ENDS by default. That is why 373 sets range:false. :345-350 answered rule (range || !facts.values). :366-369 Simple rows = [{op: range && ends>=2 ? 'between' : op, picked: ends}]. :382 range on the state.
- src/core/data/filter-state.ts:415-422 savedReading: Simple saves `{picked, range:true}` when ranged.
- src/core/data/filter-state.ts:424-455 cast() and rangeClause(): numbers sorted as numbers, dates as strings; 2+ ends → ['f','between',[lo,hi]]; 1 end → [f, op, v].
- src/core/data/filter-state.ts:465-490 rowClause, the one place a row becomes a clause. last/next stay relative (:467-470). On a time field (:474-481), eq (one day) becomes between [day, day+END_OF_DAY], gt becomes end of day, and between becomes [from, endOf(to)]. takes 'text' casts (:482-485). takes 'range' goes to rangeClause (:487). A date contains row would fall to the 'text' branch today: wrong.
- src/core/data/filter-state.ts:492-497 endOf (day → END_OF_DAY, minute → :59.999); :499-517 ROW_OPS (in→eq, notin→ne) and leafRow; :526-544 clauseConditions (clause → rows: grid setColumnFilter, where.ts).
- src/core/data/filter-state.ts:228-234 rowAnswered (text vs picked by OP_TAKES), :219-226 rowOffer, :262-273 readingRows, :277-279 modeOf.
- src/core/data/query.ts:165-168 READING_KEYS lists `range` and `kept` (Record<keyof FieldReading>, so dropping the fields is a type error until this is edited); :172-176 answerOf; :181-187 readingAnswered counts `kept` (:185-186, TRAP T-both-shapes-are-kept); :107-111 withoutDropped.
- src/core/data/where.ts:21-32 Condition type keyed by FilterOp; :91-103 rowReading. `between` becomes `{picked, range:true}` (:95), a Simple range. Several values on a number or date become `range:false` (:100-101). :130-154 clauseOf accepts any key in OP_TAKES, so a new op is accepted once it is in OP_TAKES. This is how a View's `where: {created:{between:[…]}}` is read.
- src/core/data/source-counts.ts:89 plainPicks doc ('Simple, no range, the default op'); :164 each picked value counted with `{picked:[value], range:false}`.
- src/core/data/data-source.ts:788-789 describe(VIEW) marks a date field `range: true` (Will, TODO 20b: the View's date is a RANGE; TRAP T-a-range-is-bounded-by-the-data). This is the app header's Date chip, a SIMPLE two-day range, and it conflicts directly with 375. :2008-2011 plainPicks walk test `state.mode==='simple' && !state.range && op===DEFAULT_OP`. :1121-1136 select(field, picked, reading) (tests pass {range}).
- src/core/data/data-source-types.ts:77-78 FieldFilter.range ('picks are ENDS from the start, the View's date'); FieldDeclaration (:41-65) has no range.
- src/data.ts:195 exports isRanged publicly (dropping it removes public API; no alias, per T-a-rename-drops-the-old-name).
- src/core/data/filter-face.ts:58-109 filterFace. :73-79 `ends = !typed && state.range && picks.length===2` gives span 'a to b' (number) or formatDate(a,b) (date) on a chip face. :123-126 opName uses DATE_OP_LABELS. :143-155 spellConditions. :170-188 conditionLines: a between row reads 'a and b' (:183). New ops (Not between, weekday) need words here.
- src/core/data/format-date.ts:16-41 partsOf/formatDate read a day in UTC (TRAP T-a-date-reads-one-way).
- src/core/browser/idb-store.ts:309-360 #rangeFor narrows eq/gt/gte/lt/lte/between on NON-string values only. Any other op falls to default null (read all; matchesFilter answers), so new ops are safe here.
- src/core/data/stores.ts:302-306 RestStore.load sends absoluteDates(filter); :416-425 defaultQuery puts the filter in `filter=` as JSON, so a new op reaches the server as written.
- src/core/ui/temporal.ts:22,50 PlainDateLike.dayOfWeek (ISO Mon 1..Sun 7); :91-101 plainDate (the stand-in accepts only 'YYYY-MM-DD'; Temporal.PlainDate.from rejects a 'Z' string), so slice the ISO day first; :108 today(). No DOM globals, but it sits in core/ui; core/data does not import it today. Only consumer of dayOfWeek: sherpa-calendar.ts:281.
- == MENU (the bodies, the switch, the rows) ==
- src/core/ui/filter-menu.ts:23-27 imports sherpa-calendar, sherpa-slider and sherpa-switch for the bodies (slider and switch exist only for the Range body; check:weight baseline scripts/weight-baseline.json:292,307). :44 FilterMenuDef.range. :88-104 `asRange = def.range ?? kind==='number'` feeds the defers/commit rule (:100) and data-commit-fixed (:104). :114-130 number body: data-range (:118), data-min/max/step. Advanced (data-type filter, data-advanced, data-conditions=OPS_FOR_TYPE.number) ONLY when advancedOf(def)===true (:124-129). :132-150 date body: data-range only if def.range (:138); Advanced only when advancedOf===true (:144-149).
- src/core/ui/filter-kind.ts:55-57 advancedOf: opt-in, default false. :77-79 hasOwnBody(number|date|advanced). With the Range switch gone, Between is reachable only where Advanced is offered.
- src/core/ui/filter-def.ts:46-48 kind doc cites TRAP T-number-and-date-lead-with-a-range-switch; :55 min/max ('slider ends and field clamp'); :61-62 FilterDef.range ('Start in RANGE mode').
- src/core/ui/filters-button.ts:46 DRILL_FLAGS includes 'data-range'; :302 'a flag changed inside the drill — the Range switch — goes home'.
- src/core/ui/saved-filter-menu.ts:47 stops 'menu-range-change' among the menu events.
- src/components/sherpa-menu/sherpa-menu.html:111 Fires: menu-range-change. :141-151 default template .body-range with <sherpa-switch class="body-range-switch" aria-label="Range"> and the fixed word 'Range' in .body-range-label. :154-169 .body-number with .body-op select, .body-number-one, and <sherpa-slider class="body-number-range" data-type="range">. :174-176 menu-calendar-tpl. :258-261 words template (menu, select). The filter template repeats all of it at :311-323. Condition row template :334-359: one .condition-value (number rows type into it); a date has .condition-date/.condition-time/-to/.condition-count/.condition-unit; .condition-pick select (where a weekday select could ride). Words at :435-437.
- src/components/sherpa-menu/sherpa-menu.ts:35-36 SherpaSlider/SherpaSwitch types; :81-82 DATE_UNITS; :100-102 data-mode; :103-105 data-advanced; :114 data-body; :121-126 data-min/max/step (also clamp the one-value field); :127-130 data-from/data-to (a HELD range's ends; read only at :1576-1577); :133-137 data-commit-fixed; :141-142 data-range.
- src/components/sherpa-menu/sherpa-menu.ts:215-217 wires .body-range-switch; :232 'range-select' is a draft event; :334-339 #onBodyOp.
- src/components/sherpa-menu/sherpa-menu.ts:346-363 #onRangeSwitch: sets data-range, moves data-commit, flips the calendar data-type range/single, emits menu-range-change and change (TRAP T-range-switch-swaps-not-rebuilds).
- src/components/sherpa-menu/sherpa-menu.ts:366-385 #onModeSwitch (the f(x) inside a chip's menu); :391-400 #seedFromPicks calls rowsFromPicks(body, #bodyReading()); :406-408 #followPicks.
- src/components/sherpa-menu/sherpa-menu.ts:415-436 get reading (a number or date offering Advanced = body reading + rows + mode); :442-456 #bodyReading: date {picked, range: data-range}; number keeps BOTH shapes, one value and ends, with `kept`; :460-466 #oneAnswer; :470-473 #endsAnswer (slider data-touched).
- src/components/sherpa-menu/sherpa-menu.ts:475-532 set reading. The number branch (:481-503) derives range from next.range/picks count, draws `kept`, #setShape, #setNumberBody. The date branch (:506-515) sets values.
- src/components/sherpa-menu/sherpa-menu.ts:593-644 #fillRow (ops labelled with DATE_OP_LABELS on a date, :608-613); :646-660 #fillDateRow (between fills date and date-to, :654); :663-676 #dateRowAnswer (between needs both ends, :668-671; eq is a pick; others are text).
- src/components/sherpa-menu/sherpa-menu.ts:679-705 #numeric/#dated/#typedBody/#takes: a date is 'duration' | 'dates' (between) | 'date' (everything else, so contains would show a date box). A number is always 'text' via #typesItsPicks (:703-705), so a number Between row has no second box today. :708-715 #opList reads data-conditions.
- src/components/sherpa-menu/sherpa-menu.ts:757-790 get conditions (date rows via #dateRowAnswer; number rows typed); :803-840 #setRows.
- src/components/sherpa-menu/sherpa-menu.ts:1157-1169 get values; :1171-1183 #numericValues (data-range → slider ends); :1189-1221 #setBodyValues (two values = range shape for number AND date; sets the calendar data-type range); :1224-1228 #setShape (data-range and data-commit); :1232-1246 #setNumberBody (slider ends and data-touched); :1249-1258 #calendarValues (a range calendar reports both ends).
- src/components/sherpa-menu/sherpa-menu.ts:1530-1590 #syncBody: checks .body-range-switch from data-range (:1533), sets the calendar data-type range (:1542), draws the .body-op ops (non-filter menus only), applies min/max/step to field and slider, seeds the slider from data-from/to or its bounds (:1573-1585). :1617-1621 #syncReadonly inerts .body-range.
- src/components/sherpa-menu/sherpa-menu.ts:1946-1952 #onBodyChange (.body-number-range); :2026-2050 #onClear resets sliders and #setNumberBody('', []) (TRAP T-clear-empties-both-body-shapes, T-a-number-is-reset-not-cleared).
- src/components/sherpa-menu/sherpa-menu.css:82-83 comment ('its range switch and slider'); :244-266 per-takes visibility for date row boxes (a weekday takes needs rules here and in the data-only/readonly variants); :569 comment; :596-606 .body-range shown for number and date; :617-621 one end or two by data-range; :623-626 .body-range-label; :630-641 .body-op rules, including `[data-range] .body-op` (:634) and hiding .body-range in Advanced (:640-641).
- == CHIP / TOOLBAR / PANEL / GRID ==
- src/components/sherpa-quick-filter/sherpa-quick-filter.ts:128 hears range-select; :340-363 set reading: the number branch takes the whole reading (both shapes, TRAP T-both-shapes-are-kept :344), the date branch counts days; :877-879 #onDated; :893-927 #state: a number or filter menu passes menu.reading; a date passes `range: data-range` (:923-924).
- src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html:10-11 doc ('number/date lead with a Range switch'); :47-49 data-remote ('multi-select or range menu waits for Apply'); :209-212 comment ('The Range switch above it IS the menu's').
- src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts:247,328 range-select → #onDatePicked; :685-688 #chipPicks ('it knows its body and its Range shape'); :763-767 a date chip gets data-full-value.
- src/components/sherpa-filter-panel/sherpa-filter-panel.ts:351-364 #readingOf: number = menu.reading; :384-424 setFieldReading number branch (:413-414); :888 data-advanced-ok only when advancedOf(def)===true (the f(x) chip of TODO 372 is .field-advanced, html :185); :927-934 an inline body for number and date; :989-998 #fill skips unless `state.range == null && !state.kept` (:991-992); :1488-1513 #flipCondition (a number carries its own body over).
- src/components/sherpa-filter-panel/sherpa-filter-panel.css:200-216 DEAD rules for .qf-number-range, .qf-number-one and .qf-range-row (no element has these classes since the menu took its bodies; the only other mention is a comment at sherpa-menu.html:145). Delete them with 375.
- src/components/sherpa-filter-panel/sherpa-filter-panel.html:193-195 comment ('a number or a range is answered by the field's own menu body').
- src/components/sherpa-data-grid/sherpa-data-grid.ts:47-52 READING_OPS maps between → DEFAULT_OP (a between clause is read back as Simple picks).
- src/components/sherpa-data-grid/sherpa-data-grid.ts:573-579 [HEAD 566-572] #cellKey keys a heading on `range: def.range ?? kind==='number'`.
- src/components/sherpa-data-grid/sherpa-data-grid.ts:681-684 a number heading gets data-min/max; :692-695 data-advanced only when held rows exist or advancedOf(def).
- src/components/sherpa-data-grid/sherpa-data-grid.ts:717-743 [HEAD 710-736] #filterDef. A number/date column is advanced only if col.advanced (:727, a text column defaults to true). Slider ends come from real values (:730-736, TRAP T-grid-slider-spans-real-values). A HELD shape wins `range: !!held.range` (:741).
- src/components/sherpa-data-grid/sherpa-data-grid.ts:869-891 [HEAD ~858-880] #reportColumn: a column-filter-change detail with from/to taken from a between lead (:876).
- src/components/sherpa-data-grid/sherpa-data-grid.ts:899-906 [HEAD 888-895] #readColumnFilter: a date range with fewer than 2 ends is unfinished (:904).
- src/components/sherpa-data-grid/sherpa-data-grid.ts:931-945 [HEAD 920-934] #columnFilterLabel: 'Between: a - b' (:941).
- src/components/sherpa-data-grid/sherpa-data-grid.ts:966-992 [HEAD 955-981] #readingFromClause: between becomes `{picked:[from,to], range:true}` (:982-985); everything else `range:false` (:989-991). After 375 a between clause must become an Advanced row, as `where.ts` must.
- src/components/sherpa-data-grid/sherpa-data-grid.ts (373, working tree only): :1348 #cellValue comment ('one day is On, two would be Between'); :1371-1398 #onCellFilter: a date replaces (`one = kind==='date'`, :1387); Simple sets `range: false` on a number (:1389).
- == DOCS ==
- docs/TODO.md:59 (row 375) and :1476-1497 (section, already written: 'What goes: the Range switch, FieldReading.range and kept…; old stored range:true read once as a Between row; the cell chip stops setting range:false'). Related done rows: :88 (131), :89 (132), :156 (90), :158 (21d), :172 (20b, the View date RANGE: conflicts with 375).
- docs/TRAPS.md traps to retire or rewrite: T-both-shapes-are-kept :1155; T-range-switch-swaps-not-rebuilds :2516; T-number-and-date-lead-with-a-range-switch :8180; T-a-full-range-is-still-a-range :12737; T-clear-empties-both-body-shapes :5881; T-a-number-is-reset-not-cleared :2170; T-grid-slider-spans-real-values :4358; T-a-range-is-bounded-by-the-data :1617 (View date; the calendar half stays). To amend: T-the-field-type-decides-the-clause :12086 ('two picks are a range'); T-a-mode-switch-carries-the-answer-over :10853; T-a-number-has-advanced-rows :10715; T-one-number-is-a-pick-under-equals :2434 (mentions range:false); T-commit-follows-select-mode :694 (Range switch moves commit); T-a-number-waits-for-apply :2189; T-ops-follow-the-column-type :3388; T-an-operator-decides-pick-or-type :5791; T-a-held-clause-op-is-not-a-reading-op :15125; T-drill-flags-travel-and-replace :807; T-a-filter-menu-has-two-modes :10688; T-conditions-are-opt-in-per-field :10752; T-a-panel-date-answers-with-its-days :1131.
- docs/TRAPS-INDEX.md:56,96,402,432,499,511,547,553,563,584,668,880,890 index rows for those traps.
- docs/DATA-SOURCE-RULES.md:64-72 op table (no notbetween, no weekday); :74-80 last/next and 'DevExtreme's names' (DevExtreme has neither notbetween nor a weekday op); :86-98 the where-form table (`{between:[10,60]}`).
- docs/components/sherpa-menu.md:53 data-range, :113 menu-range-change, :129 part body-range, :155-156 .body-range-label tokens. Generated: regenerate the spec, then `npm run reference` and `npm run manifest` (custom-elements.json, vscode.html-data.json).
- docs/components/sherpa-quick-filter-toolbar.md:70 data-remote 'range menu' (generated from toolbar html :47-49).
- schemas/page.v1.json:132-150 condition (additionalProperties:false): between :142, contains/notcontains typed as string :139. A new op key (notbetween, a weekday op) must be added, or page validation rejects it.
- == MCP ==
- mcp-server/tools/data.js:257 run_query filter description lists ops; :293-297 the OPS whitelist: eq ne lt lte gt gte contains notcontains startswith endswith in notin between. It already lacks last/next. Any new op must be added or run_query reports it as bad.
- == SIBLINGS ==
- ../Sherpa Demos/app/view-schemas/records.json:21-25 seats/spend/openTickets/health number advanced:true; :32 created date advanced:true; :33 lastSeen date with NO advanced (no way to Between once the switch goes); :35 the View holds created (the app header Date chip, range:true via data-source.ts:789).
- ../Sherpa Demos/app/views/records-views.json:46 'Renewals this quarter' View: where created {between:[2024-07-01, 2024-09-30]}. where.ts:95 reads it as a Simple {picked, range:true}.
- ../Sherpa Demos/app/view-schemas/dashboard.json:16-17 storage number (min/max, no advanced).
- ../Sherpa Starter/template/view-schemas/records.json:12 seats number (no advanced); :19 saved filter where seats {gte:50}.
- ../Sherpa Gallery/lib/fake-data.js:49-50 seats/health number (no advanced); stories/sherpa-menu.stories.js:9 variantsStory data-body draws the number body (Range switch and slider).
- Persisted readings that carry range/kept (old stored data the TODO says is read once as Between): session Query (provider-page.ts:415-420), view drafts (src/core/browser/view-drafts.ts:53-55), saved filters (src/core/browser/saved-filters.ts), saved Views (src/core/browser/persist-view.ts). All of them reach fieldState/readingRows in filter-state.ts, the single place to convert.

**Tests to port:**

- sherpa-ui test/unit/both-shapes-are-kept.test.mjs:28-56: all 3 tests write `range` + `kept` (whole file is the kept-shape rule)
- sherpa-ui test/unit/field-type.test.mjs:41 'two picks on a NUMBER are a range', :58 'two picks on a DATE are a range', :69 'a range field needs no declared value list', :78 'a number answered from a LIST is `in`' (range:false :83), :90 'a ranged reading still says between' (range:true :93-95)
- sherpa-ui test/unit/one-condition-system.test.mjs:50-55 'a dragged RANGE is the field's own body answering — default, and `between`' (Simple between, condition 'simple')
- sherpa-ui test/unit/filter-face.test.mjs:19-33 number range:true/false faces, :39-46 'a date reads as a day, and two as a span' (range:true), :80 conditionLines range:true → 'Between 37 and 120'
- sherpa-ui test/unit/one-way-to-write-a-condition.test.mjs:16-35 created {picked:[2],range:true} round-trips as between (:22); :63-68 'two values on a number field are a LIST, not two ends' (range false/true)
- sherpa-ui test/unit/page-definition.test.mjs:189 seats {picked:['5','9'], range:true}; :276-289 'the View's date is a RANGE; a component's date stays one day' (describe('view') created.range true)
- sherpa-ui test/unit/a-saved-filter-is-its-readings.test.mjs:46-64 savedReading of a range → {picked:[10,50], range:true} (:57-58)
- sherpa-ui test/unit/one-query-builder.test.mjs:45-58 quick-filter-change readings seats {picked:['5','50'], range:true}; asserts selection('seats').range (:50-54)
- sherpa-ui test/unit/a-live-filter-waits-for-the-moves-to-stop.test.mjs:30 `source.select('seats',[0,n],{range:true})` (used by :32 and :48)
- sherpa-ui test/unit/a-chip-counts-within-the-filters-before-it.test.mjs:62,82 seats {picked:['5'], range:false}
- sherpa-ui test/unit/filters-limit-in-order.test.mjs:33 plainPicks fake reads `!r.range`
- sherpa-ui test/unit/date-conditions.test.mjs:29-62 between clauses for date rows (Advanced between — kept, but the file is where weekday/notbetween clause tests would join)
- sherpa-ui test/e2e/reforged-number-filter-reports.spec.ts: :20 'a toolbar number chip sends a drag or a typed number on Apply' (range:true def :23, slider :33, switch :62); :82 live source drags slider (:85-96); :127 'a panel number field reports a dragged handle' (:133-156, toggles data-range :156); :165 'a bound source filters by a typed number, and by a dragged range' (data-range :211-214); :227-306 '${host}: the Range switch is reported, and each shape keeps what it held' (switch, kept, declareField range:false :249); :318-361 'a number menu has Reset' (slider data-touched, setChipReading range+kept :340, reading.kept :361)
- sherpa-ui test/e2e/reforged-quick-filter-toolbar.spec.ts: :1233 'a NUMBER chip flips between a single field and a two-ended slider' (range:false :1236-1242, slider/switch :1255-1308); :1328 'a DATE chip carries the Range switch as a full-width row above its calendar'; :1394 'the Range switch brings Apply/Cancel on a remote source, and leads its own label' (range:false defs :1438-1455); :1690 'a DATE chip names its whole range' (kind date range:true :1693, range-select :1710)
- sherpa-ui test/e2e/reforged-chip-tips.spec.ts: :16 'a toolbar chip says a number, a range and a date' (range:true defs/readings :20,29-30, range:false :43); :84 panel date chip range (:91,:97); :159 'a RESET leaves a date chip with no value — a kept range holds no ends' (:162-188 data-range); :194 'a chip reads, draws and empties its own answer' (range:true :199,212-213)
- sherpa-ui test/e2e/reforged-data-grid.spec.ts (working tree): :1240 TEXT heading (asserts number heading 'leads with the Range switch' :1297-1331); :1544 'a NUMBER column filters by one value, an Advanced condition, or a RANGE' (switch :1590-1619, data-range :1624, slider :1628-1647, kept :1631/1668, between :1675); :1679 'a DATE column filters with a calendar, one day or a span' (.body-range :1715, switch :1736, range-select :1745, between :1767); :2059 setColumnFilter between round trip (:2109-2138); :2729 'a number column with BLANKS bounds its slider' (:2749); :2767 fx mark (between :2801); :3182 [373, uncommitted] 'a date filters by one DAY, and a number by values, not a range' (expects {picked:[5], mode:'simple', range:false} :3193)
- sherpa-ui test/e2e/reforged-advanced-condition-words.spec.ts:134-147 setColumnFilter('spend', between [10,20]) expected condition 'simple', icon null ('A range is … a SIMPLE condition')
- sherpa-ui test/e2e/reforged-number-advanced.spec.ts: :17 toolbar number goes Advanced (setChipReading range:true :29, expects mode advanced + range:true :66); :73 bound source filters by Advanced rows (Simple range:true reading :105); :111 panel number f(x) carries its number (range:false :122)
- sherpa-ui test/e2e/reforged-date-conditions.spec.ts:21 date Advanced rows (between row :18); :61 'the switch to Advanced carries the calendar's day over as On' (rowsFromPicks date)
- sherpa-ui test/e2e/reforged-advanced-rows.spec.ts:44-52 'date:between' and time between expectations (test :57)
- sherpa-ui test/e2e/reforged-a-calendar-pick-wakes-the-footer.spec.ts:15-18 date def with `range: false`
- sherpa-ui test/e2e/reforged-menu-calendar.spec.ts:822-826 a range calendar inside a sherpa-menu (calendar data-type range set directly; survives if the calendar keeps its range type)
- sherpa-ui test/e2e/reforged-calendar.spec.ts:540-555 'in range mode, data-available bounds the span' (TRAP T-a-range-is-bounded-by-the-data; calendar component, not the menu)
- sherpa-ui test/e2e/reforged-data-source.spec.ts:66-68 and reforged-idb-store.spec.ts:109-140 store-level ['between'] clauses (unchanged unless the op grammar changes; where notbetween/weekday store tests would go)
- ../Sherpa Demos/test/e2e/reforged-filter-coordination.spec.ts:23 'a toolbar, the header, the panel and a grid heading all show what the Query holds' (range in its reading normaliser :54, .body-number-range :138-143, .body-range-switch click :150, header Date range-select :178-189, expects panelSeats {picked:['12'], range:false, kept:{picked:['60','120']}} :236)
- ../Sherpa Demos/test/e2e/reforged-calendar.spec.ts:8-29 'on Records, the View's Date opens as a range over the span of the data' (menu data-range + calendar range)
- ../Sherpa Demos/test/e2e/reforged-records-persist.spec.ts:229-255 'the header Date survives a reload, and its chip shows the range' (setChipValues('created',[2 days]) → 'on:01 to 31 Mar 2024')
- ../Sherpa Demos/test/e2e/reforged-date-conditions.spec.ts:14 'the View's date takes a Before row' (View date Advanced)
- ../Sherpa Demos/test/e2e/reforged-nav-view-hierarchy.spec.ts:125 and reforged-view-drafts.spec.ts:59 open the 'renewals' View (where created between, read as a Simple range)
- MCP: no test sets range/kept/slider; mcp-server/tools/data.js run_query OPS whitelist (:296-297) is exercised by `npm run check:mcp-pack`
