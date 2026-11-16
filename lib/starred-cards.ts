import {studyCards, type KnowledgeState} from './model.ts';
import {cardMatches} from './card-search.ts';

export function starredCards(state:KnowledgeState, query='', node='') {
  return studyCards(state,node).filter(card=>card.starred===true&&cardMatches(card,query));
}
