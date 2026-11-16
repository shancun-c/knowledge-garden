export default function StarButton({starred,disabled,onToggle}:{starred:boolean;disabled:boolean;onToggle:()=>void}) {
  return <button type="button" className={`star-button${starred?' is-starred':''}`} aria-label={starred?'取消星标':'添加星标'} aria-pressed={starred} disabled={disabled} onClick={onToggle}>
    <span aria-hidden="true">{starred?'★':'☆'}</span>{starred?'已星标':'星标'}
  </button>;
}
