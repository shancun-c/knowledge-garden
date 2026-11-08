export type ContentBlock =
  | { type: 'paragraph' | 'heading'; text: string }
  | { type: 'list'; ordered: boolean; start: number; items: string[] };

// A deliberately small display format: prose, headings and lists. No HTML,
// links or executable markup are interpreted; the original card stays intact.
export function parseCardContent(value: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];
  let list: Extract<ContentBlock, { type: 'list' }> | null = null;
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    if (list) blocks.push(list);
    paragraph = []; list = null;
  };
  for (const raw of value.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) { flush(); blocks.push({ type: 'heading', text: heading[1] }); continue; }
    const bullet = line.match(/^(?:[-*+•]\s+)(.+)$/);
    const ordered = line.match(/^(\d{1,3})(?:[.)]\s+|、\s*)(.+)$/);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      if (paragraph.length || (list && list.ordered !== isOrdered)) flush();
      if (!list) list = { type: 'list', ordered: isOrdered, start: ordered ? Number(ordered[1]) : 1, items: [] };
      list.items.push(bullet ? bullet[1] : ordered![2]);
    } else if (list) {
      list.items[list.items.length - 1] += `\n${line}`;
    } else paragraph.push(line);
  }
  flush();
  return blocks;
}

export function splitItemLabel(text: string) {
  // Only infer a short label at the beginning; never split URLs or long prose.
  const match = text.match(/^([^\n：:]{1,20})[：:](?!\/\/)[ \t]*([\s\S]+)$/);
  return match ? { label: match[1], body: match[2] } : null;
}

export function inlineTokens(text: string): { text: string; type: 'text' | 'strong' | 'code' | 'arrow' }[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|→)/g).filter(Boolean).map(part =>
    part === '→' ? { type: 'arrow', text: part } :
    part.startsWith('**') && part.endsWith('**') ? { type: 'strong', text: part.slice(2, -2) } :
    part.startsWith('`') && part.endsWith('`') ? { type: 'code', text: part.slice(1, -1) } :
    { type: 'text', text: part });
}
