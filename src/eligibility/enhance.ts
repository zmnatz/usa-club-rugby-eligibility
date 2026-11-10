// The one script the screens use: sorting a table by a column, filtering the club
// directory, and downloading the exported report. It listens on `document`, so it works
// for markup that was rendered to static HTML or added later by React, and the host
// includes it once, at the end of <body>. Everything else (the status filter, the
// optional columns, the jump between sides) is plain HTML and CSS. A table is still a
// complete, readable table without it.

export const ENHANCEMENT_SCRIPT = `(() => {
  // Safe to include twice: the listeners are added once.
  if (window.__ecEnhanced) return;
  window.__ecEnhanced = true;
  const FIRST = 'first-player';

  // A column's header button sorts that table's rows by the cells' data-sort values.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target && target.closest('th button[data-sort]');
    if (button) {
      const th = button.closest('th');
      const table = th.closest('table');
      const body = table.querySelector('tbody');
      const index = [...th.parentElement.children].indexOf(th);
      const numeric = button.dataset.sort === 'number';
      const direction = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
      for (const other of table.querySelectorAll('th[aria-sort]')) other.removeAttribute('aria-sort');
      th.setAttribute('aria-sort', direction === 1 ? 'ascending' : 'descending');
      const value = (row) => row.children[index].dataset.sort ?? '';
      const rows = [...body.children].filter((row) => row.children[index] && row.dataset.groups !== undefined);
      rows.sort((a, b) => {
        const x = numeric ? Number(value(a)) : value(a);
        const y = numeric ? Number(value(b)) : value(b);
        return x === y ? 0 : (x < y ? -1 : 1) * direction;
      });
      body.querySelector('#' + FIRST)?.removeAttribute('id');
      body.append(...rows);
      if (rows[0]) { rows[0].id = FIRST; rows[0].tabIndex = -1; }
      return;
    }

    // Export Report: the text is in the page, so it is downloaded as it was written.
    const exporter = target && target.closest('button[data-export]');
    if (exporter) {
      const template = exporter.closest('[data-report]')?.querySelector('template[data-export-report]');
      if (!template) return;
      const url = URL.createObjectURL(new Blob([(template.content.textContent || template.textContent)], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = template.dataset.exportReport;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  });

  // The club directory's filter, by club or side name.
  const filter = (input) => {
    const root = input.closest('[data-club-directory]');
    if (!root) return;
    const term = input.value.trim().toLowerCase();
    const clubs = [...root.querySelectorAll('li[data-search]')];
    for (const club of clubs) club.hidden = !club.dataset.search.includes(term);
    const shown = clubs.filter((club) => !club.hidden).length;
    const count = root.querySelector('[data-club-count]');
    if (count) count.textContent = shown + ' of ' + clubs.length + ' clubs';
    const none = root.querySelector('[data-no-club]');
    if (none) none.hidden = shown > 0;
  };
  document.addEventListener('input', (event) => {
    if (event.target instanceof Element && event.target.matches('[data-club-filter]')) filter(event.target);
  });
  // Back and forward restore what was typed without an input event.
  addEventListener('pageshow', () => {
    for (const input of document.querySelectorAll('[data-club-filter]')) filter(input);
  });
})();`;
