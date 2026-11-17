import { Icon } from './Icon';

export function SeatSelector({ choosing, available, onToggle }: { choosing: boolean; available: number; onToggle: () => void }) {
  return <button type="button" className={`pill seat-selector ${choosing ? 'active' : ''}`}
    aria-pressed={choosing} onClick={onToggle} disabled={available === 0}>
    <Icon name={choosing ? 'close' : 'chair'} size={18} />
    {choosing ? 'Cancel move' : available ? 'Change seat' : 'Café is full'}
  </button>;
}
