// Starter content. Copied into the pool the first time the server starts
// without a pool file. After that the pool is edited on /admin.

export const lmsData = [
  {
    topic: 'Deutsche Bundesländer',
    items: [
      'Bayern', 'Baden-Württemberg', 'Hessen', 'Nordrhein-Westfalen',
      'Niedersachsen', 'Sachsen', 'Berlin', 'Hamburg', 'Bremen',
      'Schleswig-Holstein', 'Rheinland-Pfalz', 'Saarland', 'Brandenburg',
      'Mecklenburg-Vorpommern', 'Thüringen', 'Sachsen-Anhalt'
    ]
  },
  {
    topic: 'Europäische Hauptstädte',
    items: [
      'Berlin', 'Paris', 'London', 'Madrid', 'Rom', 'Wien', 'Amsterdam',
      'Brüssel', 'Lissabon', 'Athen', 'Warschau', 'Prag'
    ]
  },
  {
    topic: 'Marvel Superhelden',
    items: [
      'Spider-Man', 'Iron Man', 'Captain America', 'Thor', 'Hulk',
      'Black Widow', 'Hawkeye', 'Doctor Strange', 'Black Panther',
      'Scarlet Witch', 'Ant-Man', 'Vision'
    ]
  },
  {
    topic: 'Automarken',
    items: [
      'BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Porsche', 'Ford',
      'Toyota', 'Honda', 'Ferrari', 'Lamborghini', 'Tesla', 'Opel'
    ]
  },
  {
    topic: 'Obstsorten',
    items: [
      'Apfel', 'Birne', 'Banane', 'Orange', 'Erdbeere', 'Kirsche',
      'Traube', 'Mango', 'Ananas', 'Wassermelone', 'Pfirsich', 'Kiwi'
    ]
  }
];

export const millionaireData = [
  { q: 'Wie viele Bundesländer hat Deutschland?', o: ['14', '16', '18', '20'], a: 1 },
  { q: 'Welcher Planet ist der Sonne am nächsten?', o: ['Venus', 'Mars', 'Merkur', 'Erde'], a: 2 },
  { q: 'Wer malte die Mona Lisa?', o: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Donatello'], a: 1 },
  { q: 'In welchem Jahr fiel die Berliner Mauer?', o: ['1987', '1989', '1991', '1990'], a: 1 },
  { q: 'Wie heißt die Hauptstadt von Australien?', o: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], a: 2 },
  { q: 'Welches Element hat das chemische Symbol "Au"?', o: ['Silber', 'Gold', 'Kupfer', 'Aluminium'], a: 1 },
  { q: 'Wie viele Spieler hat eine Fußballmannschaft auf dem Feld?', o: ['10', '11', '12', '9'], a: 1 },
  { q: 'Wer schrieb "Romeo und Julia"?', o: ['Goethe', 'Shakespeare', 'Schiller', 'Dickens'], a: 1 },
  { q: 'Was ist die Quadratwurzel aus 144?', o: ['10', '11', '12', '14'], a: 2 },
  { q: 'Welches Land hat die meisten Einwohner?', o: ['USA', 'Indien', 'China', 'Russland'], a: 2 },
  { q: 'In welchem Jahr wurde das erste iPhone vorgestellt?', o: ['2005', '2006', '2007', '2008'], a: 2 },
  { q: 'Welcher Ozean ist der größte?', o: ['Atlantik', 'Indischer Ozean', 'Pazifik', 'Arktischer Ozean'], a: 2 },
  { q: 'Wie heißt der längste Fluss der Welt?', o: ['Amazonas', 'Nil', 'Donau', 'Mississippi'], a: 1 },
  { q: 'Welches Tier ist das schnellste an Land?', o: ['Löwe', 'Gepard', 'Pferd', 'Antilope'], a: 1 },
  { q: 'Wie viele Zähne hat ein erwachsener Mensch?', o: ['28', '30', '32', '34'], a: 2 },
  { q: 'Wer war der erste Mensch auf dem Mond?', o: ['Buzz Aldrin', 'Neil Armstrong', 'Michael Collins', 'Yuri Gagarin'], a: 1 },
  { q: 'Wie heißt das größte Organ des Menschen?', o: ['Leber', 'Herz', 'Haut', 'Lunge'], a: 2 },
  { q: 'In welcher Stadt steht der Eiffelturm?', o: ['London', 'Rom', 'Paris', 'Berlin'], a: 2 },
  { q: 'Welches Gas atmen Pflanzen ein?', o: ['Sauerstoff', 'Stickstoff', 'Kohlendioxid', 'Wasserstoff'], a: 2 },
  { q: 'Wie viele Kontinente gibt es?', o: ['5', '6', '7', '8'], a: 2 },
  { q: 'Welche Farbe hat Chlorophyll?', o: ['Rot', 'Blau', 'Grün', 'Gelb'], a: 2 },
  { q: 'Wer entwickelte die Relativitätstheorie?', o: ['Newton', 'Einstein', 'Hawking', 'Bohr'], a: 1 },
  { q: 'Wie heißt die Währung in Japan?', o: ['Yuan', 'Won', 'Yen', 'Rupie'], a: 2 },
  { q: 'Welches Land ist für die Pyramiden bekannt?', o: ['Mexiko', 'Ägypten', 'Peru', 'China'], a: 1 },
  { q: 'Was ist H2O?', o: ['Sauerstoff', 'Wasserstoff', 'Wasser', 'Helium'], a: 2 },
  { q: 'Wie viele Minuten hat eine Stunde?', o: ['30', '45', '60', '90'], a: 2 },
  { q: 'Welche Sportart wird bei Wimbledon gespielt?', o: ['Golf', 'Tennis', 'Cricket', 'Rugby'], a: 1 },
  { q: 'Wie heißt der höchste Berg der Welt?', o: ['K2', 'Mount Everest', 'Kilimandscharo', 'Mont Blanc'], a: 1 },
  { q: 'Welches Instrument hat 88 Tasten?', o: ['Gitarre', 'Klavier', 'Orgel', 'Akkordeon'], a: 1 },
  { q: 'In welchem Jahr begann der Zweite Weltkrieg?', o: ['1937', '1938', '1939', '1940'], a: 2 },
];

