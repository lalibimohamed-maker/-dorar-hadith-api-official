import test from "node:test";
import assert from "node:assert/strict";
import { canDecideExpired, expireReview, isExpired } from "../src/review-expiry.js";

const old="2026-08-01T00:00:00Z";
const fresh="2026-08-24T00:00:00Z";
const now=Date.parse("2026-08-24T12:00:00Z");

test("old review expires",()=>assert.equal(isExpired(old,now),true));
test("fresh review remains active",()=>assert.equal(isExpired(fresh,now),false));
test("pending old review becomes expired",()=>assert.equal(expireReview({state:"pending",createdAt:old},now).state,"expired"));
test("expired review cannot be decided",()=>assert.equal(canDecideExpired({state:"expired",createdAt:old}),false));
