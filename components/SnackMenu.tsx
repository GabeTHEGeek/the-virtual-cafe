import { useEffect, useRef, useState } from 'react';
import { drinkIds, drinks, snackIds, snacks, type CafeOrder } from '../lib/snacks';

export function SnackMenu({canOrder, recipient, recipients, setRecipient, error, onOrder, onClose}: {
  canOrder: boolean; recipient?: string; recipients: {id: string; name: string}[];
  setRecipient: (id?: string) => void; error?: string; onOrder: (order: CafeOrder) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [order, setOrder] = useState<CafeOrder>({});
  const {snack, drink} = order;
  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} className="snack-menu" aria-labelledby="barista-menu-title" onCancel={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      if (canOrder && (snack || drink)) onOrder(order);
    }}>
      <header>
        <h2 id="barista-menu-title">Barista menu</h2>
        <button type="button" aria-label="Close barista menu" onClick={onClose}>×</button>
      </header>
      <p>{canOrder ? 'Choose a complimentary snack, drink, or both.' : 'Take a seat to place an order.'}</p>
      {canOrder && (recipients.length > 0 || recipient) && <label className="snack-recipient">
        Deliver to
        <select value={recipient ?? ''} onChange={event => setRecipient(event.target.value || undefined)}>
          <option value="">My seat</option>
          {recipient && !recipients.some(person => person.id === recipient) && <option value={recipient}>Visitor unavailable</option>}
          {recipients.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>}
      {error && <p role="status">{error}</p>}
      <section aria-labelledby="barista-snacks">
        <h3 id="barista-snacks">Snacks</h3>
        <ul>{snackIds.map(item => <li key={item}><button type="button" disabled={!canOrder}
          aria-pressed={snack === item} onClick={() => setOrder(current => ({...current, snack: snack === item ? undefined : item}))}>
          <img src={`/art/snacks/${item}.webp`} alt="" /><span>{snacks[item]}</span>
        </button></li>)}</ul>
      </section>
      <section aria-labelledby="barista-drinks">
        <h3 id="barista-drinks">Drinks</h3>
        <ul>{drinkIds.map(item => <li key={item}><button type="button" disabled={!canOrder}
          aria-pressed={drink === item} onClick={() => setOrder(current => ({...current, drink: drink === item ? undefined : item}))}>
          <img src={`/art/drinks/${item}.webp`} alt="" /><span>{drinks[item]}</span>
        </button></li>)}</ul>
      </section>
      <footer>
        <span>{[snack && snacks[snack], drink && drinks[drink]].filter(Boolean).join(' + ')}</span>
        <button type="submit" disabled={!canOrder || !(snack || drink) || Boolean(recipient && !recipients.some(person => person.id === recipient))}>{recipient ? 'Send treat' : 'Order'}</button>
      </footer>
    </form>
  </dialog>;
}
