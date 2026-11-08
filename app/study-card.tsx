import type {ReactNode} from 'react';

/** Flipping only changes presentation; grading remains a separate action. */
export default function StudyCard({className,revealed,disabled,onFlip,children}:{className:string;revealed:boolean;disabled:boolean;onFlip:()=>void;children:ReactNode}){
  return <div className={`${className} study-card-interactive`} role="button" tabIndex={disabled?-1:0}
    aria-label={revealed?'收起答案':'显示答案'} aria-expanded={revealed} aria-disabled={disabled}
    onClick={()=>{if(!disabled&&!window.getSelection()?.toString())onFlip()}}
    onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();if(!disabled&&!event.repeat)onFlip()}}}>
    {children}
    <p className="study-flip-hint">{revealed?'点击卡片收起答案':'点击卡片任意位置查看答案'}</p>
  </div>;
}
