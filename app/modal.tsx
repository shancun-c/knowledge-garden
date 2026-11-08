'use client';
import {useEffect,useRef,type ReactNode,type KeyboardEventHandler} from 'react';
/** Native top-layer dialog keeps the background inert, including nested image viewers. */
export default function Modal({children,label,onClose,backdropClose=false,className='',onKeyDown}:{children:ReactNode;label:string;onClose:()=>void;backdropClose?:boolean;className?:string;onKeyDown?:KeyboardEventHandler<HTMLDialogElement>}){
 const ref=useRef<HTMLDialogElement>(null),outsidePress=useRef(false);
 useEffect(()=>{const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;dialog.showModal();dialog.focus();return()=>{dialog.close();if(previous?.isConnected)previous.focus()}},[]);
 return <dialog ref={ref} tabIndex={-1} aria-label={label} className={`modal-root ${className}`} onCancel={e=>{e.preventDefault();e.stopPropagation();onClose()}} onPointerDown={e=>{outsidePress.current=e.target===e.currentTarget}} onClick={e=>{e.stopPropagation();if(backdropClose&&outsidePress.current&&e.target===e.currentTarget)onClose();outsidePress.current=false}} onKeyDown={e=>{e.stopPropagation();onKeyDown?.(e)}}>{children}</dialog>;
}
