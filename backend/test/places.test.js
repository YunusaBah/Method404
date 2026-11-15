const assert = require("node:assert/strict");
const { test } = require("node:test");
const { normalise, resolvePlaces, soundKey } = require("../src/services/placeService");

function best(query) {
    const { matches } = resolvePlaces({ queries: [query] });
    return matches[0];
}

test("an exact name wins", () => {
    assert.equal(best("Banjul").id, "banjul");
    assert.equal(best("Banjul").score, 100);
    assert.equal(best("  banjul ").id, "banjul");
});

test("speech recognition mangles are still understood", () => {
    // What the recogniser tends to produce for these names.
    assert.equal(best("caravan").id, "kerewan");
    assert.equal(best("bansung").id, "bansang");
    assert.equal(best("banjool").id, "banjul");
    assert.equal(best("seri kunda").id, "serekunda");
    assert.equal(best("bass santa sue").id, "basse");
});

test("a sentence is reduced to the place name", () => {
    assert.equal(normalise("I live in Kerewan"), "kerewan");
    assert.equal(best("my farm is in Bansang").id, "bansang");
    assert.equal(best("the village of Gunjur").id, "gunjur");
});

test("old colonial names still resolve", () => {
    assert.equal(best("Georgetown").id, "janjanbureh");
    assert.equal(best("Bathurst").id, "banjul");
});

test("a partial word suggests the full name", () => {
    assert.equal(best("brik").id, "brikama");
    assert.equal(best("mansak").id, "mansakonko");
});

test("a place outside The Gambia is not forced onto a match", () => {
    assert.equal(best("Dakar"), undefined);
    assert.equal(best("Nairobi"), undefined);
    assert.deepEqual(resolvePlaces({ queries: ["Dakar"] }).matches, []);
});

test("several transcripts are tried and the best wins", () => {
    // Speech recognition returns alternatives; the right one is not always first.
    const { matches } = resolvePlaces({ queries: ["caravan", "kerawan", "kerewan"] });
    assert.equal(matches[0].id, "kerewan");
    assert.equal(matches[0].score, 100);
});

test("results are ordered and limited", () => {
    const { matches } = resolvePlaces({ queries: ["k"], limit: 3 });
    assert.ok(matches.length <= 3);
    const scores = matches.map((match) => match.score);
    assert.deepEqual(scores, [...scores].sort((left, right) => right - left));
});

test("the sound key drops vowels and folds the usual spellings", () => {
    assert.equal(soundKey("kerewan"), "krwn");
    assert.equal(soundKey("caravan"), "krvn");
    assert.equal(soundKey("pharmacy"), "frmky");
    assert.equal(soundKey("serrekunda"), soundKey("serekunda"));
    assert.equal(soundKey("bass"), soundKey("basse"));
    assert.equal(soundKey("yundum")[0], "y");
});

test("an empty query returns nothing rather than everything", () => {
    assert.deepEqual(resolvePlaces({ queries: [] }).matches, []);
    assert.deepEqual(resolvePlaces({ queries: ["   "] }).matches, []);
});
