import { asteriskCensorStrategy, englishDataset, englishRecommendedTransformers, RegExpMatcher, TextCensor } from 'obscenity';

const matcher = new RegExpMatcher({...englishDataset.build(), ...englishRecommendedTransformers});
const censor = new TextCensor().setStrategy(asteriskCensorStrategy());

export function filterPublicChat(body: string) {
  return censor.applyTo(body, matcher.getAllMatches(body));
}
