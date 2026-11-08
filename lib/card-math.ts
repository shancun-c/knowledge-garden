import katex from 'katex';

// Protect formulas before paragraph/list parsing, including multiline TeX.
// Backtick code and escaped dollar signs remain literal.
export function protectMath(text: string) {
  const formulas: {source:string;tex:string;display:boolean}[]=[];
  const prefix='\uE000'.repeat(Math.max(1,...(text.match(/\uE000+/g)||[]).map(s=>s.length+1)));
  const encoded=text.replace(/`[^`]*`|\\\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$(?!\s)([^$\n]*?[^$\s])\$(?!\d)/g,(source,a,b,c,d)=>{
    if(source.startsWith('`')||source==='\\$')return source;
    const index=formulas.push({source,tex:a??b??c??d,display:b!==undefined||c!==undefined})-1;
    return `${prefix}${index}\uE001`;
  });
  return {encoded,formulas,prefix};
}

export function renderFormula(tex:string,display:boolean) {
  try {
    return katex.renderToString(tex,{displayMode:display,throwOnError:true,trust:false,maxSize:10,maxExpand:1000,strict:'ignore',output:'htmlAndMathml'});
  } catch { return null; }
}
