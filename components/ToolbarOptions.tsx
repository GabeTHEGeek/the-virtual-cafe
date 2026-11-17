import { useEffect, useId, useRef, useState } from 'react';

export function ToolbarOptions<Value extends string>({label, value, options, onChange}: {
  label: string; value: Value; options: readonly {value: Value; label: string}[]; onChange: (value: Value) => void;
}) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  function position() {
    if (!anchor.current || !menu.current) return;
    const control = anchor.current.getBoundingClientRect();
    const panel = menu.current;
    const inset = 8;
    const gap = 6;
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + inset;
    const topEdge = (viewport?.offsetTop ?? 0) + inset;
    const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 2 * inset;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 2 * inset;
    const above = Math.max(0, control.top - topEdge - gap);
    const below = Math.max(0, bottomEdge - control.bottom - gap);

    panel.style.maxWidth = `${rightEdge - leftEdge}px`;
    const borders = panel.offsetHeight - panel.clientHeight;
    const opensUp = panel.scrollHeight + borders <= above || above >= below;
    panel.style.maxHeight = `${opensUp ? above : below}px`;
    const {width, height} = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(leftEdge, Math.min(control.left, rightEdge - width))}px`;
    panel.style.top = `${opensUp ? control.top - gap - height : control.bottom + gap}px`;
  }

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [open]);

  function close() {
    menu.current?.hidePopover();
    anchor.current?.focus();
  }

  return <>
    <button ref={anchor} type="button" className="toolbar-options-trigger"
      aria-label={label} aria-expanded={open} aria-controls={id} popoverTarget={id}>
      <span>{options.find(option => option.value === value)?.label}</span>
      <svg width="11" height="7" viewBox="0 0 11 7" fill="none" aria-hidden="true">
        <path d="M1 5.5 5.5 1 10 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    <div ref={menu} id={id} popover="auto" className="toolbar-options" role="group" aria-label={`${label} options`}
      onBeforeToggle={event => {
        if (event.newState === 'open') event.currentTarget.style.visibility = 'hidden';
      }} onToggle={event => {
        const opened = event.newState === 'open';
        if (opened) {
          position();
          event.currentTarget.style.visibility = '';
          menu.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({preventScroll: true});
        }
        setOpen(opened);
      }} onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}>
      {options.map(option => <button key={option.value} type="button" aria-pressed={option.value === value}
        onClick={() => {onChange(option.value); close();}}>{option.label}</button>)}
    </div>
  </>;
}
