// config.ts — MegaXtoon series platform config
// Converted from PHP config.php

import type { Series } from './types';

export const SITE_NAME = 'MegaXtoon';

/** Generate a poster URL from series name (matches PHP posterUrl) */
export function posterUrl(name: string): string {
  // Matches the PHP posterUrl() function — uses TMDB-style poster path
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://image.tmdb.org/t/p/w500/${slug}-poster.jpg`;
}

/** Generate a background image URL (matches PHP behavior) */
export function bgUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://image.tmdb.org/t/p/w1280/${slug}-backdrop.jpg`;
}

export const SERIES_LIST: Series[] = [
  {
    slug: 'one-piece',
    name: 'One Piece',
    poster_url: 'https://image.tmdb.org/t/p/w500/one-piece-poster.jpg',
    rating: '8.7',
    year: '1999',
    seasons: '25',
    genre: 'Action,Adventure,Comedy,Fantasy',
    description:
      'Gol D. Roger was known as the "Pirate King," the strongest and most infamous being to have sailed the Grand Line. The capture and execution of Roger by the World Government brought a change throughout the world. His last words before his death revealed the existence of the greatest treasure in the world, One Piece.',
    playlist_id: '',
  },
  {
    slug: 'dragon-ball-super',
    name: 'Dragon Ball Super',
    poster_url: 'https://image.tmdb.org/t/p/w500/dragon-ball-super-poster.jpg',
    rating: '7.6',
    year: '2015',
    seasons: '2',
    genre: 'Action,Adventure,Fantasy,Martial Arts',
    description:
      'With Majin Buu now defeated and the Earth at peace, the heroes have settled into normal lives, which for Goku means being a radish farmer. But he soon learns that the universe is home to many powerful gods and warriors.',
    playlist_id: '',
  },
  {
    slug: 'attack-on-titan',
    name: 'Attack on Titan',
    poster_url: 'https://image.tmdb.org/t/p/w500/attack-on-titan-poster.jpg',
    rating: '9.0',
    year: '2013',
    seasons: '4',
    genre: 'Action,Drama,Horror,Thriller',
    description:
      'After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.',
    playlist_id: '',
  },
  {
    slug: 'naruto-shippuden',
    name: 'Naruto Shippuden',
    poster_url: 'https://image.tmdb.org/t/p/w500/naruto-shippuden-poster.jpg',
    rating: '8.3',
    year: '2007',
    seasons: '5',
    genre: 'Action,Adventure,Martial Arts,Shounen',
    description:
      'Two and a half years have passed since the end of Naruto\'s old adventures. He has trained hard with Jiraiya and Kakashi, and now returns to Konoha. But the Akatsuki are closing in on their plan to capture the Tailed Beasts.',
    playlist_id: '',
  },
  {
    slug: 'demon-slayer',
    name: 'Demon Slayer',
    poster_url: 'https://image.tmdb.org/t/p/w500/demon-slayer-poster.jpg',
    rating: '8.9',
    year: '2019',
    seasons: '4',
    genre: 'Action,Adventure,Fantasy,Supernatural',
    description:
      'A family is attacked by demons and only two members survive — Tanjiro and his sister Nezuko, who is turning into a demon slowly. Tanjiro sets out to become a demon slayer to avenge his family and cure his sister.',
    playlist_id: '',
  },
  {
    slug: 'jujutsu-kaisen',
    name: 'Jujutsu Kaisen',
    poster_url: 'https://image.tmdb.org/t/p/w500/jujutsu-kaisen-poster.jpg',
    rating: '8.7',
    year: '2020',
    seasons: '3',
    genre: 'Action,Fantasy,School,Supernatural',
    description:
      'Yuji Itadori is a boy with tremendous physical strength, though he lives a completely ordinary high school life. One day, to save a classmate from a curse, he eats the finger of Ryomen Sukuna, taking the curse into his own soul.',
    playlist_id: '',
  },
  {
    slug: 'spy-x-family',
    name: 'Spy x Family',
    poster_url: 'https://image.tmdb.org/t/p/w500/spy-x-family-poster.jpg',
    rating: '8.6',
    year: '2022',
    seasons: '3',
    genre: 'Action,Comedy,Family,Slice of Life',
    description:
      'A spy known as "Twilight" is tasked with building a family to execute a covert mission. He adopts a telepathic girl and unknowingly marries an assassin. Together, they hide their secrets while posing as a normal family.',
    playlist_id: '',
  },
  {
    slug: 'my-hero-academia',
    name: 'My Hero Academia',
    poster_url: 'https://image.tmdb.org/t/p/w500/my-hero-academia-poster.jpg',
    rating: '8.4',
    year: '2016',
    seasons: '7',
    genre: 'Action,Comedy,School,Superhero',
    description:
      'In a world where most people have super powers called "Quirks," a boy named Izuku Midoriya was born without one. But he still dreams of becoming a hero. One day he encounters All Might, the greatest hero of them all.',
    playlist_id: '',
  },
  {
    slug: 'death-note',
    name: 'Death Note',
    poster_url: 'https://image.tmdb.org/t/p/w500/death-note-poster.jpg',
    rating: '9.0',
    year: '2006',
    seasons: '1',
    genre: 'Mystery,Psychological,Supernatural,Thriller',
    description:
      'An intelligent high school student goes on a secret crusade to eliminate criminals from the world after discovering a notebook capable of killing anyone whose name is written into it.',
    playlist_id: '',
  },
  {
    slug: 'fullmetal-alchemist',
    name: 'Fullmetal Alchemist: Brotherhood',
    poster_url: 'https://image.tmdb.org/t/p/w500/fullmetal-alchemist-poster.jpg',
    rating: '9.1',
    year: '2009',
    seasons: '1',
    genre: 'Action,Adventure,Drama,Fantasy',
    description:
      'Two brothers search for a Philosopher\'s Stone after an attempt to revive their deceased mother goes awry. Their journey leads them into a world of political corruption, military conspiracies, and the dark truth about alchemy.',
    playlist_id: '',
  },
  {
    slug: 'chainsaw-man',
    name: 'Chainsaw Man',
    poster_url: 'https://image.tmdb.org/t/p/w500/chainsaw-man-poster.jpg',
    rating: '8.6',
    year: '2022',
    seasons: '2',
    genre: 'Action,Fantasy,Horror,Supernatural',
    description:
      'Denji is a teenage boy living with a Chainsaw Devil named Pochita. Due to debts his father left behind, he has been living a rock-bottom life while repaying his debt by harvesting devil corpses with Pochita.',
    playlist_id: '',
  },
  {
    slug: 'solo-leveling',
    name: 'Solo Leveling',
    poster_url: 'https://image.tmdb.org/t/p/w500/solo-leveling-poster.jpg',
    rating: '8.5',
    year: '2024',
    seasons: '2',
    genre: 'Action,Adventure,Fantasy',
    description:
      'In a world where hunters must battle deadly monsters to protect humanity, Sung Jinwoo, the weakest of all hunters, finds himself in a mysterious dungeon where he gains a secret power that allows him to level up without limit.',
    playlist_id: '',
  },
  {
    slug: 'tokyo-ghoul',
    name: 'Tokyo Ghoul',
    poster_url: 'https://image.tmdb.org/t/p/w500/tokyo-ghoul-poster.jpg',
    rating: '7.9',
    year: '2014',
    seasons: '4',
    genre: 'Action,Drama,Horror,Mystery',
    description:
      'A college student named Ken Kaneki encounters a ghoul, a creature that feeds on human flesh. After a violent encounter, he is transformed into a half-ghoul and must navigate both human and ghoul society to survive.',
    playlist_id: '',
  },
  {
    slug: 'bleach-thousand-year-blood-war',
    name: 'Bleach: Thousand-Year Blood War',
    poster_url: 'https://image.tmdb.org/t/p/w500/bleach-tybw-poster.jpg',
    rating: '9.2',
    year: '2022',
    seasons: '4',
    genre: 'Action,Adventure,Supernatural',
    description:
      'Ichigo Kurosaki and his Soul Reaper allies face their most dangerous enemy yet — the Wandenreich, a group of powerful Quincy led by Yhwach, who declares war on the Soul Society.',
    playlist_id: '',
  },
  {
    slug: 'hunter-x-hunter',
    name: 'Hunter x Hunter',
    poster_url: 'https://image.tmdb.org/t/p/w500/hunter-x-hunter-poster.jpg',
    rating: '9.0',
    year: '2011',
    seasons: '6',
    genre: 'Action,Adventure,Fantasy,Martial Arts',
    description:
      'Gon Freecss discovers that his absent father is a world-renowned Hunter. Determined to follow in his footsteps, Gon sets out on his own adventure, passing the rigorous Hunter Exam and entering a world of danger and discovery.',
    playlist_id: '',
  },
  {
    slug: 'mob-psycho-100',
    name: 'Mob Psycho 100',
    poster_url: 'https://image.tmdb.org/t/p/w500/mob-psycho-100-poster.jpg',
    rating: '8.6',
    year: '2016',
    seasons: '3',
    genre: 'Action,Comedy,Supernatural',
    description:
      'Shigeo "Mob" Kageyama is an esper with immense psychic power. To keep his powers under control, he lives a quiet life as an assistant to a con-man "psychic," but his emotions can unleash catastrophic destruction.',
    playlist_id: '',
  },
  {
    slug: 'vinland-saga',
    name: 'Vinland Saga',
    poster_url: 'https://image.tmdb.org/t/p/w500/vinland-saga-poster.jpg',
    rating: '8.8',
    year: '2019',
    seasons: '3',
    genre: 'Action,Adventure,Drama,Historical',
    description:
      'Thorfinn is son to one of the Vikings\' greatest warriors, but when his father is killed in battle by the mercenary leader Askeladd, he swears to get his revenge. Thorfinn joins Askeladd\'s band in order to challenge him to a duel.',
    playlist_id: '',
  },
];

/** Find a series by its URL slug. */
export function getSeriesBySlug(slug: string): Series | undefined {
  return SERIES_LIST.find((s) => s.slug === slug);
}
