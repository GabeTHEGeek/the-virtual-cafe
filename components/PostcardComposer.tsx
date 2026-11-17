import { useEffect, useId, useRef, useState } from 'react';
import { postcardHeight, postcardNoteLimit, postcardSources, postcardSvg, postcardWidth, type Postcard } from '../lib/postcards';

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


export function PostcardComposer({details, receipt, canShare, error, create, close}: {
  details: Omit<Postcard, 'note'>;
  receipt?: {requestId: string; path: string};
  canShare: boolean;
  error?: string;
  create: (requestId: string, note: string) => boolean;
  close: () => void;
}) {
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState('');
  const [layers, setLayers] = useState<string[]>();
  const [art, setArt] = useState('');
  const [requestId, setRequestId] = useState<string>();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const link = receipt && receipt.requestId === requestId ? new URL(receipt.path, window.location.origin).href : '';
  const pending = Boolean(requestId && !link && !error && canShare);
  const {time, animal, seatId, name} = details;

  useEffect(() => { dialog.current?.showModal(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLayers(undefined);
    void Promise.all(postcardSources({...details, note: ''}).map(async path => {
      const response = await fetch(path, {signal: controller.signal});
      if (!response.ok) throw new Error();
      return blobDataUrl(await response.blob());
    })).then(values => {
      if (!controller.signal.aborted) setLayers(values);
    }).catch(() => {
      if (!controller.signal.aborted) setMessage('Could not load the postcard artwork. Reopen the postcard to try again.');
    });
    return () => controller.abort();
  }, [time, animal, seatId]);

  useEffect(() => {
    if (!layers) {
      setArt('');
      return;
    }
    const url = URL.createObjectURL(new Blob([postcardSvg({...details, note: note.trim()}, layers)], {type: 'image/svg+xml'}));
    setArt(url);
    return () => URL.revokeObjectURL(url);
  }, [layers, time, animal, seatId, name, note]);

  async function download() {
    if (!art) return;
    setSaving(true);
    try {
      const image = new Image();
      image.src = art;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = postcardWidth;
      canvas.height = postcardHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error();
      context.drawImage(image, 0, 0);
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve));
      if (!png) throw new Error();
      const url = URL.createObjectURL(png);
      const file = document.createElement('a');
      file.href = url;
      file.download = 'virtual-cafe-postcard.png';
      file.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 20_000);
      setMessage('Postcard saved.');
    } catch {
      setMessage('Could not save the postcard. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({title: 'The Virtual Café postcard', url: link});
      } else {
        await navigator.clipboard.writeText(link);
        setMessage('Postcard link copied.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Select the link to copy it.');
    }
  }

  return <dialog ref={dialog} className="postcard-composer" aria-labelledby={title} onCancel={close} onKeyDown={event => {
    if (event.key === 'Escape') event.stopPropagation();
  }}>
    <header><h2 id={title}>Café postcard</h2><button type="button" aria-label="Close postcard" onClick={close}>×</button></header>
    {art && <img className="postcard-preview" src={art} alt="Your café postcard preview" width={postcardWidth} height={postcardHeight} />}
    <label htmlFor={`${title}-note`}>What did you finish today?</label>
    <textarea id={`${title}-note`} rows={2} value={note} maxLength={postcardNoteLimit} onChange={event => {
      setNote(event.target.value);
      setRequestId(undefined);
      setMessage('');
    }} />
    <div className="postcard-actions">
      <button type="button" onClick={() => void download()} disabled={!art || !note.trim() || saving}>Save PNG</button>
      {!link && <button type="button" disabled={!canShare || !note.trim() || pending} onClick={() => {
        const id = crypto.randomUUID();
        setMessage('');
        if (create(id, note.trim())) setRequestId(id);
      }}>{pending ? 'Creating link…' : 'Create public link'}</button>}
    </div>
    {link && <div className="postcard-share">
      <label htmlFor={`${title}-link`}>Anyone with this link can view your postcard.</label>
      <input id={`${title}-link`} readOnly value={link} onFocus={event => event.currentTarget.select()} />
      <button type="button" onClick={() => void share()}>{typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? 'Share link' : 'Copy link'}</button>
    </div>}
    {(error || message) && <p role="status">{error || message}</p>}
  </dialog>;
}
