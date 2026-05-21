// Local multilingual seed dictionary.
//
// Stored as a single ROWS array: one row per "concept", each row carries
// every supported language's form. This is much more compact and avoids
// the previous N×N duplication where each source language repeated the
// whole vocabulary.
//
// On top of `seedLookup(src, tgt, q)` (exact-phrase match, used by the
// LLM/DeepL graceful fallbacks), we expose `seedLookupPhrase` which
// implements a multi-strategy lookup so multi-word inputs degrade
// gracefully word-by-word — the user always gets *something* back.

import { LANGS, type Lang } from "../types";

export type Row = {
  pos?: string;
  idiom?: boolean;
  /** Pronunciation hint — usually for the English form. Optional. */
  ipa?: string;
  /** Canonical form per language. Missing language ⇒ no translation. */
  forms: Partial<Record<Lang, string>>;
  /** Optional example sentence per language. Paired up by src/tgt at query time. */
  examples?: Partial<Record<Lang, string>>;
  /** Optional list of alternative source spellings to map back to this row. */
  aliases?: Partial<Record<Lang, string[]>>;
};

const lower = (s: string) => s.toLowerCase().trim();

// ---------------------------------------------------------------------------
// ROWS — daily-use vocabulary across EN · RU · DA · DE · SV · PT · PL · ES.
// Roughly 110 entries covering: greetings, pronouns, common verbs/nouns/
// adjectives, numbers, wh-words, prepositions, time words, and a few idioms.
// Easy to extend — add rows; both directions get indexed automatically.
// ---------------------------------------------------------------------------
export const ROWS: Row[] = [
  // —— greetings & social ————————————————————————————————————————————
  {
    pos: "interj.", ipa: "/həˈloʊ/",
    forms: { en: "hello", ru: "привет", da: "hej", de: "hallo", sv: "hej", pt: "olá", pl: "cześć", es: "hola" },
    examples: {
      en: "Hello, how are you?", ru: "Привет, как дела?",
      da: "Hej, hvordan har du det?", de: "Hallo, wie geht es dir?", sv: "Hej, hur mår du?",
      pt: "Olá, como vai você?", pl: "Cześć, jak się masz?", es: "Hola, ¿cómo estás?",
    },
    aliases: { en: ["hi"], pt: ["oi"], pl: ["witaj"] },
  },
  { pos: "interj.", forms: { en: "goodbye", ru: "до свидания", da: "farvel", de: "auf Wiedersehen", sv: "hej då", pt: "tchau", pl: "do widzenia", es: "adiós" }, aliases: { pt: ["adeus"] } },
  { pos: "phrase",  forms: { en: "good morning", ru: "доброе утро", da: "godmorgen", de: "guten Morgen", sv: "god morgon", pt: "bom dia", pl: "dzień dobry", es: "buenos días" } },
  { pos: "phrase",  forms: { en: "good evening", ru: "добрый вечер", da: "godaften", de: "guten Abend", sv: "god kväll", pt: "boa noite", pl: "dobry wieczór", es: "buenas tardes" } },
  { pos: "phrase",  forms: { en: "good night",   ru: "спокойной ночи", da: "godnat", de: "gute Nacht", sv: "god natt", pt: "boa noite", pl: "dobranoc", es: "buenas noches" } },
  { pos: "phrase",  forms: { en: "thank you",    ru: "спасибо", da: "tak", de: "danke", sv: "tack", pt: "obrigado", pl: "dziękuję", es: "gracias" }, aliases: { en: ["thanks"] } },
  { pos: "interj.", forms: { en: "please",   ru: "пожалуйста", da: "venligst", de: "bitte", sv: "snälla", pt: "por favor", pl: "proszę", es: "por favor" } },
  { pos: "interj.", forms: { en: "yes",      ru: "да", da: "ja", de: "ja", sv: "ja", pt: "sim", pl: "tak", es: "sí" } },
  { pos: "interj.", forms: { en: "no",       ru: "нет", da: "nej", de: "nein", sv: "nej", pt: "não", pl: "nie", es: "no" } },
  { pos: "phrase",  forms: { en: "excuse me", ru: "извините", da: "undskyld", de: "Entschuldigung", sv: "ursäkta", pt: "com licença", pl: "przepraszam", es: "perdón" } },
  { pos: "interj.", forms: { en: "sorry",    ru: "извините", da: "beklager", de: "Entschuldigung", sv: "förlåt", pt: "desculpe", pl: "przepraszam", es: "lo siento" } },
  { pos: "interj.", forms: { en: "ok",       ru: "хорошо", da: "okay", de: "okay", sv: "okej", pt: "ok", pl: "dobrze", es: "vale" }, aliases: { en: ["okay"] } },
  { pos: "phrase",  forms: { en: "how are you", ru: "как дела", da: "hvordan har du det", de: "wie geht es dir", sv: "hur mår du", pt: "como vai você", pl: "jak się masz", es: "cómo estás" } },
  { pos: "phrase",  forms: { en: "where is the bathroom", ru: "где туалет", da: "hvor er toilettet", de: "wo ist die Toilette", sv: "var ligger toaletten", pt: "onde fica o banheiro", pl: "gdzie jest toaleta", es: "dónde está el baño" } },
  { pos: "interj.", forms: { en: "yeah", ru: "да", da: "ja", de: "ja", sv: "ja", pt: "sim", pl: "tak", es: "sí" } },

  // —— pronouns ————————————————————————————————————————————
  { pos: "pron.", forms: { en: "I",    ru: "я",   da: "jeg", de: "ich", sv: "jag", pt: "eu",   pl: "ja",   es: "yo"       } },
  { pos: "pron.", forms: { en: "you",  ru: "ты",  da: "du",  de: "du",  sv: "du",  pt: "você", pl: "ty",   es: "tú"       } },
  { pos: "pron.", forms: { en: "he",   ru: "он",  da: "han", de: "er",  sv: "han", pt: "ele",  pl: "on",   es: "él"       } },
  { pos: "pron.", forms: { en: "she",  ru: "она", da: "hun", de: "sie", sv: "hon", pt: "ela",  pl: "ona",  es: "ella"     } },
  { pos: "pron.", forms: { en: "we",   ru: "мы",  da: "vi",  de: "wir", sv: "vi",  pt: "nós",  pl: "my",   es: "nosotros" } },
  { pos: "pron.", forms: { en: "they", ru: "они", da: "de",  de: "sie", sv: "de",  pt: "eles", pl: "oni",  es: "ellos"    } },
  { pos: "pron.", forms: { en: "it",   ru: "это", da: "det", de: "es",  sv: "det", pt: "isso", pl: "to",   es: "eso"      } },
  { pos: "pron.", forms: { en: "this", ru: "это", da: "denne", de: "dieses", sv: "denna", pt: "este",   pl: "to",    es: "esto"  } },
  { pos: "pron.", forms: { en: "that", ru: "тот", da: "den", de: "das", sv: "den",         pt: "aquele", pl: "tamto", es: "eso"   } },
  { pos: "pron.", forms: { en: "my",   ru: "мой", da: "min", de: "mein", sv: "min",         pt: "meu",   pl: "mój",   es: "mi"    } },
  { pos: "pron.", forms: { en: "your", ru: "твой", da: "din", de: "dein", sv: "din",        pt: "seu",   pl: "twój",  es: "tu"    } },

  // —— common verbs ————————————————————————————————————————————
  { pos: "v.", forms: { en: "be",    ru: "быть",    da: "være",  de: "sein",     sv: "vara",    pt: "ser",      pl: "być",         es: "ser"      } },
  { pos: "v.", forms: { en: "is",    ru: "есть",    da: "er",    de: "ist",      sv: "är",      pt: "é",        pl: "jest",        es: "es"       } },
  { pos: "v.", forms: { en: "are",   ru: "есть",    da: "er",    de: "sind",     sv: "är",      pt: "são",      pl: "są",          es: "son"      } },
  { pos: "v.", forms: { en: "was",   ru: "был",     da: "var",   de: "war",      sv: "var",     pt: "foi",      pl: "był",         es: "fue"      } },
  { pos: "v.", forms: { en: "have",  ru: "иметь",   da: "have",  de: "haben",    sv: "ha",      pt: "ter",      pl: "mieć",        es: "tener"    } },
  { pos: "v.", forms: { en: "do",    ru: "делать",  da: "gøre",  de: "tun",      sv: "göra",    pt: "fazer",    pl: "robić",       es: "hacer"    } },
  { pos: "v.", forms: { en: "go",    ru: "идти",    da: "gå",    de: "gehen",    sv: "gå",      pt: "ir",       pl: "iść",         es: "ir"       } },
  { pos: "v.", forms: { en: "come",  ru: "приходить", da: "komme", de: "kommen", sv: "komma",   pt: "vir",      pl: "przyjść",     es: "venir"    } },
  { pos: "v.", forms: { en: "want",  ru: "хотеть",  da: "ville", de: "wollen",   sv: "vilja",   pt: "querer",   pl: "chcieć",      es: "querer"   } },
  { pos: "v.", forms: { en: "need",  ru: "нуждаться", da: "behøve", de: "brauchen", sv: "behöva", pt: "precisar", pl: "potrzebować", es: "necesitar"} },
  { pos: "v.", forms: { en: "like",  ru: "нравиться", da: "kan lide", de: "mögen", sv: "tycka om", pt: "gostar", pl: "lubić",       es: "gustar"   } },
  { pos: "v.", forms: { en: "love",  ru: "любить",  da: "elske", de: "lieben",   sv: "älska",   pt: "amar",     pl: "kochać",      es: "amar"     } },
  { pos: "v.", forms: { en: "see",   ru: "видеть",  da: "se",    de: "sehen",    sv: "se",      pt: "ver",      pl: "widzieć",     es: "ver"      } },
  { pos: "v.", forms: { en: "hear",  ru: "слышать", da: "høre",  de: "hören",    sv: "höra",    pt: "ouvir",    pl: "słyszeć",     es: "oír"      } },
  { pos: "v.", forms: { en: "speak", ru: "говорить", da: "tale", de: "sprechen", sv: "tala",    pt: "falar",    pl: "mówić",       es: "hablar"   } },
  { pos: "v.", forms: { en: "eat",   ru: "есть",    da: "spise", de: "essen",    sv: "äta",     pt: "comer",    pl: "jeść",        es: "comer"    } },
  { pos: "v.", forms: { en: "drink", ru: "пить",    da: "drikke", de: "trinken", sv: "dricka",  pt: "beber",    pl: "pić",         es: "beber"    } },
  { pos: "v.", forms: { en: "sleep", ru: "спать",   da: "sove",  de: "schlafen", sv: "sova",    pt: "dormir",   pl: "spać",        es: "dormir"   } },
  { pos: "v.", forms: { en: "help",  ru: "помочь",  da: "hjælpe", de: "helfen",  sv: "hjälpa",  pt: "ajudar",   pl: "pomóc",       es: "ayudar"   } },
  { pos: "v.", forms: { en: "know",  ru: "знать",   da: "vide",  de: "wissen",   sv: "veta",    pt: "saber",    pl: "wiedzieć",    es: "saber"    } },

  // —— common nouns ————————————————————————————————————————————
  { pos: "n.", forms: { en: "water",    ru: "вода",     da: "vand",        de: "Wasser",     sv: "vatten",  pt: "água",     pl: "woda",        es: "agua"       } },
  { pos: "n.", forms: { en: "food",     ru: "еда",      da: "mad",         de: "Essen",      sv: "mat",     pt: "comida",   pl: "jedzenie",    es: "comida"     } },
  { pos: "n.", forms: { en: "bread",    ru: "хлеб",     da: "brød",        de: "Brot",       sv: "bröd",    pt: "pão",      pl: "chleb",       es: "pan"        } },
  { pos: "n.", forms: { en: "coffee",   ru: "кофе",     da: "kaffe",       de: "Kaffee",     sv: "kaffe",   pt: "café",     pl: "kawa",        es: "café"       } },
  { pos: "n.", forms: { en: "tea",      ru: "чай",      da: "te",          de: "Tee",        sv: "te",      pt: "chá",      pl: "herbata",     es: "té"         } },
  { pos: "n.", forms: { en: "milk",     ru: "молоко",   da: "mælk",        de: "Milch",      sv: "mjölk",   pt: "leite",    pl: "mleko",       es: "leche"      } },
  { pos: "n.", forms: { en: "house",    ru: "дом",      da: "hus",         de: "Haus",       sv: "hus",     pt: "casa",     pl: "dom",         es: "casa"       } },
  { pos: "n.", forms: { en: "car",      ru: "машина",   da: "bil",         de: "Auto",       sv: "bil",     pt: "carro",    pl: "samochód",    es: "coche"      } },
  { pos: "n.", forms: { en: "bus",      ru: "автобус",  da: "bus",         de: "Bus",        sv: "buss",    pt: "ônibus",   pl: "autobus",     es: "autobús"    } },
  { pos: "n.", forms: { en: "train",    ru: "поезд",    da: "tog",         de: "Zug",        sv: "tåg",     pt: "trem",     pl: "pociąg",      es: "tren"       } },
  { pos: "n.", forms: { en: "hotel",    ru: "отель",    da: "hotel",       de: "Hotel",      sv: "hotell",  pt: "hotel",    pl: "hotel",       es: "hotel"      } },
  { pos: "n.", forms: { en: "room",     ru: "комната",  da: "værelse",     de: "Zimmer",     sv: "rum",     pt: "quarto",   pl: "pokój",       es: "habitación" } },
  { pos: "n.", forms: { en: "bed",      ru: "кровать",  da: "seng",        de: "Bett",       sv: "säng",    pt: "cama",     pl: "łóżko",       es: "cama"       } },
  { pos: "n.", forms: { en: "table",    ru: "стол",     da: "bord",        de: "Tisch",      sv: "bord",    pt: "mesa",     pl: "stół",        es: "mesa"       } },
  { pos: "n.", forms: { en: "book",     ru: "книга",    da: "bog",         de: "Buch",       sv: "bok",     pt: "livro",    pl: "książka",     es: "libro"      }, ipa: "/bʊk/" },
  { pos: "n.", forms: { en: "phone",    ru: "телефон",  da: "telefon",     de: "Telefon",    sv: "telefon", pt: "telefone", pl: "telefon",     es: "teléfono"   } },
  { pos: "n.", forms: { en: "money",    ru: "деньги",   da: "penge",       de: "Geld",       sv: "pengar",  pt: "dinheiro", pl: "pieniądze",   es: "dinero"     } },
  { pos: "n.", forms: { en: "time",     ru: "время",    da: "tid",         de: "Zeit",       sv: "tid",     pt: "tempo",    pl: "czas",        es: "tiempo"     } },
  { pos: "n.", forms: { en: "day",      ru: "день",     da: "dag",         de: "Tag",        sv: "dag",     pt: "dia",      pl: "dzień",       es: "día"        } },
  { pos: "n.", forms: { en: "night",    ru: "ночь",     da: "nat",         de: "Nacht",      sv: "natt",    pt: "noite",    pl: "noc",         es: "noche"      } },
  { pos: "n.", forms: { en: "morning",  ru: "утро",     da: "morgen",      de: "Morgen",     sv: "morgon",  pt: "manhã",    pl: "rano",        es: "mañana"     } },
  { pos: "n.", forms: { en: "evening",  ru: "вечер",    da: "aften",       de: "Abend",      sv: "kväll",   pt: "noite",    pl: "wieczór",     es: "noche"      } },
  { pos: "n.", forms: { en: "friend",   ru: "друг",     da: "ven",         de: "Freund",     sv: "vän",     pt: "amigo",    pl: "przyjaciel",  es: "amigo"      } },
  { pos: "n.", forms: { en: "family",   ru: "семья",    da: "familie",     de: "Familie",    sv: "familj",  pt: "família",  pl: "rodzina",     es: "familia"    } },
  { pos: "n.", forms: { en: "name",     ru: "имя",      da: "navn",        de: "Name",       sv: "namn",    pt: "nome",     pl: "imię",        es: "nombre"     } },
  { pos: "n.", forms: { en: "city",     ru: "город",    da: "by",          de: "Stadt",      sv: "stad",    pt: "cidade",   pl: "miasto",      es: "ciudad"     } },
  { pos: "n.", forms: { en: "country",  ru: "страна",   da: "land",        de: "Land",       sv: "land",    pt: "país",     pl: "kraj",        es: "país"       } },
  { pos: "n.", forms: { en: "bathroom", ru: "ванная",   da: "badeværelse", de: "Badezimmer", sv: "badrum",  pt: "banheiro", pl: "łazienka",    es: "baño"       } },
  { pos: "n.", forms: { en: "toilet",   ru: "туалет",   da: "toilet",      de: "Toilette",   sv: "toalett", pt: "banheiro", pl: "toaleta",     es: "baño"       } },
  { pos: "n.", forms: { en: "stage",    ru: "сцена",    da: "scene",       de: "Bühne",      sv: "scen",    pt: "palco",    pl: "scena",       es: "escenario"  } },
  { pos: "n.", forms: { en: "love",     ru: "любовь",   da: "kærlighed",   de: "Liebe",      sv: "kärlek",  pt: "amor",     pl: "miłość",      es: "amor"       } },
  { pos: "n.", forms: { en: "work",     ru: "работа",   da: "arbejde",     de: "Arbeit",     sv: "jobb",    pt: "trabalho", pl: "praca",       es: "trabajo"    } },
  { pos: "n.", forms: { en: "school",   ru: "школа",    da: "skole",       de: "Schule",     sv: "skola",   pt: "escola",   pl: "szkoła",      es: "escuela"    } },

  // —— adjectives ————————————————————————————————————————————
  { pos: "adj.", forms: { en: "good",      ru: "хороший",   da: "god",    de: "gut",       sv: "bra",     pt: "bom",      pl: "dobry",       es: "bueno"     } },
  { pos: "adj.", forms: { en: "bad",       ru: "плохой",    da: "dårlig", de: "schlecht",  sv: "dålig",   pt: "ruim",     pl: "zły",         es: "malo"      } },
  { pos: "adj.", forms: { en: "big",       ru: "большой",   da: "stor",   de: "groß",      sv: "stor",    pt: "grande",   pl: "duży",        es: "grande"    } },
  { pos: "adj.", forms: { en: "small",     ru: "маленький", da: "lille",  de: "klein",     sv: "liten",   pt: "pequeno",  pl: "mały",        es: "pequeño"   } },
  { pos: "adj.", forms: { en: "new",       ru: "новый",     da: "ny",     de: "neu",       sv: "ny",      pt: "novo",     pl: "nowy",        es: "nuevo"     } },
  { pos: "adj.", forms: { en: "old",       ru: "старый",    da: "gammel", de: "alt",       sv: "gammal",  pt: "velho",    pl: "stary",       es: "viejo"     } },
  { pos: "adj.", forms: { en: "hot",       ru: "горячий",   da: "varm",   de: "heiß",      sv: "varm",    pt: "quente",   pl: "gorący",      es: "caliente"  } },
  { pos: "adj.", forms: { en: "cold",      ru: "холодный",  da: "kold",   de: "kalt",      sv: "kall",    pt: "frio",     pl: "zimny",       es: "frío"      } },
  { pos: "adj.", forms: { en: "first",     ru: "первый",    da: "først",  de: "erste",     sv: "första",  pt: "primeiro", pl: "pierwszy",    es: "primero"   } },
  { pos: "adj.", forms: { en: "last",      ru: "последний", da: "sidst",  de: "letzte",    sv: "sista",   pt: "último",   pl: "ostatni",     es: "último"    } },
  { pos: "adj.", forms: { en: "happy",     ru: "счастливый", da: "glad",  de: "glücklich", sv: "glad",    pt: "feliz",    pl: "szczęśliwy",  es: "feliz"     } },
  { pos: "adj.", forms: { en: "beautiful", ru: "красивый",  da: "smuk",   de: "schön",     sv: "vacker",  pt: "bonito",   pl: "piękny",      es: "hermoso"   } },

  // —— numbers ————————————————————————————————————————————
  { pos: "num.", forms: { en: "one",     ru: "один",   da: "en",       de: "eins",    sv: "ett",    pt: "um",     pl: "jeden",    es: "uno"    } },
  { pos: "num.", forms: { en: "two",     ru: "два",    da: "to",       de: "zwei",    sv: "två",    pt: "dois",   pl: "dwa",      es: "dos"    } },
  { pos: "num.", forms: { en: "three",   ru: "три",    da: "tre",      de: "drei",    sv: "tre",    pt: "três",   pl: "trzy",     es: "tres"   } },
  { pos: "num.", forms: { en: "four",    ru: "четыре", da: "fire",     de: "vier",    sv: "fyra",   pt: "quatro", pl: "cztery",   es: "cuatro" } },
  { pos: "num.", forms: { en: "five",    ru: "пять",   da: "fem",      de: "fünf",    sv: "fem",    pt: "cinco",  pl: "pięć",     es: "cinco"  } },
  { pos: "num.", forms: { en: "ten",     ru: "десять", da: "ti",       de: "zehn",    sv: "tio",    pt: "dez",    pl: "dziesięć", es: "diez"   } },
  { pos: "num.", forms: { en: "hundred", ru: "сто",    da: "hundrede", de: "hundert", sv: "hundra", pt: "cem",    pl: "sto",      es: "cien"   } },

  // —— wh-words ————————————————————————————————————————————
  { pos: "adv.",  forms: { en: "what",  ru: "что",    da: "hvad",    de: "was",   sv: "vad",    pt: "o que",   pl: "co",       es: "qué"     } },
  { pos: "adv.",  forms: { en: "where", ru: "где",    da: "hvor",    de: "wo",    sv: "var",    pt: "onde",    pl: "gdzie",    es: "dónde"   } },
  { pos: "adv.",  forms: { en: "when",  ru: "когда",  da: "hvornår", de: "wann",  sv: "när",    pt: "quando",  pl: "kiedy",    es: "cuándo"  } },
  { pos: "adv.",  forms: { en: "why",   ru: "почему", da: "hvorfor", de: "warum", sv: "varför", pt: "por que", pl: "dlaczego", es: "por qué" } },
  { pos: "adv.",  forms: { en: "how",   ru: "как",    da: "hvordan", de: "wie",   sv: "hur",    pt: "como",    pl: "jak",      es: "cómo"    } },
  { pos: "pron.", forms: { en: "who",   ru: "кто",    da: "hvem",    de: "wer",   sv: "vem",    pt: "quem",    pl: "kto",      es: "quién"   } },

  // —— prepositions, conjunctions, articles ————————————————————————
  { pos: "prep.", forms: { en: "in",   ru: "в",   da: "i",     de: "in",   sv: "i",     pt: "em",     pl: "w",    es: "en"    } },
  { pos: "prep.", forms: { en: "on",   ru: "на",  da: "på",    de: "auf",  sv: "på",    pt: "sobre",  pl: "na",   es: "sobre" } },
  { pos: "prep.", forms: { en: "at",   ru: "у",   da: "ved",   de: "bei",  sv: "vid",   pt: "em",     pl: "u",    es: "en"    } },
  { pos: "prep.", forms: { en: "to",   ru: "к",   da: "til",   de: "zu",   sv: "till",  pt: "para",   pl: "do",   es: "a"     } },
  { pos: "prep.", forms: { en: "from", ru: "из",  da: "fra",   de: "von",  sv: "från",  pt: "de",     pl: "z",    es: "de"    } },
  { pos: "prep.", forms: { en: "with", ru: "с",   da: "med",   de: "mit",  sv: "med",   pt: "com",    pl: "z",    es: "con"   } },
  { pos: "prep.", forms: { en: "of",   ru: "из",  da: "af",    de: "von",  sv: "av",    pt: "de",     pl: "z",    es: "de"    } },
  { pos: "prep.", forms: { en: "for",  ru: "для", da: "for",   de: "für",  sv: "för",   pt: "para",   pl: "dla",  es: "para"  } },
  { pos: "conj.", forms: { en: "and",  ru: "и",   da: "og",    de: "und",  sv: "och",   pt: "e",      pl: "i",    es: "y"     } },
  { pos: "conj.", forms: { en: "or",   ru: "или", da: "eller", de: "oder", sv: "eller", pt: "ou",     pl: "lub",  es: "o"     } },
  { pos: "conj.", forms: { en: "but",  ru: "но",  da: "men",   de: "aber", sv: "men",   pt: "mas",    pl: "ale",  es: "pero"  } },
  { pos: "conj.", forms: { en: "so",   ru: "так", da: "så",    de: "also", sv: "så",    pt: "então",  pl: "więc", es: "así"   } },
  { pos: "art.",  forms: { en: "the",  ru: "",    da: "den",   de: "der",  sv: "den",   pt: "o",      pl: "",     es: "el"    } },
  { pos: "art.",  forms: { en: "a",    ru: "",    da: "en",    de: "ein",  sv: "en",    pt: "um",     pl: "",     es: "un"    } },
  { pos: "art.",  forms: { en: "an",   ru: "",    da: "en",    de: "ein",  sv: "en",    pt: "um",     pl: "",     es: "un"    } },

  // —— time ————————————————————————————————————————————
  { pos: "adv.", forms: { en: "today",     ru: "сегодня", da: "i dag",    de: "heute",   sv: "idag",    pt: "hoje",   pl: "dziś",     es: "hoy"        } },
  { pos: "adv.", forms: { en: "tomorrow",  ru: "завтра",  da: "i morgen", de: "morgen",  sv: "imorgon", pt: "amanhã", pl: "jutro",    es: "mañana"     } },
  { pos: "adv.", forms: { en: "yesterday", ru: "вчера",   da: "i går",    de: "gestern", sv: "igår",    pt: "ontem",  pl: "wczoraj",  es: "ayer"       } },
  { pos: "adv.", forms: { en: "now",       ru: "сейчас",  da: "nu",       de: "jetzt",   sv: "nu",      pt: "agora",  pl: "teraz",    es: "ahora"      } },
  { pos: "adv.", forms: { en: "later",     ru: "позже",   da: "senere",   de: "später",  sv: "senare",  pt: "depois", pl: "później",  es: "más tarde"  } },

  // —— idioms ————————————————————————————————————————————
  { idiom: true, forms: { en: "it's raining cats and dogs", ru: "льёт как из ведра", da: "det regner skomagerdrenge", de: "es regnet Bindfäden", sv: "det ösregnar", pt: "está chovendo canivetes", pl: "leje jak z cebra", es: "está lloviendo a cántaros" } },
  { idiom: true, forms: { en: "break a leg", ru: "ни пуха ни пера", da: "knæk og bræk", de: "Hals- und Beinbruch", sv: "lycka till", pt: "boa sorte", pl: "połamania nóg", es: "mucha mierda" } },
  { idiom: true, forms: { en: "piece of cake", ru: "проще простого", da: "en let sag", de: "ein Kinderspiel", sv: "en barnlek", pt: "moleza", pl: "bułka z masłem", es: "pan comido" } },
  { idiom: true, forms: { en: "spill the beans", ru: "выдать секрет", da: "afsløre hemmeligheden", de: "die Katze aus dem Sack lassen", sv: "låta katten ur säcken", pt: "dar com a língua nos dentes", pl: "wygadać sekret", es: "revelar el secreto" } },
];

