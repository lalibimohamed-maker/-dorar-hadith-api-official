import test from "node:test";
import assert from "node:assert/strict";
import { authorizeDecision, authorizePromotion, createReviewAssignment } from "../src/reviewer-separation.js";

const base={reviewId:"q1",sourceId:"s1",revisionId:"r1",submitterId:"u1",assignedReviewerId:"u2",assignedApproverId:"u3"};

test("requires distinct reviewer and approver",()=> {
  assert.throws(()=>createReviewAssignment({...base,assignedApproverId:"u2"}));
});

test("submitter cannot be reviewer or approver",()=> {
  assert.throws(()=>createReviewAssignment({...base,assignedReviewerId:"u1"}));
});

test("only assigned role can make its decision",()=> {
  const a=createReviewAssignment(base);
  assert.equal(authorizeDecision({assignment:a,actorId:"u2",role:"reviewer",decision:"approved"}),true);
  assert.equal(authorizeDecision({assignment:a,actorId:"u3",role:"reviewer",decision:"approved"}),false);
  assert.equal(authorizeDecision({assignment:a,actorId:"u3",role:"approver",decision:"approved"}),true);
});

test("promotion requires two independent approvals",()=> {
  const a=createReviewAssignment(base);
  assert.equal(authorizePromotion({assignment:a,reviewerId:"u2",approverId:"u3",reviewerDecision:"approved",approverDecision:"approved"}),true);
  assert.equal(authorizePromotion({assignment:a,reviewerId:"u2",approverId:"u2",reviewerDecision:"approved",approverDecision:"approved"}),false);
});

test("admin cannot silently act as reviewer/approver through this boundary",()=> {
  const a=createReviewAssignment(base);
  assert.equal(authorizeDecision({assignment:a,actorId:"admin",role:"admin",decision:"approved"}),false);
});
