// Canonical AD-AS demand expansion: illustrative coordinates, never empirical data.
export const economicGeometry={
 ad1:{m:-1,b:9},ad2:{m:-1,b:11},as1:{m:1,b:1},as2:{m:1,b:3},naturalOutput:4,
} as const;
type Line={m:number;b:number};
export function intersection(a:Line,b:Line){if(a.m===b.m)throw Error('Parallel curves');const y=(b.b-a.b)/(a.m-b.m);return {y,p:a.m*y+a.b}}
export function checkedEconomicGeometry(){
 const g=economicGeometry,e1=intersection(g.ad1,g.as1),e2=intersection(g.ad2,g.as1),e3=intersection(g.ad2,g.as2);
 if(!(g.ad1.m<0&&g.ad2.m<0&&g.as1.m>0&&g.as2.m>0&&g.ad2.b>g.ad1.b&&g.as2.b>g.as1.b&&e1.y===g.naturalOutput&&e3.y===g.naturalOutput&&e2.y>e1.y&&e3.p>e2.p&&e2.p>e1.p))throw Error('Economic diagram invariant failed');
 return {...g,e1,e2,e3};
}
export function renderEconomicDiagram(){
 const g=checkedEconomicGeometry();const blue='#2878ac',green='#36775c',orange='#bd672f',purple='#7753a3',gray='#99a3aa',ink='#243b3b';
 const out:string[]=[];
 const text=(x:number,y:number,t:string,size=24,color=ink,anchor='start')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${t}</text>`;
 const line=(x1:number,y1:number,x2:number,y2:number,color:string,width=3,dash='',marker='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${dash?`stroke-dasharray="${dash}"`:''} ${marker?`marker-end="url(#${marker})"`:''}/>`;
 out.push(`<svg xmlns="http://www.w3.org/2000/svg" data-knowledge-diagram="ad-as-v1" width="1600" height="1100" viewBox="0 0 1600 1100" role="img" aria-labelledby="title desc"><title id="title">总需求增加后如何回到自然产出水平</title><desc id="desc">AD 右移使短期产出和价格上升；AS 上移后沿 AD 向左上方调整，产出回到 Yf，价格进一步上升。非定量示意。</desc><defs>`);
 for(const [id,color] of [['axis',ink],['move',orange],['adjust',purple]])out.push(`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`);
 out.push(`</defs><rect width="1600" height="1100" rx="24" fill="#fffefb"/><g font-family="PingFang SC,Microsoft YaHei,Noto Sans CJK SC,sans-serif">`);
 out.push(text(800,68,'总需求增加后的短期冲击与长期调整',38,ink,'middle'),text(800,112,'自然产出不变 · AD 向右移动后保持在 AD₂ · 非定量示意',23,'#657775','middle'));
 for(const stage of [0,1]){
  const left=stage===0?145:935,bottom=785,scale=53;const x=(v:number)=>left+scale*v,y=(v:number)=>bottom-scale*v;
  const seg=(curve:Line,a:number,b:number,color:string,dash='')=>line(x(a),y(curve.m*a+curve.b),x(b),y(curve.m*b+curve.b),color,4,dash);
  const guide=(point:{y:number;p:number},label:string)=>{out.push(line(left,y(point.p),x(point.y),y(point.p),'#b8c0c3',1.5,'6 6'),text(left-18,y(point.p)+8,label,24,ink,'end'))};
  const point=(p:{y:number;p:number},label:string,color:string,dx:number,dy:number)=>out.push(`<circle cx="${x(p.y)}" cy="${y(p.p)}" r="8" fill="#fffefb" stroke="${color}" stroke-width="4"/>`,text(x(p.y)+dx,y(p.p)+dy,label,26,color));
  out.push(text(left-30,185,stage===0?'① 短期：总需求增加':'② 长期：预期价格调整',29),text(left-30,225,stage===0?'AS₁ 不变，均衡沿 AS₁ 向右上方移动':'AD₂ 不变，均衡沿 AD₂ 向左上方移动',21,'#657775'));
  out.push(line(left,bottom,left,y(9.6),ink,2.5,'','axis'),line(left,bottom,x(10),bottom,ink,2.5,'','axis'),text(left-30,y(10.05),'价格水平 P',22),text(x(9.7),bottom+65,'产出 Y',22,ink,'end'));
  out.push(line(x(g.naturalOutput),bottom,x(g.naturalOutput),y(9.1),'#b1a5c5',2,'7 7'),text(x(g.naturalOutput),bottom+33,'Yf',25,purple,'middle'),line(x(g.e2.y),bottom,x(g.e2.y),y(g.e2.p),'#bdc4c5',1.5,'6 6'),text(x(g.e2.y)+6,bottom+33,'Y₁',25,ink,'middle'));
  if(stage===0){
   guide(g.e1,'Pf');guide(g.e2,'P₁');
   out.push(seg(g.ad1,0.6,8,gray,'9 6'),seg(g.ad2,2,9,blue),seg(g.as1,0.6,8,green));
   out.push(text(x(8)+12,y(1)+8,'AD₁',24,gray),text(x(9)+10,y(2)+8,'AD₂',24,blue),text(x(8)-15,y(9)-15,'AS₁',24,green));
   out.push(line(x(6.3),y(2.7),x(8.3),y(2.7),orange,3,'','move'),text(x(6.5),y(2.7)-16,'AD 右移',19,orange));
   out.push(line(x(4.15),y(5.15),x(4.83),y(5.83),orange,4,'','move'));
   point(g.e1,'E₁',ink,-45,30);point(g.e2,'E₂',orange,17,5);
  }else{
   guide(g.e2,'P₁');guide(g.e3,'P₂');
   out.push(seg(g.ad2,2,9,blue),seg(g.as1,0.6,8,gray,'9 6'),seg(g.as2,0.6,6,green));
   out.push(text(x(9)+10,y(2)+8,'AD₂',24,blue),text(x(8)-10,y(9)-15,'AS₁',24,gray),text(x(6)-10,y(9)-15,'AS₂',24,green));
   out.push(line(x(1.5),y(2.65),x(1.5),y(4.35),purple,3,'','adjust'),text(x(0.2),y(4.65),'AS 上移',19,purple));
   out.push(line(x(4.85),y(6.15),x(4.17),y(6.83),purple,4,'','adjust'));
   point(g.e2,'E₂',orange,17,10);point(g.e3,'E₃',purple,-46,-15);
  }
 }
 out.push(`<line x1="800" y1="165" x2="800" y2="850" stroke="#e1e7e2"/>`);
 const boxes=[{x:95,title:'初始 E₁',body:'Y = Yf，P = Pf'},{x:595,title:'短期 E₂',body:'Y₁ ＞ Yf，P₁ ＞ Pf'},{x:1095,title:'长期 E₃',body:'Y = Yf，P₂ ＞ P₁'}];
 for(const box of boxes)out.push(`<rect x="${box.x}" y="880" width="410" height="105" rx="14" fill="#eef3e9"/>`,text(box.x+205,920,box.title,24,ink,'middle'),text(box.x+205,960,box.body,24,ink,'middle'));
 out.push(text(800,1030,'结论：产出回到自然水平，价格继续上涨，P₂ ＞ P₁ ＞ Pf。',26,ink,'middle'),text(800,1070,'AS 表示短期总供给；Yf 竖线标示自然产出位置。直线仅表示关系，不代表真实数据。',20,'#657775','middle'),'</g></svg>');
 return out.join('');
}
