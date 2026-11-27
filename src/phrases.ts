// Starter deck: everyday spoken Turkish for time with a partner's family.
// `note` explains when/why the phrase is used — the cultural part matters as much as the words.

export interface Phrase {
  id: string;
  tr: string;
  en: string;
  topic: Topic;
  note?: string;
}

export type Topic =
  | "Greetings & politeness"
  | "At the table"
  | "Family"
  | "Small talk"
  | "Visits & holidays"
  | "Feelings & reactions";

export const TOPICS: Topic[] = [
  "Greetings & politeness",
  "At the table",
  "Family",
  "Small talk",
  "Visits & holidays",
  "Feelings & reactions",
];

const raw: Array<[string, string, Topic, string?]> = [
  // Greetings & politeness
  ["Merhaba!", "Hello!", "Greetings & politeness"],
  ["Hoş bulduk.", "Glad to be here. (reply to 'Hoş geldiniz')", "Greetings & politeness", "Always the answer when someone welcomes you with 'Hoş geldin(iz)'."],
  ["Hoş geldiniz!", "Welcome! (formal/plural)", "Greetings & politeness"],
  ["Nasılsınız?", "How are you? (formal)", "Greetings & politeness", "Use the formal -sınız with her parents and older relatives."],
  ["İyiyim, teşekkür ederim. Siz nasılsınız?", "I'm fine, thank you. And how are you?", "Greetings & politeness"],
  ["Memnun oldum.", "Nice to meet you.", "Greetings & politeness"],
  ["Ben de memnun oldum.", "Nice to meet you too.", "Greetings & politeness"],
  ["Teşekkür ederim.", "Thank you.", "Greetings & politeness"],
  ["Çok sağ olun.", "Thanks a lot. (warm, formal)", "Greetings & politeness", "Very common and friendly; 'sağ ol' with people your age."],
  ["Rica ederim.", "You're welcome.", "Greetings & politeness"],
  ["Pardon, anlamadım.", "Sorry, I didn't understand.", "Greetings & politeness"],
  ["Biraz daha yavaş konuşur musunuz?", "Could you speak a bit more slowly?", "Greetings & politeness"],
  ["Türkçem daha iyi değil ama öğreniyorum.", "My Turkish isn't great yet, but I'm learning.", "Greetings & politeness"],
  ["İyi akşamlar!", "Good evening!", "Greetings & politeness"],
  ["İyi geceler!", "Good night!", "Greetings & politeness"],
  ["Görüşürüz!", "See you!", "Greetings & politeness"],
  ["Hoşça kalın!", "Goodbye! (said by the one leaving, formal)", "Greetings & politeness"],
  ["Güle güle!", "Goodbye! (said by the one staying)", "Greetings & politeness"],

  // At the table
  ["Afiyet olsun!", "Enjoy your meal!", "At the table", "Said before or during eating, and as a reply when someone thanks for food."],
  ["Eline sağlık!", "Bless your hands! (thanks to the cook)", "At the table", "Say this to whoever cooked, every time. Plural/formal: 'Ellerinize sağlık'."],
  ["Ellerinize sağlık, çok lezzetli olmuş.", "Bless your hands, it turned out delicious.", "At the table"],
  ["Çok güzel olmuş!", "It turned out great!", "At the table"],
  ["Doydum, teşekkürler.", "I'm full, thanks.", "At the table", "You'll be offered more many times. Saying it kindly (and more than once) is normal."],
  ["Biraz daha alabilir miyim?", "Could I have a little more?", "At the table"],
  ["Tuzu uzatır mısınız?", "Could you pass the salt?", "At the table"],
  ["Bu yemeğin adı ne?", "What is this dish called?", "At the table"],
  ["Bunu nasıl yapıyorsunuz?", "How do you make this?", "At the table"],
  ["Çay ister misin?", "Would you like tea?", "At the table"],
  ["Evet, lütfen. / Yok, sağ olun.", "Yes, please. / No, thank you.", "At the table"],
  ["Şekersiz, lütfen.", "Without sugar, please.", "At the table"],
  ["Yardım edebilir miyim?", "Can I help?", "At the table", "Offer to help clear the table; you may be refused, but the offer is appreciated."],
  ["Sofrayı toplamaya yardım edeyim.", "Let me help clear the table.", "At the table"],

  // Family
  ["anne / baba", "mother / father", "Family"],
  ["Teyze", "Auntie (mother's sister; also any older woman)", "Family", "Used politely for older women in general, not only relatives."],
  ["Hala", "Aunt (father's sister)", "Family"],
  ["Amca", "Uncle (father's brother; also any older man)", "Family"],
  ["Dayı", "Uncle (mother's brother)", "Family"],
  ["Anneanne / Babaanne", "Grandma (mother's mother / father's mother)", "Family"],
  ["Dede", "Grandpa", "Family"],
  ["Abla / Abi", "Older sister / older brother (also respectful address)", "Family", "Also used for any slightly older woman/man, e.g. 'Ayşe Abla'."],
  ["Kardeş", "Sibling / younger sibling", "Family"],
  ["Kız arkadaşım", "My girlfriend", "Family"],
  ["Sevgilim", "My darling / my partner", "Family"],
  ["Kaç kardeşsiniz?", "How many siblings are you?", "Family", "Turks count themselves: 'Üç kardeşiz' = there are three of us."],
  ["Ailem Almanya'da yaşıyor.", "My family lives in Germany.", "Family", "Swap in your own country."],
  ["Annenize selamlar!", "Greetings to your mother!", "Family"],

  // Small talk
  ["Nerelisiniz?", "Where are you from? (formal)", "Small talk"],
  ["Ben Almanyalıyım.", "I'm from Germany.", "Small talk", "Pattern: country + -lı/-li/-lu/-lü + -(y)ım."],
  ["Ne iş yapıyorsunuz?", "What do you do for work?", "Small talk"],
  ["Hava bugün çok güzel.", "The weather is really nice today.", "Small talk"],
  ["Türkiye'yi çok seviyorum.", "I love Turkey.", "Small talk"],
  ["Türkçe öğreniyorum.", "I'm learning Turkish.", "Small talk"],
  ["Ne demek?", "What does it mean?", "Small talk"],
  ["Türkçe'de ... nasıl denir?", "How do you say ... in Turkish?", "Small talk"],
  ["Futbol seviyor musunuz? Hangi takımı tutuyorsunuz?", "Do you like football? Which team do you support?", "Small talk", "A classic topic with Turkish dads."],
  ["Çok güzel bir eviniz var.", "You have a very nice home.", "Small talk"],
  ["Bugün ne yaptınız?", "What did you do today?", "Small talk"],
  ["Tabii!", "Of course!", "Small talk"],
  ["Aynen.", "Exactly. / Right.", "Small talk"],

  // Visits & holidays
  ["Bayramınız mübarek olsun!", "Happy Bayram! (blessed be your holiday)", "Visits & holidays", "Said at Ramazan and Kurban Bayramı."],
  ["İyi bayramlar!", "Happy holidays!", "Visits & holidays"],
  ["Elinizi öpeyim.", "Let me kiss your hand.", "Visits & holidays", "Respect gesture for elders at Bayram: kiss the back of their hand, then touch it to your forehead."],
  ["Kolay gelsin!", "May it come easy! (to someone working)", "Visits & holidays", "Say it to anyone busy: cooking, cleaning, working."],
  ["Geçmiş olsun!", "Get well soon / Sorry that happened.", "Visits & holidays", "For illness or any bad experience."],
  ["Doğum günün kutlu olsun!", "Happy birthday!", "Visits & holidays"],
  ["Mutlu yıllar!", "Happy New Year! / Happy birthday!", "Visits & holidays"],
  ["Ayakkabılarımı çıkarayım mı?", "Should I take my shoes off?", "Visits & holidays", "Usually yes. You'll often be given slippers (terlik)."],
  ["Size küçük bir hediye getirdim.", "I brought you a small gift.", "Visits & holidays"],
  ["Zahmet etmeyin.", "Please don't go to any trouble.", "Visits & holidays"],
  ["Ne zahmeti!", "No trouble at all!", "Visits & holidays"],
  ["Artık gitmemiz lazım.", "We need to go now.", "Visits & holidays"],
  ["Her şey için teşekkürler.", "Thanks for everything.", "Visits & holidays"],

  // Feelings & reactions
  ["Maşallah!", "Wonderful! (praise, wards off the evil eye)", "Feelings & reactions", "Used when admiring children, food, a new home, etc."],
  ["İnşallah.", "Hopefully. / God willing.", "Feelings & reactions"],
  ["Allah Allah!", "Oh my! / Goodness! (surprise)", "Feelings & reactions"],
  ["Hayırlı olsun!", "Congratulations! (on something new)", "Feelings & reactions", "For a new job, car, home, engagement..."],
  ["Tebrikler!", "Congratulations!", "Feelings & reactions"],
  ["Çok mutluyum.", "I'm very happy.", "Feelings & reactions"],
  ["Biraz yorgunum.", "I'm a little tired.", "Feelings & reactions"],
  ["Ne güzel!", "How lovely!", "Feelings & reactions"],
  ["Olsun.", "Never mind. / That's okay.", "Feelings & reactions"],
  ["Gerçekten mi?", "Really?", "Feelings & reactions"],
  ["Sağlık olsun.", "Never mind, as long as everyone's healthy.", "Feelings & reactions", "Said when something breaks or goes wrong."],
];

function slug(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9çğıöşü]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const PHRASES: Phrase[] = raw.map(([tr, en, topic, note]) => ({
  id: slug(tr),
  tr,
  en,
  topic,
  note,
}));
