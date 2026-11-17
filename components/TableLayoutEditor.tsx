import { useRef, useState } from 'react';
import { defaultTables, placementFor, validTables, type TableLayouts, type TableSeatLayout } from '../lib/table-layout';
import { roomHeight, roomWidth } from '../lib/seats';

export function TableLayoutEditor({tables, onChange}: {tables: TableLayouts; onChange: (tables: TableLayouts) => void}) {
  const [seatId, setSeatId] = useState('shared-1');
  const [kind, setKind] = useState<keyof TableSeatLayout>('avatar');
  const [error, setError] = useState('');
  const drag = useRef<{x: number; y: number; px: number; py: number} | undefined>(undefined);
  const table = tables.find(table => table.seats[seatId])!;
  const point = table.seats[seatId][kind];
  function update(changes: Partial<typeof point>) {
    onChange(tables.map(item => item.id === table.id ? {...item, seats: {...item.seats,
      [seatId]: {...item.seats[seatId], [kind]: {...point, ...changes}}}} : item));
  }
  function exportLayout() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(tables, null, 2)], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cafe-tables.json';
    link.click();
    URL.revokeObjectURL(url);
  }
  return <>
    <aside className="table-editor" aria-label="Table layout editor">
      <strong>Coworking layout</strong>
      <p>Drag a point to place it. Changes save in this browser.</p>
      <label>Seat<select aria-label="Seat" value={seatId} onChange={event => setSeatId(event.target.value)}>
        {tables.map(table => <optgroup key={table.id} label={table.name}>{Object.keys(table.seats).map(id =>
          <option key={id}>{id}</option>)}</optgroup>)}
      </select></label>
      <label>Object<select aria-label="Object" value={kind} onChange={event => setKind(event.target.value as keyof TableSeatLayout)}>
        {['avatar', 'laptop', 'snack', 'drink'].map(kind => <option key={kind}>{kind}</option>)}
      </select></label>
      {(['x', 'y', 'scale', 'layer'] as const).map(field =>
        <label key={field}>{field}<input aria-label={`Placement ${field}`} type="number"
          step={field === 'scale' ? .05 : 1} min={field === 'scale' ? .2 : field === 'layer' ? 0 : -2000}
          max={field === 'scale' ? 3 : field === 'layer' ? 100 : 2000}
          value={point[field as keyof typeof point]} onChange={event => {
            const value = event.target.valueAsNumber;
            if (event.target.validity.valid && Number.isFinite(value)) update({[field]: value});
          }} /></label>)}
      <div className="table-editor-actions">
        <button type="button" onClick={exportLayout}>Export JSON</button>
        <label className="layout-import">Import JSON<input type="file" accept=".json,application/json" onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const value: unknown = JSON.parse(await file.text());
            if (!validTables(value)) throw new Error();
            onChange(value);
            setError('');
          } catch { setError('Choose a valid café table layout JSON file.'); }
          event.target.value = '';
        }} /></label>
        <button type="button" onClick={() => onChange(structuredClone(defaultTables))}>Reset layout</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </aside>
    {Object.keys(table.seats).flatMap(id => (['avatar', 'laptop', 'snack', 'drink'] as const).map(object => {
      const p = placementFor(tables, id, object)!;
      return <button key={id + object} type="button"
        className={`layout-point ${id === seatId && object === kind ? 'active' : ''}`}
        style={{left: `${p.x}%`, top: `${p.y}%`}}
        aria-label={`Place ${id} ${object}`}
        onPointerDown={event => {
          event.preventDefault();
          setSeatId(id);
          setKind(object);
          event.currentTarget.setPointerCapture(event.pointerId);
          const original = table.seats[id][object];
          drag.current = {x: original.x, y: original.y, px: event.clientX, py: event.clientY};
        }}
        onPointerMove={event => {
          if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
          update({x: Math.round(drag.current.x + (event.clientX - drag.current.px) / bounds.width * roomWidth),
            y: Math.round(drag.current.y + (event.clientY - drag.current.py) / bounds.height * roomHeight)});
        }}
        onPointerUp={() => {drag.current = undefined;}}
        onPointerCancel={() => {drag.current = undefined;}}
      >{object[0].toUpperCase()}</button>;
    }))}
  </>;
}
