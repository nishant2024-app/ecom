import { useEffect, useRef } from 'react';
import {
  EditModule,
  FilterModule,
  FormatModule,
  InteractionModule,
  KeybindingsModule,
  PageModule,
  ResizeColumnsModule,
  ResponsiveLayoutModule,
  SelectRowModule,
  SortModule,
  Tabulator,
  type ColumnDefinition,
} from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import './datatable.css';

Tabulator.registerModule([EditModule, FormatModule, SortModule, PageModule, SelectRowModule, InteractionModule, KeybindingsModule, FilterModule, ResizeColumnsModule, ResponsiveLayoutModule]);

interface Props<T extends { id: string }> {
  /** Accessible name of the table, read out by screen readers. */
  label: string;
  data: T[];
  /** Read once when the table is created: keep it stable (useMemo) and reach changing state through refs. */
  columns: ColumnDefinition[];
  /** Clicking anywhere on a row (not on a button or link inside it). Keep a real link or button in the row too, for keyboards. */
  onRowClick?: (row: T) => void;
  /** Adds a checkbox column. */
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  initialSort?: { column: string; dir: 'asc' | 'desc' }[];
  pageSize?: number;
  /** Shown when there are no rows. */
  placeholder?: string;
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/**
 * A Tabulator grid styled with the admin's design tokens (light and dark). Sorting, paging and column
 * resizing come from Tabulator; the page keeps owning the data, filters and actions.
 */
export function DataTable<T extends { id: string }>({
  label,
  data,
  columns,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
  initialSort,
  pageSize = 25,
  placeholder = 'Nothing to show.',
}: Props<T>) {
  const host = useRef<HTMLDivElement>(null);
  const pager = useRef<HTMLDivElement>(null);
  const table = useRef<Tabulator | null>(null);
  const built = useRef(false);
  const latest = useRef({ data, onRowClick, onSelectionChange, selectedIds });
  latest.current = { data, onRowClick, onSelectionChange, selectedIds };
  const syncing = useRef(false);

  useEffect(() => {
    if (!host.current || !pager.current) return;
    const cols: ColumnDefinition[] = selectable
      ? [
          {
            title: '',
            formatter: 'rowSelection',
            titleFormatter: 'rowSelection',
            titleFormatterParams: { rowRange: 'active' },
            hozAlign: 'center',
            headerSort: false,
            resizable: false,
            width: 44,
            minWidth: 44,
            cssClass: 'dt-select',
            cellClick: (_e, cell) => cell.getRow().toggleSelect(),
          },
          ...columns,
        ]
      : columns;
    const pagerEl = pager.current;
    const t = new Tabulator(host.current, {
      data: latest.current.data.map((d) => ({ ...d })),
      index: 'id',
      columns: cols,
      layout: 'fitColumns',
      // Narrow screens hide the lower-priority columns (column option `responsive`: higher number goes first) instead of scrolling sideways.
      responsiveLayout: 'hide',
      renderVertical: 'basic',
      placeholder,
      pagination: true,
      paginationElement: pagerEl,
      paginationSize: pageSize,
      paginationButtonCount: 5,
      selectableRows: selectable ? true : false,
      selectableRowsPersistence: false,
      initialSort,
      columnDefaults: { headerSortTristate: false, resizable: true },
    });
    table.current = t;
    built.current = false;
    // The pager is only useful when there is more than one page.
    const syncPager = () => {
      if (pager.current) pager.current.hidden = t.getDataCount('active') <= pageSize;
    };
    t.on('dataProcessed', syncPager);
    t.on('tableBuilt', () => {
      built.current = true;
      syncPager();
      // Nothing scrolls sideways (see responsiveLayout), so the scroll container does not need to be a tab stop.
      host.current?.querySelector('.tabulator-tableholder')?.removeAttribute('tabindex');
      const ids = latest.current.selectedIds;
      if (selectable && ids && ids.size) t.selectRow([...ids]);
    });
    t.on('rowClick', (e, row) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, label, .dt-select')) return;
      latest.current.onRowClick?.(row.getData() as T);
    });
    t.on('rowSelectionChanged', (rows) => {
      if (syncing.current) return;
      latest.current.onSelectionChange?.(new Set((rows as { id: string }[]).map((r) => r.id)));
    });
    return () => {
      built.current = false;
      t.destroy();
      pagerEl.replaceChildren(); // React may mount twice in development; never leave a second pager behind
      table.current = null;
    };
    // The table is created once per mount; data and selection are synced by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = table.current;
    if (!t) return;
    const rows = data.map((d) => ({ ...d }));
    if (built.current) void t.replaceData(rows);
    else t.on('tableBuilt', () => void t.replaceData(rows));
  }, [data]);

  useEffect(() => {
    const t = table.current;
    if (!t || !built.current || !selectable || !selectedIds) return;
    const current = new Set((t.getSelectedData() as { id: string }[]).map((r) => r.id));
    if (sameSet(current, selectedIds)) return;
    syncing.current = true;
    t.deselectRow();
    if (selectedIds.size) t.selectRow([...selectedIds]);
    syncing.current = false;
  }, [selectedIds, selectable]);

  return (
    <div className="dt" role="region" aria-label={label}>
      <div ref={host} aria-label={label} />
      <nav ref={pager} aria-label={`${label} pages`} className="dt-pager" />
    </div>
  );
}
