export function mentionText(name: string) {
  return '@' + (/^[\p{L}\p{N}_-]+$/u.test(name) ? name : JSON.stringify(name));
}

export function mentionsVisitor(body: string, name: string) {
  if (!name) return false;
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forms = [mentionText(name), '@' + name];
  return forms.some(form => new RegExp('(?:^|[^\\p{L}\\p{N}_@])' + escape(form) + '(?=$|[^\\p{L}\\p{N}_-])', 'iu').test(body));
}
