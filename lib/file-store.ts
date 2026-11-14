import {pairKey} from './knowledge-links.ts';
import {InvalidStateChanges} from './state-changes.ts';
import {applyStateChanges,type StateChanges} from './state-changes.ts';
import {applyStudyPolicy} from './study-plan.ts';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, open, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { KnowledgeState } from './model';

type StoredState = { state: KnowledgeState; revision: number };
export class RevisionConflict extends Error {}
export class SchedulerVersionConflict extends Error {}

// One Node process per data directory. Serialize compare-and-swap writes, and
// atomically rename a fully flushed file so interrupted writes cannot truncate it.
export class FileStore {
  private pending: Promise<unknown> = Promise.resolve();
  private directory: string;
  constructor(directory: string) { this.directory = directory; }

  private path(owner: string) {
    return join(this.directory, `${createHash('sha256').update(owner).digest('hex')}.json`);
  }

  async read(owner: string): Promise<StoredState> {
    try {
      return JSON.parse(await readFile(this.path(owner), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { state: { nodes: [], cards: [], links: [] }, revision: 0 };
      }
      throw error;
    }
  }

  write(owner: string, state: KnowledgeState, revision: number): Promise<number> {
    return this.writeSnapshot(owner,state,revision).then(result=>result.revision);
  }

  writeSnapshot(owner:string,state:KnowledgeState,revision:number):Promise<StoredState>{
    return this.mutate(owner,previous=>{
      if(previous.revision!==revision)throw new RevisionConflict();
      if((previous.state.schedulerVersion||0)>(state.schedulerVersion||0))throw new SchedulerVersionConflict();
      return this.prepareState(previous.state,state);
    });
  }

  writeChanges(owner:string,changes:StateChanges,revision:number):Promise<StoredState>{
    return this.mutate(owner,previous=>{
      if(previous.revision!==revision)throw new RevisionConflict();
      if((previous.state.schedulerVersion||0)>changes.schedulerVersion)throw new SchedulerVersionConflict();
      return this.prepareState(previous.state,applyStateChanges(previous.state,changes));
    });
  }

  private prepareState(previous:KnowledgeState,state:KnowledgeState):KnowledgeState{
      const oldCounts=new Map<string,number>(),counts=new Map<string,number>(),ids=new Set<string>();
      for(const l of previous.links){const key=pairKey(l.from,l.to);oldCounts.set(key,(oldCounts.get(key)||0)+1)}
      for(const l of state.links){
        if(ids.has(l.id))throw new InvalidStateChanges('关联 ID 重复，未保存');ids.add(l.id);
        const key=pairKey(l.from,l.to),count=(counts.get(key)||0)+1;counts.set(key,count);
        if(count>Math.max(1,oldCounts.get(key)||0))throw new InvalidStateChanges('这两张卡片已有关联，请编辑已有关系');
      }
      // Personal profiles are server-owned; ordinary state saves cannot erase/replace them.
      const oldCards=new Map(previous.cards.map(card=>[card.id,card]));
      // Older clients omit notes; only an explicit empty string clears them.
      const cards=state.cards.map(card=>card.notes===undefined&&oldCards.get(card.id)?.notes!==undefined?{...card,notes:oldCards.get(card.id)!.notes}:card);
      const withComments=cards.map(card=>{
        const previousComments=oldCards.get(card.id)?.comments;
        if(!previousComments?.length)return card;
        return card.comments===undefined?{...card,comments:previousComments}:card;
      });
      const withImages=withComments.map(card=>card.images===undefined&&oldCards.get(card.id)?.images?{...card,images:oldCards.get(card.id)!.images}:card);
      return applyStudyPolicy(previous,{...state,cards:withImages,optimization:previous.optimization},Date.now());
  }

  mutate(owner:string, change:(previous:StoredState)=>KnowledgeState):Promise<StoredState>{
    const operation=this.pending.then(async()=>{
      await mkdir(this.directory,{recursive:true,mode:0o700});
      const previous=await this.read(owner);
      const state=change(previous),revision=previous.revision+1;
      const path=this.path(owner),temporary=`${path}.${randomUUID()}.tmp`;
      const file=await open(temporary,'wx',0o600);
      try{await file.writeFile(JSON.stringify({state,revision}));await file.sync()}finally{await file.close()}
      if(previous.revision>0)await copyFile(path,`${path}.previous`);
      await rename(temporary,path);
      const directory=await open(this.directory,'r');
      try{await directory.sync()}finally{await directory.close()}
      return {state,revision};
    });
    this.pending=operation.catch(()=>undefined);
    return operation;
  }

}

export const fileStore = new FileStore(process.env.KNOWLEDGE_DATA_DIR || './data');
