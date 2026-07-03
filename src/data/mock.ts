import type { Interest, Member, SocialEvent } from '../types'

export const INTERESTS: Interest[] = [
  { id: 'music', label: 'Live Music', emoji: '🎸', color: '#a78bfa' },
  { id: 'running', label: 'Running', emoji: '🏃', color: '#34d399' },
  { id: 'food', label: 'Foodies', emoji: '🍜', color: '#fbbf24' },
  { id: 'tech', label: 'Tech', emoji: '💻', color: '#60a5fa' },
  { id: 'art', label: 'Art & Design', emoji: '🎨', color: '#f472b6' },
  { id: 'football', label: 'Football', emoji: '⚽', color: '#4ade80' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🪩', color: '#c084fc' },
  { id: 'photo', label: 'Photography', emoji: '📷', color: '#22d3ee' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮', color: '#f87171' },
  { id: 'yoga', label: 'Yoga', emoji: '🧘', color: '#2dd4bf' },
]

export const INTEREST_BY_ID: Record<string, Interest> = Object.fromEntries(
  INTERESTS.map((i) => [i.id, i]),
)

const GENERIC_INTEREST: Interest = { id: 'pin', label: 'Meetup', emoji: '📍', color: '#94a3b8' }

/** Like INTEREST_BY_ID but safe for categories from remote pins. */
export function interestFor(category: string): Interest {
  return INTEREST_BY_ID[category] ?? GENERIC_INTEREST
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// Demo city: Paris
export const CITY_CENTER = { lat: 48.8589, lng: 2.3469 }

export const EVENTS: SocialEvent[] = [
  {
    id: 'e1',
    title: 'Sunset Run — Seine Banks',
    venue: 'Pont Alexandre III',
    category: 'running',
    lat: 48.8639,
    lng: 2.3136,
    startsInMin: 0,
    durationMin: 90,
    description: 'Easy-pace 8K along the river. All levels welcome — we regroup at every bridge.',
    attendees: [],
  },
  {
    id: 'e2',
    title: 'Indie Synth Night',
    venue: 'Canal Saint-Martin',
    category: 'music',
    lat: 48.8721,
    lng: 2.365,
    startsInMin: 45,
    durationMin: 180,
    description: 'Three local bands, analog synths, tiny venue. First drink on the organizers.',
    attendees: [],
  },
  {
    id: 'e3',
    title: 'Street Food Crawl — Le Marais',
    venue: 'Rue des Rosiers',
    category: 'food',
    lat: 48.859,
    lng: 2.362,
    startsInMin: 0,
    durationMin: 120,
    description: 'Five stops, one neighborhood. Falafel, pastrami, pastries — pace yourselves.',
    attendees: [],
  },
  {
    id: 'e4',
    title: 'AI Builders Meetup',
    venue: 'Station F',
    category: 'tech',
    lat: 48.8344,
    lng: 2.3713,
    startsInMin: 90,
    durationMin: 150,
    description: 'Lightning demos from 6 teams shipping with LLMs, then open networking.',
    attendees: [],
  },
  {
    id: 'e5',
    title: 'Golden Hour Photo Walk',
    venue: 'Montmartre',
    category: 'photo',
    lat: 48.8867,
    lng: 2.3431,
    startsInMin: 120,
    durationMin: 90,
    description: 'Chasing the last light from Sacré-Cœur down the back streets. Bring any camera.',
    attendees: [],
  },
  {
    id: 'e6',
    title: 'Five-a-side Pickup',
    venue: 'Champ de Mars',
    category: 'football',
    lat: 48.8556,
    lng: 2.2986,
    startsInMin: 0,
    durationMin: 120,
    description: 'Casual pickup game, rolling subs. First 20 in the chat get a spot.',
    attendees: [],
  },
  {
    id: 'e7',
    title: 'Gallery Hop',
    venue: 'Saint-Germain-des-Prés',
    category: 'art',
    lat: 48.854,
    lng: 2.3338,
    startsInMin: 60,
    durationMin: 120,
    description: 'Four small galleries, one new opening. Ends at a wine bar, obviously.',
    attendees: [],
  },
  {
    id: 'e8',
    title: 'Rooftop DJ Set',
    venue: 'Belleville',
    category: 'nightlife',
    lat: 48.8722,
    lng: 2.3767,
    startsInMin: 180,
    durationMin: 240,
    description: 'Open-air decks until 2am. RSVP in chat for the door list.',
    attendees: [],
  },
  {
    id: 'e9',
    title: 'Co-op Gaming Night',
    venue: 'Bastille',
    category: 'gaming',
    lat: 48.853,
    lng: 2.3691,
    startsInMin: 30,
    durationMin: 180,
    description: 'Couch co-op and a Mario Kart bracket on the big screen. Controllers provided.',
    attendees: [],
  },
  {
    id: 'e10',
    title: 'Morning Flow Yoga',
    venue: 'Jardin du Luxembourg',
    category: 'yoga',
    lat: 48.8462,
    lng: 2.3372,
    startsInMin: 0,
    durationMin: 60,
    description: 'Vinyasa on the lawn near the orangerie. Mats available, arrive 10 min early.',
    attendees: [],
  },
  {
    id: 'e11',
    title: 'Vinyl Swap & Coffee',
    venue: 'Les Halles',
    category: 'music',
    lat: 48.8656,
    lng: 2.35,
    startsInMin: 25,
    durationMin: 120,
    description: 'Bring three records you no longer love. Leave with three you do.',
    attendees: [],
  },
  {
    id: 'e12',
    title: 'Startup Pitch & Pizza',
    venue: 'Grands Boulevards',
    category: 'tech',
    lat: 48.87,
    lng: 2.33,
    startsInMin: 200,
    durationMin: 120,
    description: 'Five pitches, brutal-but-kind feedback, unlimited pizza.',
    attendees: [],
  },
]

const ACTIVITIES = [
  'exploring the city',
  'open to meet',
  'looking for a coffee',
  'free this evening',
  'on a long walk',
  'new in town 👋',
  'taking a break',
  'up for anything',
]

const MEMBER_SEED: Array<[string, string, string[]]> = [
  ['Léa', '🦊', ['music', 'nightlife', 'photo']],
  ['Marco', '🐻', ['food', 'football']],
  ['Aiko', '🐱', ['art', 'photo']],
  ['Tomás', '🦉', ['tech', 'gaming']],
  ['Nina', '🐰', ['yoga', 'running']],
  ['Yusuf', '🦁', ['football', 'running']],
  ['Chloé', '🐨', ['music', 'art']],
  ['Ben', '🐼', ['tech', 'music']],
  ['Sofia', '🦋', ['food', 'yoga']],
  ['Hugo', '🐸', ['gaming', 'tech']],
  ['Emma', '🦄', ['nightlife', 'music']],
  ['Karim', '🐺', ['running', 'football']],
  ['Mia', '🐝', ['photo', 'art', 'food']],
  ['Liam', '🦅', ['tech', 'running']],
  ['Zoé', '🐙', ['art', 'nightlife']],
  ['Pablo', '🦜', ['music', 'food']],
  ['Anya', '🐢', ['yoga', 'photo']],
  ['Théo', '🦔', ['gaming', 'football']],
  ['Inès', '🐬', ['running', 'yoga']],
  ['Max', '🦖', ['tech', 'gaming', 'nightlife']],
  ['Lucie', '🐞', ['food', 'art']],
  ['Omar', '🦚', ['photo', 'tech']],
]

export const MEMBERS: Member[] = MEMBER_SEED.map(([name, avatar, interests], i) => ({
  id: `m${i}`,
  name,
  avatar,
  interests,
  lat: rand(48.838, 48.886),
  lng: rand(2.29, 2.4),
  heading: rand(0, Math.PI * 2),
  speed: rand(0.00025, 0.0006),
  status: 'roaming',
  activity: pick(ACTIVITIES),
}))

// Seed attendees: members who share the event's interest, with some randomness
for (const event of EVENTS) {
  event.attendees = MEMBERS.filter(
    (m) => m.interests.includes(event.category) && Math.random() < 0.5,
  ).map((m) => m.id)
}

// Give about half the members a plan: head to an event matching their interests
for (const m of MEMBERS) {
  if (Math.random() < 0.5) {
    const options = EVENTS.filter((e) => m.interests.includes(e.category))
    if (options.length) {
      const target = pick(options)
      m.planEventId = target.id
      m.status = 'heading'
      m.activity = `heading to ${target.title}`
    }
  }
}

export const CHAT_SEEDS: Record<string, string[]> = {
  music: [
    'Anyone know if there is a cloakroom? Bringing a jacket 🎒',
    'The first band starts sharp, do not be late!',
    'I can put two people on the guest list, first come first served',
  ],
  running: [
    'Pace check — thinking 5:45/km for the first half?',
    'Meeting point is by the steps on the right bank 👍',
    'Weather looks perfect, see everyone at the bridge!',
  ],
  food: [
    'Pro tip: skip lunch. You will need the space.',
    'First stop has a veggie option for anyone asking 🌱',
    'I am 5 min away, wearing the yellow scarf',
  ],
  tech: [
    'Anyone demoing tonight? Slot 4 just opened up',
    'Will the talks be recorded for people joining late?',
    'Looking for a co-founder type, find me near the coffee ☕',
  ],
  photo: [
    'Golden hour starts ~20:40, we should be on the steps by then',
    'Bringing a spare 50mm if anyone wants to try it',
    'Phone cameras totally fine, it is about the eye 👁️',
  ],
  football: [
    'We need one more for the blue team!',
    'Bibs and ball sorted, just bring water 💧',
    'Pitch 2, the one closer to the tower',
  ],
  nightlife: [
    'Doors at 22:00 but the rooftop opens earlier for the list',
    'Dress code is "whatever makes you dance"',
    'Pre-drinks at the corner bar from 21:00 🍸',
  ],
  art: [
    'The opening at stop 3 has the artist in attendance!',
    'Free entry everywhere except the last gallery (5€)',
    'Meeting at the fountain, look for the group with tote bags',
  ],
  gaming: [
    'Bracket is filling up, 6 spots left for Mario Kart 🏁',
    'Someone bring an extra controller if you can',
    'Casual corner for non-bracket people, no pressure',
  ],
  yoga: [
    'Mats are provided but bring a towel, grass is dewy 🌿',
    'Beginner friendly! I started two weeks ago',
    'We grab juice after, everyone is welcome',
  ],
}

export const CHAT_REPLIES = [
  'Nice, see you there! 🙌',
  'Welcome! Glad you found us on the map',
  'Great — we are the group near the entrance',
  'Perfect timing, it is just getting started',
  'Love it. The more the merrier!',
  'Awesome, ping here if you cannot find us',
]
