import { buildNarratorRelation, getNarratorNetwork, validateChain } from './rijal-chain.js';

export function narratorRelations(relations = []) {
  return relations.map((relation) => buildNarratorRelation(relation));
}

export function narratorNetwork(narratorId, relations = []) {
  return getNarratorNetwork(narratorId, relations);
}

export function validateNarratorChain(chain = [], relations = []) {
  return validateChain(chain, relations);
}
