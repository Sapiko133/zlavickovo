/**
 * Testy dekódovania HTML entít v názvoch feedu.
 * Spustenie: npx tsx scripts/test-decode-entities.ts
 */
import assert from "node:assert/strict";
import { decodeEntities } from "../lib/heureka/parser.ts";

assert.equal(decodeEntities("Food&#039;ie"), "Food'ie");
assert.equal(decodeEntities("Nature&#039;s Answer"), "Nature's Answer");
assert.equal(decodeEntities("AYA&amp;IDA"), "AYA&IDA");
assert.equal(decodeEntities("A &#x26; B"), "A & B");
assert.equal(decodeEntities("bez entit"), "bez entit");
assert.equal(decodeEntities(""), "");
// dvojité escapovanie: &amp;#039; → ' (2 prechody)
assert.equal(decodeEntities("Food&amp;#039;ie"), "Food'ie");
// neplatný codepoint ostane nedotknutý
assert.equal(decodeEntities("&#0;"), "&#0;");
// nbsp → medzera
assert.equal(decodeEntities("A&nbsp;B"), "A B");

console.log("Decode entities tests passed.");
