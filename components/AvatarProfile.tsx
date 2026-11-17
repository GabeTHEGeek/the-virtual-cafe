import { InterestTags } from './Interests';
import type { ReactNode } from 'react';
import type { Visitor } from '../lib/cafe';
import { zones, type Seat } from '../lib/seats';
import { Avatar, PresenceDot } from './Avatar';
import { Icon } from './Icon';

export function AvatarProfile({ visitor, seat, own, onClose, children }: {
  visitor: Visitor; seat: Seat; own: boolean; onClose: () => void; children?: ReactNode;
}) {
  return <section className="profile" aria-label={`${visitor.name}'s profile`}>
    <button className="icon-button profile-close" aria-label="Close profile" onClick={onClose}><Icon name="close" size={15} /></button>
    <div className="profile-header">
      <div className="profile-avatar"><Avatar animal={visitor.animal} portrait /></div>
      <div><strong>{visitor.name}{own ? ' (you)' : ''}</strong>
        <span className="profile-status"><PresenceDot presence={visitor.presence} />{visitor.presence}</span>
      </div>
    </div>
    <div className="profile-work"><span>WORKING ON</span><p>{visitor.work || '—'}</p></div>
    {visitor.bio && <p className="profile-detail">{visitor.bio}</p>}
    <InterestTags ids={visitor.interestIds} />
    <small>{zones[seat.zone]}</small>
    {children}
  </section>;
}