export const higherLowerData = [
  {
    topic: 'Einwohnerzahl deutscher Städte',
    unit: 'Einwohner (Tausend)',
    items: [
      { label: 'Berlin', value: 3645 },
      { label: 'München', value: 1472 },
      { label: 'Hamburg', value: 1841 },
      { label: 'Frankfurt', value: 753 },
      { label: 'Stuttgart', value: 635 },
      { label: 'Düsseldorf', value: 619 },
      { label: 'Leipzig', value: 587 },
      { label: 'Dortmund', value: 588 },
    ]
  },
  {
    topic: 'Erscheinungsjahr von Filmen',
    unit: 'Jahr',
    items: [
      { label: 'Titanic', value: 1997 },
      { label: 'Avatar', value: 2009 },
      { label: 'Der Pate', value: 1972 },
      { label: 'Inception', value: 2010 },
      { label: 'Matrix', value: 1999 },
      { label: 'Forrest Gump', value: 1994 },
      { label: 'Pulp Fiction', value: 1994 },
      { label: 'Joker', value: 2019 },
    ]
  },
  {
    topic: 'Kalorien pro 100g',
    unit: 'kcal',
    items: [
      { label: 'Apfel', value: 52 },
      { label: 'Banane', value: 89 },
      { label: 'Schokolade', value: 546 },
      { label: 'Reis', value: 130 },
      { label: 'Hähnchenbrust', value: 165 },
      { label: 'Pommes', value: 312 },
      { label: 'Salat', value: 15 },
      { label: 'Pizza', value: 266 },
    ]
  }
];

