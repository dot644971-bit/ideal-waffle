// config.ts — MegaXtoon series platform config

import type { Series } from './types';

export const SITE_NAME = 'MegaXtoon';

/**
 * YouTube Data API v3 key.
 * Set NEXT_PUBLIC_YOUTUBE_API_KEY in your .env.local file.
 * NEXT_PUBLIC_ prefix exposes it to the browser — for extra security,
 * use YOUTUBE_API_KEY (without prefix) and only call it from the
 * /api/playlist server route.
 */
export const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || '';

export type SeriesWithExtras = Series & {
  episodes?: number;
  cast?: string;
};

export function posterUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://image.tmdb.org/t/p/w500/${slug}-poster.jpg`;
}

export function bgUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://image.tmdb.org/t/p/w1280/${slug}-backdrop.jpg`;
}

/** Find a series by its slug (case-insensitive). */
export function getSeriesBySlug(slug: string): SeriesWithExtras | undefined {
  if (!slug) return undefined;
  const lower = slug.toLowerCase();
  return SERIES_LIST.find(
    (s) => s.slug.toLowerCase() === lower
  );
}

export const SERIES_LIST: SeriesWithExtras[] = [
  {
    slug: 'gumball',
    name: 'The Amazing World of Gumball',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BNmEwYzNhODgtZDc2Yi00MDAyLTliNWYtMDRkMThmMWE0NGNkXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    rating: '8.7',
    year: '2011',
    seasons: '6',
    genre: 'Komedi, Macera',
    description: 'Gumball Watterson ve ailesiyle Elmore şehrindeki çılgın gündelik maceralar.',
    playlist_id: 'PLC8MXDuDxrrsyqbTa9nK_gq8qmiMfR3sM',
    episodes: 240,
    cast: 'Jacob Hopkins, Terrell Ransom Jr.',
  },
  {
    slug: 'theloudhouse',
    name: 'The Loud House',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BZjlkMmQ5YzItZGRmMy00NjVjLWIwYmMtMzJjM2QxM2Q1OThkXkEyXkFqcGc@._V1_.jpg',
    rating: '7.6',
    year: '2016',
    seasons: '7',
    genre: 'Komedi, Macera',
    description: '10 kardeşin ortası Lincoln Loud, kaotik ev hayatında hayatta kalmaya çalışır.',
    playlist_id: 'PLgrisE0MOLgRBNWk2cbO035kQ0hHA11HC',
    episodes: 130,
    cast: 'Asher Bishop, Grey Griffin',
  },
  {
    slug: 'ben10ultimatealien',
    name: 'Ben 10 Alien Force',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BOGQ5YWFjYjItODE5OC00ZDQxLTk5ZmYtNzY0YzM4NjIyMWFlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    rating: '8.1',
    year: '2008',
    seasons: '3',
    genre: 'Aksiyon, Macera',
    description: 'Ben Tennyson 15 yaşında uzaylı tehditlerle tekrar savaşa giriyor.',
    playlist_id: 'PLD7E4B63582E0479D',
    episodes: 46,
    cast: 'Yuri Lowenthal, Ashley Johnson',
  },
  {
    slug: 'beastboy',
    name: 'Beast Boy Lone Wolf',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BYzQxY2FjOWItNjc0Mi00NGNjLTg5NGYtNDBhNzdjMDBmN2Q4XkEyXkFqcGc@._V1_.jpg',
    rating: '7.4',
    year: '2023',
    seasons: '1',
    genre: 'Aksiyon, Macera',
    description: 'Yeni nesil Beyblade turnuvaları ve efsanevi X dönüşümü.',
    playlist_id: 'PLTJkpTzCerNrGfBN3Li4vR3Uegu1-TglA',
    episodes: 38,
    cast: 'Takuma Nagare, Bird Akazawa',
  },
  {
    slug: 'SpongeBobSquarePants',
    name: 'SpongeBob SquarePants Haloween',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BYjJmMjBkZjMtZThiZS00Nzk3LWJlN2UtYmE5ZjkyNjJiZjgxXkEyXkFqcGc@._V1_QL75_UY281_CR1,0,190,281_.jpg',
    rating: '8.2',
    year: '1999',
    seasons: '14',
    genre: 'Komedi, Macera',
    description: "Bikini Bottom'da yaşayan süngerin çılgın sualtı maceraları.",
    playlist_id: 'PLShpyCq1QZaynW4FN2Nbf-XnlPz0RNV7L',
    episodes: 280,
    cast: 'Tom Kenny, Bill Fagerbakke',
  },
  {
    slug: 'RegularShowLostTapes',
    name: 'Regular Show lost Tapes',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BNDY5ZTA4ZGQtMzE2Ni00YjQ1LTk4ODktZGQwYTgwYWYxNjUwXkEyXkFqcGc@._V1_.jpg',
    rating: '8.4',
    year: '2010',
    seasons: '8',
    genre: 'Komedi, Macera',
    description: "Mordecai ve Rigby'nin sıradan bir parkta yaşadığı olağandışı olaylar.",
    playlist_id: 'PLTQesLu3nTxsDo01ZXTZhx4Gv3WcFjvcS',
    episodes: 261,
    cast: 'J.G. Quintel, William Salyers',
  },
  {
    slug: 'AdventureTime',
    name: 'Adventure Time',
    poster_url: 'https://occ-0-753-1007.1.nflxso.net/dnm/api/v6/XsrytRUxks8BtTRf9HNlZkW2tvY/AAAABRV_sMrvu3tWVViD3FG-maRs7pdM01pKVjISgK7zVIeTEQTF0E0gX2VGS-crJoN5YxzYRZIZrKfCG2W26ZRo34i3acw6fdOzwkFr6YJbYufEGQM0v8be2W-M8da2L9HC.jpg?r=7fb',
    rating: '8.6',
    year: '2010',
    seasons: '10',
    genre: 'Macera, Fantezi',
    description: "Finn ve Jake'in Ooo Diyarı'ndaki epik maceraları.",
    playlist_id: 'PLLIU9nFd9IrEsR2bcrJEGERa_91aYntWX',
    episodes: 283,
    cast: 'Jeremy Shada, John DiMaggio',
  },
  {
    slug: 'MutantNinjaTurtles',
    name: 'Teenage Mutant Ninja Turtles',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BZTA0ZTlkMGItNTJmYy00YTVkLTgwMDktZTJiNTE5NmQ0ZWI4XkEyXkFqcGc@._V1_.jpg',
    rating: '8.0',
    year: '2012',
    seasons: '5',
    genre: 'Aksiyon, Macera',
    description: "Dört kaplumbağa ninja New York'u korumak için gece karanlığına çıkıyor.",
    playlist_id: 'PL9FtL6eB-Npz_3om-MWlUXWQ87eWzaxl9',
    episodes: 124,
    cast: 'Sean Astin, Greg Cipes',
  },
  {
    slug: 'TransformersEarthSpark',
    name: 'Transformers EarthSpark',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BNjAxNmRhZjctYTk1Ni00MGJjLThkY2YtNjdmODJjYTMwOGJlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    rating: '7.2',
    year: '2022',
    seasons: '2',
    genre: 'Aksiyon, Sci-Fi',
    description: 'Dünyada doğan ilk Terran Transformers ile insanlığın yeni bir birlikteliği.',
    playlist_id: 'PL7VEq3tXc6hsvHKfzdknf8GViPEr5JW5W',
    episodes: 26,
    cast: 'Zeno Robinson, Sydney Mikayla',
  },
  {
    slug: 'Ninjago',
    name: 'Ninjago',
    poster_url: 'https://ninjagoizlesene.com.tr/wp-content/uploads/2026/03/Crystalized-Poster-scaled.jpg',
    rating: '7.8',
    year: '2011',
    seasons: '15',
    genre: 'Aksiyon, Macera',
    description: "Spinjitzu ustası Garmadon'a karşı savaşan dört ninjanın destanı.",
    playlist_id: 'PLwf-K0eNy8ANtvsRvluuNfPIEd3db5r8k',
    episodes: 200,
    cast: 'Vincent Tong, Michael Adamthwaite',
  },
  {
    slug: 'gravityfalls',
    name: 'Gravity Falls',
    poster_url: 'https://m.media-amazon.com/images/I/917WCiqRo6L._AC_UF1000,1000_QL80_.jpg',
    rating: '8.9',
    year: '2012',
    seasons: '2',
    genre: 'Gizem, Komedi',
    description: "Dipper ve Mabel'in büyükannesinin yanında geçirdikleri paranormal yaz tatili.",
    playlist_id: 'PL5VwaAJ3JDSHr9ZnkEgu8GLC_x1JxrPcc',
    episodes: 40,
    cast: 'Jason Ritter, Kristen Schaal',
  },
  {
    slug: 'stevenuniverse',
    name: 'Steven Universe',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BZGJjMmI3ZDMtZTgyNi00MTZhLWE2ZjAtN2Q4YTUyMTg4OGY1XkEyXkFqcGc@._V1_.jpg',
    rating: '8.2',
    year: '2013',
    seasons: '5',
    genre: 'Macera, Müzikal',
    description: "Yarı insan yarı Kristal Mücevher olan Steven'ın dünyayı kurtarma yolculuğu.",
    playlist_id: 'PLIw4JuB69kRqSaga1p7kzPx99UOgrvRMA',
    episodes: 160,
    cast: 'Zach Callison, Estelle',
  },
  {
    slug: 'FairlyOdd',
    name: 'The Fairly OddParents',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BY2RlNWMwZmUtMjM4MC00MDczLTk3NjktYTg2OTNiNThhNmNhXkEyXkFqcGc@._V1_.jpg',
    rating: '7.5',
    year: '2001',
    seasons: '10',
    genre: 'Komedi, Fantezi',
    description: "Timmy Turner'ın peri vaftiz anne babaları ile yaptığı dilekler hep çığırından çıkıyor.",
    playlist_id: 'PLZb1SVCX0ajoclQynrUz26jQm3aJ7Y0uS',
    episodes: 172,
    cast: 'Tara Strong, Daran Norris',
  },
  {
    slug: 'clarence',
    name: 'Clarence',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BMjNhYWQ3ZjgtYWQ2Ny00MzQ4LWFiODgtMWJkZDYwYWE1NDZmXkEyXkFqcGc@._V1_.jpg',
    rating: '7.4',
    year: '2014',
    seasons: '3',
    genre: 'Komedi, Macera',
    description: "Aşırı iyimser çocuk Clarence'ın sıradan gündelik hayatın tadını çıkaran maceraları.",
    playlist_id: 'PLg6KfZlgBuDVJM8_fYqLiBivHRmsu_lOj',
    episodes: 121,
    cast: 'Spencer Rothbell, Tom Kenny',
  },
  {
    slug: 'mira',
    name: 'Miraculous Ladybug',
    poster_url: 'https://image.tmdb.org/t/p/w500/mwAJcSPtuRddU8AeL9lup5jE0Bn.jpg',
    rating: '7.6',
    year: '2015',
    seasons: '5',
    genre: 'Macera, Romantik',
    description: "Paris'i koruyan iki genç kahraman — Ladybug ve Cat Noir.",
    playlist_id: 'PLaMHyq8hhBW1o-vm10TyFjxtjNG2po9ze',
    episodes: 130,
    cast: 'Cristina Vee, Bryce Papenbrook',
  },
  {
    slug: 'codename',
    name: 'Codename: Kids Next Door Shorts',
    poster_url: 'https://www.tvtime.com/_next/image?url=https%3A%2F%2Fartworks.thetvdb.com%2Fbanners%2Fposters%2F71685-2.jpg&w=640&q=75',
    rating: '7.7',
    year: '2002',
    seasons: '6',
    genre: 'Komedi, Macera',
    description: 'Beş çocuktan oluşan gizli ajan ekibi yetişkinlere karşı savaşıyor.',
    playlist_id: 'PL258poKABt5XHZ4aHMIRme6M9ichpplwg',
    episodes: 78,
    cast: 'Benjamin Diskin, Rachael MacFarlane',
  },
  {
    slug: 'circus',
    name: 'The Amazing Digital Circus',
    poster_url: 'https://fr.web.img5.acsta.net/c_310_420/img/e0/d1/e0d113764c9c629f20a681041ab4e01c.jpg',
    rating: '8.3',
    year: '2023',
    seasons: '1',
    genre: 'Komedi, Gizem',
    description: 'Dijital bir sirkde mahsur kalan insanların var olmaya çalışması.',
    playlist_id: 'PLHovnlOusNLgvAbnxluXCVB3KLj8e4QB-',
    episodes: 6,
    cast: 'Lizzie Freeman, Michael Kovach',
  },
  {
    slug: 'sonicprime',
    name: 'Sonic Prime',
    poster_url: 'https://preview.redd.it/what-makes-sonic-prime-forgettable-than-the-other-sonic-v0-vka3qbs2w7ye1.png?width=640&crop=smart&auto=webp&s=3dd7cbb9b2bacdd621b34b37d25904ca536ab061',
    rating: '6.9',
    year: '2022',
    seasons: '3',
    genre: 'Aksiyon, Macera',
    description: "Sonic çoklu evrende yolculuk ederek arkadaşlarını ve Shatterverse'ü kurtarıyor.",
    playlist_id: 'PLl5oejYNsf65FB-cWNS2JKsXWyEobLszM',
    episodes: 24,
    cast: 'Deven Mack, Brian Drummond',
  },
  {
    slug: 'ttg',
    name: 'Teen Titans Go!',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BMjE5MjMzOTc1Ml5BMl5BanBnXkFtZTcwNDQxMDY5OQ@@._V1_FMjpg_UX1000_.jpg',
    rating: '5.8',
    year: '2013',
    seasons: '8',
    genre: 'Komedi, Aksiyon',
    description: "Teen Titans'ın gündelik kahramanlık dışı komik maceralarını anlatan spin-off.",
    playlist_id: 'PLd3-CCCcbQeKcs5A_b8x45cTjZ0TFk-yn',
    episodes: 350,
    cast: 'Greg Cipes, Scott Menville',
  },
  {
    slug: 'kiff',
    name: 'Kiff',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BMjA1NjIwNTMtY2Q2Ny00ZmVjLThkODItODg1ZjJmN2FjMDUzXkEyXkFqcGc@._V1_.jpg',
    rating: '7.8',
    year: '2020',
    seasons: '2',
    genre: 'Komedi',
    description: 'Bir ortaokul öğrencisinin maceraları.',
    playlist_id: 'PLCGQDmE5nVHriQOifbcVibE_gKshXJIhd',
    episodes: 20,
    cast: 'Kiff, Kiff',
  },
  {
    slug: 'tomandjerry',
    name: 'Tom and Jerry',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BODY2YWI1OTAtY2FhZS00MGI1LTk0YjUtYmE3MDk0OGFkMWUyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    rating: '8.7',
    year: '1940',
    seasons: '1',
    genre: 'Komedi',
    description: 'Kedi Tom ve fare Jerry arasındaki hiç bitmeyen kovalamaca.',
    playlist_id: 'PLeWt4i89tkloEBo3eyC_ZKKNrwL277eG_',
    episodes: 161,
    cast: 'William Hanna, Joseph Barbera',
  },
  {
    slug: 'batmanunlimited',
    name: 'Batman Unlimited',
    poster_url: 'https://play-lh.googleusercontent.com/RWN0fec0a0lc8Y-VBfDHcnN-L3OrwE-xcu3SN0dQ8UWrdpn_B-LI0OxnHOKXZysB5hPZ',
    rating: '7.2',
    year: '2010',
    seasons: '1',
    genre: 'Aksiyon, Animasyon',
    description: "Batman'ın ve diğer super kahramanların maceraları.",
    playlist_id: 'PLLDIqfKdBJnOcW48eRV9A0sweGS-Ex8NM',
    episodes: 10,
    cast: 'James Arnold Taylor, Maryke Hendrikse',
  },
  {
    slug: 'thundermans',
    name: 'The Thundermans',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BMzUyNzE2NTgtNzM0Ny00YzBjLWJmZjAtMmMwYmE5YTg1MjEyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    rating: '6.8',
    year: '2013',
    seasons: '4',
    genre: 'Komedi, Aksiyon',
    description: 'Süper güçlere sahip Thunderman ailesinin sıradan görünmeye çalıştığı hayatı.',
    playlist_id: 'PLOmUMd_oRO0uFCW9fmB8RrqF7lgOtN0p4',
    episodes: 97,
    cast: 'Kira Kosarin, Jack Griffo',
  },
];
