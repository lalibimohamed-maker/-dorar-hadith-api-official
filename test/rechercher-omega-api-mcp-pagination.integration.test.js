import test from "node:test";
import assert from "node:assert/strict";
import { envelope } from "../src/rechercher-ai-gateway.js";

test("AI gateway envelope preserves upstream cursor metadata",()=>{
 const page1=envelope({sourceMatches:[{id:"1"},{id:"2"}],pagination:{next_cursor:"c2"}},{cursor:null,limit:2});
 assert.equal(page1.meta.limit,2);
 assert.equal(page1.meta.next_cursor,"c2");
 const page2=envelope({sourceMatches:[{id:"3"}],pagination:{next_cursor:null}},{cursor:"c2",limit:2});
 assert.equal(page2.meta.cursor,"c2");
 assert.equal(page2.meta.next_cursor,null);
});

test("AI gateway envelope does not invent a cursor",()=>{
 const result=envelope({sourceMatches:[{id:"1"}]},{limit:1});
 assert.equal(result.meta.next_cursor,null);
 assert.equal(result.meta.generated_text_is_evidence,false);
});