export const jeopardyData = [
  {
    name: 'Geschichte',
    questions: [
      { q: 'In welchem Jahr wurde die Berliner Mauer gebaut?', a: '1961' },
      { q: 'Wer war der erste deutsche Bundeskanzler?', a: 'Konrad Adenauer' },
      { q: 'In welchem Jahr endete der Erste Weltkrieg?', a: '1918' },
      { q: 'Welcher römische Kaiser ließ den Limes bauen?', a: 'Hadrian' },
      { q: 'In welchem Jahr wurde das Deutsche Reich gegründet?', a: '1871' },
    ]
  },
  {
    name: 'Geographie',
    questions: [
      { q: 'Wie heißt der längste Fluss Deutschlands?', a: 'Rhein' },
      { q: 'Welches ist das kleinste Bundesland?', a: 'Bremen' },
      { q: 'An wie viele Länder grenzt Deutschland?', a: '9' },
      { q: 'Wie heißt der höchste Berg Deutschlands?', a: 'Zugspitze' },
      { q: 'Welche Stadt ist die nördlichste Landeshauptstadt?', a: 'Kiel' },
    ]
  },
  {
    name: 'Sport',
    questions: [
      { q: 'Wie oft wurde Deutschland Fußball-Weltmeister?', a: '4' },
      { q: 'In welcher Stadt fanden 1972 die Olympischen Spiele statt?', a: 'München' },
      { q: 'Wie heißt der erfolgreichste deutsche F1-Fahrer?', a: 'Michael Schumacher' },
      { q: 'Welcher Verein hat die meisten Bundesliga-Titel?', a: 'Bayern München' },
      { q: 'Wie lang ist ein Marathon in Kilometern?', a: '42,195 km' },
    ]
  },
  {
    name: 'Wissenschaft',
    questions: [
      { q: 'Welches chemische Element hat die Ordnungszahl 1?', a: 'Wasserstoff' },
      { q: 'Wie heißt die Einheit für elektrischen Widerstand?', a: 'Ohm' },
      { q: 'Welcher Planet hat die meisten Monde?', a: 'Saturn' },
      { q: 'Was bedeutet DNA ausgeschrieben?', a: 'Desoxyribonukleinsäure' },
      { q: 'Wie schnell ist Lichtgeschwindigkeit (gerundet)?', a: '300.000 km/s' },
    ]
  },
  {
    name: 'Unterhaltung',
    questions: [
      { q: 'Wer singt "99 Luftballons"?', a: 'Nena' },
      { q: 'Wie heißt der Zauberer bei Harry Potter mit Nachnamen?', a: 'Potter' },
      { q: 'Welche Band sang "Durch den Monsun"?', a: 'Tokio Hotel' },
      { q: 'Wie heißt die Hauptfigur in "Der Herr der Ringe"?', a: 'Frodo' },
      { q: 'Wer moderierte ursprünglich "Wetten, dass..?"?', a: 'Frank Elstner' },
    ]
  },
  {
    name: 'Essen & Trinken',
    questions: [
      { q: 'Aus welchem Land kommt Sushi?', a: 'Japan' },
      { q: 'Welches Getränk wird aus Hopfen hergestellt?', a: 'Bier' },
      { q: 'Was ist die Hauptzutat von Guacamole?', a: 'Avocado' },
      { q: 'Aus welcher Region kommt Champagner?', a: 'Champagne (Frankreich)' },
      { q: 'Welches Gewürz macht Essen scharf?', a: 'Chili / Capsaicin' },
    ]
  }
];

export const geoData = [
  {
    name: 'Deutsche Städte',
    map: 'de' as const,
    minKm: 400,
    places: [
      { name: 'Berlin', lat: 52.52, lng: 13.405 },
      { name: 'Hamburg', lat: 53.551, lng: 9.993 },
      { name: 'München', lat: 48.137, lng: 11.575 },
      { name: 'Köln', lat: 50.938, lng: 6.96 },
      { name: 'Frankfurt am Main', lat: 50.11, lng: 8.682 },
      { name: 'Stuttgart', lat: 48.776, lng: 9.183 },
      { name: 'Düsseldorf', lat: 51.227, lng: 6.774 },
      { name: 'Leipzig', lat: 51.34, lng: 12.375 },
      { name: 'Dresden', lat: 51.05, lng: 13.738 },
      { name: 'Bremen', lat: 53.079, lng: 8.802 },
      { name: 'Hannover', lat: 52.376, lng: 9.732 },
      { name: 'Nürnberg', lat: 49.452, lng: 11.077 },
      { name: 'Kiel', lat: 54.323, lng: 10.123 },
      { name: 'Rostock', lat: 54.092, lng: 12.099 },
      { name: 'Freiburg im Breisgau', lat: 47.999, lng: 7.842 },
      { name: 'Erfurt', lat: 50.978, lng: 11.029 },
      { name: 'Saarbrücken', lat: 49.234, lng: 6.997 },
      { name: 'Passau', lat: 48.575, lng: 13.461 },
      { name: 'Flensburg', lat: 54.794, lng: 9.446 },
      { name: 'Görlitz', lat: 51.152, lng: 14.987 },
    ],
  },
];

