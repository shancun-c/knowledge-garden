import { protectMath, renderFormula } from '../lib/card-math';
import { inlineTokens, parseCardContent, splitItemLabel } from '../lib/card-content';

function PlainInline({ text }: { text: string }) {
  return <>{inlineTokens(text).map((token, index) => {
    if (token.type === 'strong') return <strong key={index}>{token.text}</strong>;
    if (token.type === 'code') return <code key={index}>{token.text}</code>;
    if (token.type === 'arrow') return <span className="content-arrow" key={index}>{token.text}</span>;
    return token.text;
  })}</>;
}

export function MathText({text}:{text:string}) {
  const {encoded,formulas,prefix}=protectMath(text);
  return <>{encoded.split(new RegExp(`(${prefix}\\d+\\uE001)`, 'g')).map((part,index)=>{
    if(!part.startsWith(prefix))return <PlainInline key={index} text={part}/>;
    const formula=formulas[Number(part.slice(prefix.length,-1))];
    const html=renderFormula(formula.tex,formula.display);
    return html?<span key={index} className={formula.display?'math-formula math-display':'math-formula'} dangerouslySetInnerHTML={{__html:html}}/>:<code key={index} className="math-error" title="公式语法无法识别，请检查 LaTeX">{formula.source}</code>;
  })}</>;
}

export default function CardContent({ text }: { text: string }) {
  const {encoded,formulas,prefix}=protectMath(text);
  const blocks = parseCardContent(encoded);
  const restore=(value:string)=>value.replace(new RegExp(`${prefix}(\\d+)\\uE001`, 'g'),(_,index)=>formulas[Number(index)].source);
  const Inline=({text}:{text:string})=><MathText text={restore(text)}/>;
  return <div className="card-content">{blocks.map((block, index) => {
    if (block.type === 'heading') return <h4 key={index}><Inline text={block.text} /></h4>;
    if (block.type === 'paragraph') return <p key={index} className={index === 0 && blocks.length > 1 ? 'content-summary' : undefined}><Inline text={block.text} /></p>;
    if (block.type !== 'list') return null;
    const items = block.items.map((item, itemIndex) => {
      const labeled = splitItemLabel(item);
      return <li key={itemIndex}>{labeled ? <><div className="content-item-title"><Inline text={labeled.label} /></div><div className="content-item-body"><Inline text={labeled.body} /></div></> : <Inline text={item} />}</li>;
    });
    return block.ordered ? <ol start={block.start} key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
  })}</div>;
}
