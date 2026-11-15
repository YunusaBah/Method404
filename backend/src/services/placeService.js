// Turns whatever the farmer said or typed into one of the known places.
//
// Speech recognition is trained on American and British English, so "Kerewan"
// comes back as "caravan" and "Basse Santa Su" as "bass santa sue". Instead of
// trying to fix the recogniser, we compare what it heard with how each place
// actually sounds: a consonant skeleton, then edit distance on that skeleton.

const { PLACES } = require("../data/places");

// Words that carry no place name: "I live in Kerewan" -> "kerewan".
const FILLERS = new Set([
    "a", "am", "an", "and", "at", "city", "farm", "field", "for", "from",
    "grow", "here", "i", "in", "is", "it", "live", "living", "me", "my",
    "near", "of", "on", "our", "please", "plant", "the", "this", "to",
    "town", "village", "want", "we", "where"
]);

function normalise(input) {
    return String(input ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word && !FILLERS.has(word))
        .join(" ")
        .trim();
}

// The consonant skeleton of a word: "kerewan" and "caravan" both become "krwn".
function soundKey(word) {
    return word
        .replace(/ph/g, "f")
        .replace(/ck/g, "k")
        .replace(/q/g, "k")
        .replace(/x/g, "ks")
        .replace(/z/g, "s")
        .replace(/gh/g, "g")
        .replace(/th/g, "t")
        .replace(/sh/g, "s")
        .replace(/ch/g, "k")
        .replace(/dg/g, "j")
        .replace(/c/g, "k")
        .replace(/([a-z])\1+/g, "$1")
        .replace(/[aeiou]/g, "");
}

function distance(left, right) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let row = 1; row <= left.length; row += 1) {
        const current = [row];
        for (let column = 1; column <= right.length; column += 1) {
            const substitution = previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
            current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, substitution);
        }
        previous = current;
    }

    return previous[right.length];
}

function scoreName(query, candidate) {
    const wanted = normalise(query).replace(/\s+/g, "");
    const offered = normalise(candidate).replace(/\s+/g, "");
    if (!wanted || !offered || wanted.length < 3) return 0;
    if (wanted === offered) return 100;

    const wantedKey = soundKey(wanted);
    const offeredKey = soundKey(offered);
    // A misheard place almost never loses its first consonant, and requiring it
    // keeps "Dakar" from turning into "Kaur" or "Bakau".
    const sameStart = wantedKey[0] === offeredKey[0];

    if (sameStart && wantedKey === offeredKey) return 90;

    // A prefix is a stronger signal than a similar skeleton: "brik" is Brikama,
    // not Abuko.
    if (offered.startsWith(wanted) && wanted.length >= 3) return 80;

    // Short names get one edit, longer ones two.
    const literal = distance(wanted, offered);
    const allowance = wanted.length >= 7 ? 2 : 1;
    if (literal <= allowance) return 86 - literal * 6;

    if (sameStart && distance(wantedKey, offeredKey) <= 1) return 74;
    if (sameStart && wanted.length >= 6 && distance(wantedKey, offeredKey) <= 2) return 58;

    return 0;
}

function scorePlace(query, place) {
    const names = [place.name, ...(place.aliases ?? [])];
    return names.reduce((best, name) => Math.max(best, scoreName(query, name)), 0);
}

/**
 * @param {{queries: string[], limit?: number}} options
 */
function resolvePlaces({ queries = [], limit = 6 } = {}) {
    const asked = queries.map((query) => String(query ?? "")).filter((query) => normalise(query));
    if (asked.length === 0) {
        return { queries: [], normalised: "", matches: [] };
    }

    const scored = PLACES.map((place) => {
        let best = 0;
        let matched = "";
        for (const query of asked) {
            const score = scorePlace(query, place);
            if (score > best) {
                best = score;
                matched = query;
            }
        }
        return {
            id: place.id,
            name: place.name,
            region: place.region,
            lat: place.lat,
            lon: place.lon,
            score: best,
            exact: best === 100,
            matchedQuery: matched
        };
    })
        .filter((place) => place.score > 0)
        .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

    return {
        queries: asked,
        normalised: normalise(asked[0]),
        matches: scored.slice(0, limit)
    };
}

module.exports = { distance, normalise, resolvePlaces, scoreName, soundKey };
