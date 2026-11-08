import {test} from 'node:test';
import assert from 'node:assert/strict';
import {protectMath,renderFormula} from '../lib/card-math.ts';
import {parseCardContent} from '../lib/card-content.ts';
test('BSM formulas, display math and multiline equations are protected',()=>{
 const source=String.raw`- 看涨：\(C=SN(d_1)-Ke^{-rT}N(d_2)\)
\[
d_1=\frac{\ln(S/K)+(r+\sigma^2/2)T}{\sigma\sqrt T}
\]`;
 const p=protectMath(source);assert.equal(p.formulas.length,2);assert.equal(p.formulas[1].display,true);
 assert.equal(parseCardContent(p.encoded).length,1);
 for(const f of p.formulas)assert.match(renderFormula(f.tex,f.display)!,/class="katex/);
});
test('delimiters preserve ordinary currency, code, incomplete input and single symbols',()=>{
 assert.equal(protectMath(String.raw`$10 and $20; \$5; \(unfinished; \`code\``.replaceAll('\\`','`')).formulas.length,0);
 assert.equal(protectMath('$x$ and $$y$$').formulas.length,2);
 assert.equal(protectMath('`$x$`').formulas.length,0);
});
test('invalid formulas fall back and untrusted commands cannot inject resources',()=>{
 assert.equal(renderFormula(String.raw`\frac{`,false),null);
 const html=renderFormula(String.raw`\href{javascript:alert(1)}{x}`,false)||'';
 assert.ok(!html.includes('href="javascript:'));
 assert.ok(!(renderFormula(String.raw`\includegraphics{https://example.com/x}`,false)||'').includes('<img'));
});