// Songrätsel starter category (iTunes track data, 2026-11-10).
export const songData = [
  {
    name: 'Hits, die jeder kennt',
    songs: [
      {
        "trackId": 1526194192,
        "title": "Mr. Brightside",
        "artist": "The Killers",
        "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/1a/5a/071a5aee-6e42-060c-35b9-6a6e45b9ea59/06UMGIM10441.rgb.jpg/300x300bb.jpg",
        "preview": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/5b/17/4e/5b174e80-1047-7214-1077-d822ba1f9520/mzaf_5975692497663881329.plus.aac.p.m4a",
        "offset": 0
      },
      {
        "trackId": 1193700923,
        "title": "Shape of You",
        "artist": "Ed Sheeran",
        "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/20/03/4c/20034cdb-b2b1-74a7-2ec0-521ccf471bbd/190295851286.jpg/300x300bb.jpg",
        "preview": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c8/a1/35/c8a1354a-28aa-639f-0d5a-ff843069a4b7/mzaf_7018698804833750599.plus.aac.p.m4a",
        "offset": 0
      },
      {
        "trackId": 6781027645,
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/62/2e/97/622e97c4-d620-2ae1-2a47-a32e16a01492/602567988847.jpg/300x300bb.jpg",
        "preview": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/10/de/4410de9b-4b10-c763-baf8-c4911c032248/mzaf_3700911105004619705.plus.aac.p.m4a",
        "offset": 0
      },
      {
        "trackId": 336644237,
        "title": "Billie Jean (Single Version)",
        "artist": "Michael Jackson",
        "cover": "https://is1-ssl.mzstatic.com/image/thumb/Features125/v4/2a/82/a5/2a82a59b-6e79-7c39-761a-c1d3b82e93cb/dj.dzbxcmnk.jpg/300x300bb.jpg",
        "preview": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a0/20/1b/a0201bf3-e6a7-f2fc-a836-a536593c3e51/mzaf_3717140176449046337.plus.aac.p.m4a",
        "offset": 0
      },
      {
        "trackId": 1586410661,
        "title": "Smells Like Teen Spirit (Remastered)",
        "artist": "Nirvana",
        "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5c/53/5d/5c535d31-9c80-c752-3ea3-887615eb7d51/21UM1IM09416.rgb.jpg/300x300bb.jpg",
        "preview": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b0/36/9c/b0369c24-5047-1f93-a228-64ecec779cdc/mzaf_17479720470163953122.plus.aac.p.m4a",
        "offset": 0
      },
      {
        "trackId": 403037877,
        "title": "Rolling In the Deep",
        "artist": "Adele",
        "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/f8/df/0a/f8df0ac9-ae76-9dae-86d3-4e913fc54fb1/634904152062.png/300x300bb.jpg",
        "preview": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/84/ab/e5/84abe549-c9d6-3de2-cdd0-90e9256a637e/mzaf_7958095177960014950.plus.aac.p.m4a",
        "offset": 0
      },
      {
        "trackId": 943946671,
        "title": "Uptown Funk (feat. Bruno Mars)",
        "artist": "Mark Ronson",
        "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/7e/30/c5/7e30c572-aa47-5f7b-c6fd-42d50cd2c56d/886444959797.jpg/300x300bb.jpg",
        "preview": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/91/99/1f/91991fe5-aa77-87e4-edbc-6d68c95e5f18/mzaf_10685317694850942114.plus.aac.p.m4a",
        "offset": 0
      },
      {
        "trackId": 1544490669,
        "title": "Atemlos durch die Nacht",
        "artist": "Helene Fischer",
        "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/70/47/d8/7047d8cd-f85a-a37f-5ee5-0e54438f8595/13UAAIM81444.rgb.jpg/300x300bb.jpg",
        "preview": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/be/62/9f/be629f52-58c9-c5e9-a871-b25c826cfe9d/mzaf_11136940745057536408.plus.aac.p.m4a",
        "offset": 0
      },
      {
        "trackId": 1533513537,
        "title": "Seven Nation Army",
        "artist": "The White Stripes",
        "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/07/25/09/0725098a-09f4-f240-e551-94384a590371/886448799009.jpg/300x300bb.jpg",
        "preview": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/fe/2d/58/fe2d587f-6344-3fb3-43f7-d318a6253dcc/mzaf_16825320951570507954.plus.aac.p.m4a",
        "offset": 0
      }
    ],
  },
];
