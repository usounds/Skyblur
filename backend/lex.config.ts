import { defineLexiconConfig } from '@atcute/lex-cli';

export default defineLexiconConfig({
    files: ['../lexicon/uk/skyblur/**/*.json'],
    outdir: './src/lexicon/generated',
});