// ---------------------------------------------------------------------------
// Indexing — for each language, map every form & alias to its Row.
// ---------------------------------------------------------------------------
export const SEED: Record<Lang, Record<string, Row>> = (() => {
  const out = {} as Record<Lang, Record<string, Row>>;
  for (const l of LANGS) out[l] = {};
  for (const row of ROWS) {
    for (const [lang, form] of Object.entries(row.forms) as [Lang, string | undefined][]) {
      if (!form) continue;
      out[lang][lower(form)] = row;
    }
    if (row.aliases) {
      for (const [lang, alts] of Object.entries(row.aliases) as [Lang, string[]][]) {
        for (const a of alts) out[lang][lower(a)] = row;
      }
    }
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Public lookup API
// ---------------------------------------------------------------------------
export type SeedHit = {
  primary: string;
  pos?: string;
  ipa?: string;
  idiom: boolean;
  examples?: { src: string; tgt: string }[];
};

/** Exact-match lookup. Case-insensitive, trimmed. */
export function seedLookup(src: Lang, tgt: Lang, q: string): SeedHit | null {
  const row = SEED[src]?.[lower(q)];
  if (!row) return null;
  const primary = row.forms[tgt];
  if (!primary) return null;
  let examples: { src: string; tgt: string }[] | undefined;
  if (row.examples) {
    const s = row.examples[src];
    const t = row.examples[tgt];
    if (s && t) examples = [{ src: s, tgt: t }];
  }
  return {
    primary,
    pos: row.pos,
    ipa: row.ipa,
    idiom: row.idiom ?? false,
    examples,
  };
}

export type PhraseHit = SeedHit & {
  /** True when fewer than 100 % of words were translated (approximate output). */
  partial: boolean;
  /** Translated-words / total-words ratio, in [0..1]. */
  coverage: number;
  /** Tokens that were not found and were passed through verbatim. */
  missingWords: string[];
};

/**
 * Multi-strategy lookup:
 *   1. Exact phrase match (handles idioms + curated multi-word phrases).
 *   2. Tokenized word-by-word — split on whitespace and punctuation,
 *      translate each non-punctuation token, keep punctuation in place,
 *      pass unknown words through verbatim.
 *
 * Returns null only if *zero* words could be translated; otherwise the
 * caller gets the best approximation, with `partial` and `missingWords`
 * so the UI can label the result honestly.
 */
export function seedLookupPhrase(src: Lang, tgt: Lang, q: string): PhraseHit | null {
  const text = q.trim();
  if (!text) return null;

  // 1) Exact phrase
  const exact = seedLookup(src, tgt, text);
  if (exact) {
    return { ...exact, partial: false, coverage: 1, missingWords: [] };
  }

  // 2) Tokenize. Split on whitespace and common punctuation, keeping the
  //    separators so we can stitch the output back together.
  const tokens = text.split(/(\s+|[.,!?;:"'()«»„""])/g).filter((t) => t.length > 0);
  const out: string[] = [];
  let translated = 0;
  let totalWords = 0;
  const missing: string[] = [];

  for (const tok of tokens) {
    if (/^[\s.,!?;:"'()«»„""]+$/.test(tok)) {
      out.push(tok);
      continue;
    }
    totalWords++;
    const row = SEED[src]?.[lower(tok)];
    if (!row) {
      out.push(tok); // unknown — keep original inline
      missing.push(tok);
      continue;
    }
    const tgtForm = row.forms[tgt];
    if (tgtForm === undefined) {
      out.push(tok);
      missing.push(tok);
    } else if (tgtForm === "") {
      // Intentionally no equivalent in target (e.g. articles in Russian).
      // Count as translated; drop the word, leaving the surrounding spaces
      // which collapse later.
      translated++;
    } else {
      out.push(tgtForm);
      translated++;
    }
  }

  if (translated === 0) return null;

  return {
    primary: out.join("").replace(/[ \t]+/g, " ").trim(),
    pos: undefined,
    ipa: undefined,
    idiom: false,
    examples: undefined,
    partial: translated < totalWords,
    coverage: totalWords === 0 ? 0 : translated / totalWords,
    missingWords: missing,
  };
}
