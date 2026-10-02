Some things to address:

Conditional filters don't apply or go active at all for any field other than Owner.

I don't like the way that the conditional filter and reset buttons, in the filter panel, jump from the section content area to the section header on toggle of conditonal.

Let's have them always reside in the section header on the right side.

Align the buttons and the label with the bottom of the header row.

The header labels should be all caps and a lighter weight, like the metric titles. Be sure to use an existing CSS typography class.

The icon for the toggle to toolbar button, in the filter panel header, should be different. It should represent a toolbar rather than a sidebar. Perhaps for now we can use the 'fullscreen exit' icon.

Let's move the Customer and Region filters to the View scope in the filter panel.

The Apply & Discard buttons should be inactive unless there are changes to the filters to apply or discard.

The overflow ellipses menu button, in the filter toolbar, doesn't show the overflowed actions when clicked. The full list of menu items from the top, when all actions are overflowed, is:

- Suggest filters
- Reset filters
- Show Filter Panel
- (Menu Divider)
- Favorite
- Save view
- Save view as
- Refresh view

Column Header filter buttons don't show the selected values, or set conditions, in their menu. This allows me to apply filters that contradict that filter's already set conditions (at both view and component scope).

The 'Filtered by the App header' text in the toolbar chips should read 'Filter applied at higher scope'.

Preset Conditional filter chips should have a menu button, in the toolbar mode, to allow the user to view the conditions. Shows the menu with the condition input rows in read-only mode. This menu button is in the section header of the filter panel.

Custom Conditional filter chips (and panel sections) have the same menu button but it's menu content is editable. If this is a saved custom filter that has been applied then the edits are a temporary draft filter. The original saved filter is unaffected. The user should be able to save custom filter changes from the menu/section header if there are changes to save.

Prioritise these so that you do the easier, quick wins, first. Build after each fix is complete so that I can test on the running example app.