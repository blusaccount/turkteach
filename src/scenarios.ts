import type { Scenario } from "./store";

export const STARTER_SCENARIOS: Scenario[] = [
  {
    id: "first-dinner",
    title: "First dinner at her parents'",
    character: "Her mother, warm and curious, a little formal at first",
    setting: "Evening at the family's home. The table is full of food she cooked. You just sat down.",
    goal: "Greet everyone politely, compliment the food, answer questions about yourself.",
    source: "starter",
  },
  {
    id: "tea-with-dad",
    title: "Tea and football with her dad",
    character: "Her father, friendly but a man of few words, loves football",
    setting: "After dinner on the balcony with tea in tulip glasses.",
    goal: "Make small talk: work, football, where you're from.",
    source: "starter",
  },
  {
    id: "kitchen-help",
    title: "Helping in the kitchen",
    character: "Her mother, busy cooking, happy to teach",
    setting: "The kitchen before guests arrive. Something is on the stove.",
    goal: "Offer help, ask what things are called, follow simple instructions.",
    source: "starter",
  },
  {
    id: "bayram-visit",
    title: "Bayram visit to grandma",
    character: "Her grandmother (babaanne), traditional, very affectionate, speaks a bit fast",
    setting: "Morning of Bayram. Relatives are coming and going; there is candy and coffee.",
    goal: "Give Bayram wishes, show respect (hand kiss), accept food and compliments.",
    source: "starter",
  },
  {
    id: "video-call",
    title: "Video call with the family",
    character: "Her mother on a video call, the whole family waving in the background",
    setting: "Sunday video call; the connection is a bit choppy.",
    goal: "Say hello, talk about your week, send greetings to everyone.",
    source: "starter",
  },
  {
    id: "cousins",
    title: "Meeting her aunt and cousins",
    character: "Her aunt (teyze), chatty and teasing, asks personal questions",
    setting: "A family gathering in the living room with lots of people.",
    goal: "Introduce yourself, ask about family members, handle a little teasing.",
    source: "starter",
  },
];
