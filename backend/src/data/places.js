// Places a farmer in The Gambia might name, with the point NASA POWER is asked
// about. Coordinates are the town centre, accurate enough for a 0.5° climate
// grid. `aliases` carries the spellings people type, the colonial names still
// in use, and the forms speech recognition tends to produce.
const PLACES = [
    // Banjul City
    { id: "banjul", name: "Banjul", region: "Banjul City", lat: 13.4549, lon: -16.579, aliases: ["banjul city", "bathurst", "banjol", "banjulinding"] },

    // Kanifing
    { id: "serekunda", name: "Serekunda", region: "Kanifing", lat: 13.4383, lon: -16.6781, aliases: ["serrekunda", "sere kunda", "seri kunda", "serekunda town"] },
    { id: "kanifing", name: "Kanifing", region: "Kanifing", lat: 13.4464, lon: -16.6744, aliases: ["kanifing estate", "kanifeng"] },
    { id: "bakau", name: "Bakau", region: "Kanifing", lat: 13.4781, lon: -16.6819, aliases: ["bakaw", "bakau new town"] },
    { id: "sukuta", name: "Sukuta", region: "Kanifing", lat: 13.4167, lon: -16.7, aliases: ["sukutta"] },
    { id: "abuko", name: "Abuko", region: "Kanifing", lat: 13.4, lon: -16.65, aliases: ["abukko"] },
    { id: "lamin", name: "Lamin", region: "Kanifing", lat: 13.35, lon: -16.6333, aliases: ["lamin village"] },

    // Brikama
    { id: "brikama", name: "Brikama", region: "Brikama", lat: 13.2667, lon: -16.65, aliases: ["brickama", "brikama ba"] },
    { id: "gunjur", name: "Gunjur", region: "Brikama", lat: 13.1833, lon: -16.7333, aliases: ["gunjuru", "gunjur village"] },
    { id: "kartong", name: "Kartong", region: "Brikama", lat: 13.0833, lon: -16.7667, aliases: ["kartung", "cartong"] },
    { id: "tanji", name: "Tanji", region: "Brikama", lat: 13.35, lon: -16.7833, aliases: ["tanje", "tanji village"] },
    { id: "brufut", name: "Brufut", region: "Brikama", lat: 13.3833, lon: -16.75, aliases: ["brufutt", "brufut heights"] },
    { id: "yundum", name: "Yundum", region: "Brikama", lat: 13.3667, lon: -16.6833, aliases: ["yundom", "yundum airport"] },
    { id: "bwiam", name: "Bwiam", region: "Brikama", lat: 13.2167, lon: -16.55, aliases: ["bwiiam", "bwiam hospital"] },
    { id: "kafuta", name: "Kafuta", region: "Brikama", lat: 13.2333, lon: -16.5833, aliases: ["kafutta"] },
    { id: "sibanor", name: "Sibanor", region: "Brikama", lat: 13.2333, lon: -16.4667, aliases: ["sibannor", "sibanorr"] },

    // Mansakonko
    { id: "mansakonko", name: "Mansakonko", region: "Mansakonko", lat: 13.4667, lon: -15.6833, aliases: ["mansa konko", "mansakonko town", "mansankonko"] },
    { id: "soma", name: "Soma", region: "Mansakonko", lat: 13.4333, lon: -15.5333, aliases: ["somma", "soma town"] },
    { id: "pakalinding", name: "Pakalinding", region: "Mansakonko", lat: 13.45, lon: -15.55, aliases: ["pakalindin", "paka linding"] },
    { id: "jenoi", name: "Jenoi", region: "Mansakonko", lat: 13.4667, lon: -15.5667, aliases: ["jennoi", "jenoy"] },

    // Kerewan
    { id: "kerewan", name: "Kerewan", region: "Kerewan", lat: 13.5, lon: -16.0833, aliases: ["kerawan", "kerewane", "kerwan", "caravan"] },
    { id: "farafenni", name: "Farafenni", region: "Kerewan", lat: 13.5667, lon: -15.6, aliases: ["farafeni", "farafenni town", "farafening"] },
    { id: "kaur", name: "Kaur", region: "Kerewan", lat: 13.55, lon: -15.6333, aliases: ["kaur town", "core"] },
    { id: "njaba-kunda", name: "Njaba Kunda", region: "Kerewan", lat: 13.5333, lon: -15.65, aliases: ["njabakunda", "jaba kunda"] },

    // Kuntaur
    { id: "kuntaur", name: "Kuntaur", region: "Kuntaur", lat: 13.6667, lon: -14.8833, aliases: ["kuntuar", "kuntour", "kuntaur wharf"] },

    // Janjanbureh
    { id: "janjanbureh", name: "Janjanbureh", region: "Janjanbureh", lat: 13.5333, lon: -14.7667, aliases: ["janjangbureh", "georgetown", "janjan bureh", "janjanbure"] },
    { id: "bansang", name: "Bansang", region: "Janjanbureh", lat: 13.4333, lon: -14.65, aliases: ["bansung", "bansang town", "ban sang"] },
    { id: "bureng", name: "Bureng", region: "Janjanbureh", lat: 13.4333, lon: -15.3, aliases: ["bureng town", "bureng bolong"] },

    // Basse
    { id: "basse", name: "Basse Santa Su", region: "Basse", lat: 13.3167, lon: -14.2167, aliases: ["basse", "basse santa su", "basse santasu", "bass santa su", "basse santa sue"] },
    { id: "fatoto", name: "Fatoto", region: "Basse", lat: 13.4, lon: -13.8833, aliases: ["fattoto", "fatoto town"] },
    { id: "koina", name: "Koina", region: "Basse", lat: 13.4167, lon: -13.9167, aliases: ["koyna", "koina town"] },
    { id: "diabugu", name: "Diabugu", region: "Basse", lat: 13.3833, lon: -14.4, aliases: ["diabugu basilla", "jabugu"] },
    { id: "suduwol", name: "Suduwol", region: "Basse", lat: 13.35, lon: -14.1667, aliases: ["suduwoll", "sudowol"] }
];

// The eight local government areas, used for the "pick a district" list.
const REGIONS = ["Banjul City", "Kanifing", "Brikama", "Mansakonko", "Kerewan", "Kuntaur", "Janjanbureh", "Basse"];

module.exports = { PLACES, REGIONS };
