import type {Metadata} from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';
export const metadata:Metadata={title:'知序 · 让知识生长',description:'知识树、知识卡片与间隔复习，让零散的知识形成连接。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
