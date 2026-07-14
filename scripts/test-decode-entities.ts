/**
 * Testy dekódovania HTML entít v názvoch feedu.
 * Spustenie: npx tsx scripts/test-decode-entities.ts
 */
import assert from "node:assert/strict";
import { decodeEntities, normalizePrice } from "../lib/heureka/parser.ts";

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

// normalizePrice — čistí float artefakty, nič iné
assert.equal(normalizePrice("35.989999"), "35.99");
assert.equal(normalizePrice("40.890001"), "40.89");
assert.equal(normalizePrice("8.923000"), "8.92");     // zaokrúhli na 2 desatinné
assert.equal(normalizePrice("71.290000"), "71.29");
assert.equal(normalizePrice("35.99"), "35.99");        // 2 desatinné nezmenené
assert.equal(normalizePrice("1299"), "1299");          // celé číslo nezmenené
assert.equal(normalizePrice("12,99 EUR"), "12,99 EUR"); // formát s menou nezmenený
assert.equal(normalizePrice("1 299 Kč"), "1 299 Kč");   // CZK formát nezmenený
assert.equal(normalizePrice(""), "");

console.log("Decode entities + normalizePrice tests passed.");
