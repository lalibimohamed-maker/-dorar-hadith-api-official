import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraph, addNode, addEdge } from '../src/deen-graph-runtime.js';
import { traverse } from '../src/deen-graph-traversal.js';

function fixture() {
  const graph = createGraph();
  const nodes = [
    ['q1','quran_verse'], ['t1','tafsir'], ['h1','hadith'], ['s1','sirah_event'], ['c1','concept']
  ];
  for (const [id, type] of nodes) addNode(graph, { id, type, provenance: { sourceId: 'fixture', citation: id } });
  addEdge(graph, { id:'e1', from:'q1', to:'t1', type:'explains', provenance:{sourceId:'fixture',citation:'e1'} });
  addEdge(graph, { id:'e2', from:'t1', to:'h1', type:'related_to', provenance:{sourceId:'fixture',citation:'e2'} });
  addEdge(graph, { id:'e3', from:'h1', to:'s1', type:'contextualizes', provenance:{sourceId:'fixture',citation:'e3'} });
  addEdge(graph, { id:'e4', from:'s1', to:'c1', type:'same_concept_as', provenance:{sourceId:'fixture',citation:'e4'} });
  return graph;
}

test('bounded traversal reaches connected religious knowledge layers', () => {
  const graph = fixture();
  const result = traverse(graph, 'q1', { maxDepth: 4 });
  assert.deepEqual(result.map(x => x.node.id), ['t1','h1','s1','c1']);
});

test('node type filtering preserves traversal but filters returned nodes', () => {
  const graph = fixture();
  const result = traverse(graph, 'q1', { maxDepth: 4, nodeTypes: ['hadith','sirah_event'] });
  assert.deepEqual(result.map(x => x.node.id), ['h1','s1']);
});
